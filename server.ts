/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

class BoundedMap<K, V> extends Map<K, V> {
  maxEntries: number;
  constructor(maxEntries: number) {
    super();
    this.maxEntries = maxEntries;
  }
  set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return super.set(key, value);
  }
}


function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}


const MODEL_UPGRADES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3-flash-preview",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gemini-2.0-flash": "gemini-3-flash-preview",
  "gemini-2.0-flash-exp": "gemini-3-flash-preview",
};

const ALLOWED_MODEL_RE = /^(?!.*\.\.)(?:models\/)?(?:gemini-|imagen-|veo-|lyria-|learnlm-|text-embedding-|gemini-embedding-)[a-zA-Z0-9._-]+$/;

function resolveModel(model?: string): string {
  const candidate = !model ? "gemini-3-flash-preview" : MODEL_UPGRADES[model] || model;
  if (!ALLOWED_MODEL_RE.test(candidate)) {
    throw new Error(`Disallowed model: ${candidate}`);
  }
  return candidate;
}

function serializeGenerateContentResponse(r: any) {
  return {
    candidates: r?.candidates,
    promptFeedback: r?.promptFeedback,
    usageMetadata: r?.usageMetadata,
    modelVersion: r?.modelVersion,
    responseId: r?.responseId,
    text: r?.text,
    functionCalls: r?.functionCalls,
    data: r?.data,
    executableCode: r?.executableCode,
    codeExecutionResult: r?.codeExecutionResult,
  };
}

const chats = new BoundedMap<string, any>(200);

interface VideoOpEntry {
  name: string;
  ownerKey: string;
  dlToken?: string;
  createdAt: number;
  done: boolean;
  videoBuffer?: Buffer;
  mimeType?: string;
  metadata?: any;
  error?: any;
  response?: any;
}

const videoOps = new Map<string, VideoOpEntry>();
const MAX_VIDEO_BUFFERS = 10;
const MAX_VIDEO_CACHE_BYTES = 150 * 1024 * 1024;
const MAX_PENDING_JOBS_PER_CLIENT = 2;
const MAX_PENDING_JOBS_GLOBAL = 12;
const STALE_VIDEO_JOB_MS = 10 * 60 * 1000;
const MAX_VIDEO_OP_RECORDS = 40;

function safeVideoMimeType(mime?: unknown): string {
  if (typeof mime === "string") {
    const normalized = mime.split(";")[0].trim().toLowerCase();
    if (/^video\/(mp4|webm)$/i.test(normalized)) return normalized;
  }
  return "video/mp4";
}

function getClientKey(req: any): string {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  const xffParts = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const xff = xffParts.length >= 2 ? xffParts[xffParts.length - 2] : (xffParts[0] || "");
  return `ip:${xff || req?.ip || req?.socket?.remoteAddress || "unknown"}`;
}

function cleanupVideoOps() {
  const now = Date.now();
  for (const [k, op] of videoOps.entries()) {
    if (!op.done && now - op.createdAt > STALE_VIDEO_JOB_MS) {
      op.done = true;
      op.error = { message: "Video generation timed out." };
    } else if (op.done && now - op.createdAt > 30 * 60 * 1000) {
      videoOps.delete(k);
    }
  }
}

function countPendingVideoOps(ownerKey?: string): number {
  cleanupVideoOps();
  let count = 0;
  for (const op of videoOps.values()) {
    if (!op.done && (!ownerKey || op.ownerKey === ownerKey)) count++;
  }
  return count;
}

function setVideoOpBounded(key: string, entry: VideoOpEntry) {
  if (entry.videoBuffer) {
    let bufferedCount = 0;
    let bufferedBytes = 0;
    for (const [k, op] of videoOps.entries()) {
      if (k !== key && op.videoBuffer) {
        bufferedCount++;
        bufferedBytes += op.videoBuffer.length;
      }
    }
    for (const [k, op] of videoOps.entries()) {
      if (k === key || !op.videoBuffer) continue;
      if (bufferedCount < MAX_VIDEO_BUFFERS && bufferedBytes + entry.videoBuffer.length <= MAX_VIDEO_CACHE_BYTES) {
        break;
      }
      bufferedCount--;
      bufferedBytes -= op.videoBuffer.length;
      videoOps.delete(k);
    }
  }
  if (videoOps.has(key)) {
    videoOps.delete(key);
  } else if (videoOps.size >= MAX_VIDEO_OP_RECORDS) {
    for (const [k, op] of videoOps.entries()) {
      if (op.done) {
        videoOps.delete(k);
        break;
      }
    }
  }
  videoOps.set(key, entry);
}

setInterval(cleanupVideoOps, 60_000).unref();

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  for (const dir of ["examples", "assets", "public"]) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath));
    }
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await ai.models.generateContent(params);
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate content." });
    }
  });

  app.post("/api/generate-content-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const stream = await ai.models.generateContentStream(params);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/generate-content-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream content." });
      }
      res.end();
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const chatKey = sessionId ? `${getClientKey(req)}:${sessionId}` : undefined;
      const ai = new GoogleGenAI({ apiKey });
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const response = await chat.sendMessage({ message, config: msgConfig });
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/chat-message error:", error);
      return res.status(500).json({ error: error.message || "Failed to send chat message." });
    }
  });

  app.post("/api/chat-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const chatKey = sessionId ? `${getClientKey(req)}:${sessionId}` : undefined;
      const ai = new GoogleGenAI({ apiKey });
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const stream = await chat.sendMessageStream({ message, config: msgConfig });
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/chat-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream chat message." });
      }
      res.end();
    }
  });

  app.post("/api/generate-images", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const resolvedImgModel = resolveModel(req.body?.model || "imagen-3.0-generate-002");
      try {
        const response = await ai.models.generateImages({ ...req.body, model: resolvedImgModel });
        return res.json(response);
      } catch (imgErr: any) {
        console.warn("[Backend] generateImages failed, falling back to Gemini image generation:", imgErr);
        const count = Math.min(Math.max(Number(req.body?.config?.numberOfImages) || 1, 1), 4);
        const aspectRatio = req.body?.config?.aspectRatio;
        const results = await Promise.all(
          Array.from({ length: count }, () =>
            ai.models.generateContent({
              model: "gemini-2.5-flash-image",
              contents: req.body?.prompt || "Generate image",
              config: {
                responseModalities: ["IMAGE"],
                ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
              },
            })
          )
        );
        const generatedImages: any[] = [];
        for (const r of results) {
          const imgPart = r?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
          if (imgPart?.inlineData?.data) {
            generatedImages.push({
              image: {
                imageBytes: imgPart.inlineData.data,
                mimeType: imgPart.inlineData.mimeType || "image/png",
              },
            });
          }
        }
        if (generatedImages.length > 0) {
          return res.json({ generatedImages });
        }
        throw imgErr;
      }
    } catch (error: any) {
      console.error("[Backend] /api/generate-images error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate images." });
    }
  });

  app.post("/api/generate-videos", async (req, res): Promise<any> => {
    try {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const inputParts: any[] = [];
      const startImg = req.body?.image;
      const lastImg = req.body?.config?.lastFrame;
      const refImgs = req.body?.config?.referenceImages;

      if (startImg?.imageBytes && lastImg?.imageBytes) {
        inputParts.push({ type: "text", text: "First frame:" });
        inputParts.push({
          type: "image",
          data: startImg.imageBytes,
          mime_type: startImg.mimeType || "image/png",
        });
        inputParts.push({ type: "text", text: "Last frame:" });
        inputParts.push({
          type: "image",
          data: lastImg.imageBytes,
          mime_type: lastImg.mimeType || "image/png",
        });
      } else if (startImg?.imageBytes) {
        inputParts.push({
          type: "image",
          data: startImg.imageBytes,
          mime_type: startImg.mimeType || "image/png",
        });
      }

      if (Array.isArray(refImgs)) {
        for (const ref of refImgs) {
          const b64 = ref?.image?.imageBytes || ref?.imageBytes;
          const mime = ref?.image?.mimeType || ref?.mimeType || "image/png";
          if (b64) {
            inputParts.push({
              type: "image",
              data: b64,
              mime_type: mime,
            });
          }
        }
      }

      const promptText =
        req.body?.prompt || "Animate this scene smoothly and cinematically.";
      inputParts.push({ type: "text", text: promptText });

      const rawAspect = req.body?.config?.aspectRatio;
      const aspectRatio =
        rawAspect === "9:16" || rawAspect === "16:9" ? rawAspect : "16:9";

      const ownerKey = getClientKey(req);
      if (countPendingVideoOps(ownerKey) >= MAX_PENDING_JOBS_PER_CLIENT) {
        return res.status(429).json({
          error: "Too many concurrent video jobs for your session. Please wait for your current video to finish.",
        });
      }
      if (countPendingVideoOps() >= MAX_PENDING_JOBS_GLOBAL) {
        return res.status(429).json({
          error: "Too many concurrent video jobs on server. Please try again shortly.",
        });
      }

      const videoId = crypto.randomUUID();
      const opName = `operations/omni-${videoId}`;
      const createdAt = Date.now();
      setVideoOpBounded(opName, { name: opName, ownerKey, createdAt, done: false });

      (async () => {
        try {
          const interaction: any = await (ai as any).interactions.create(
            {
              model: "gemini-omni-1.1-flash",
              input: [{ type: "user_input", content: inputParts }],
              background: false,
              store: false,
              stream: false,
              response_format: {
                type: "video",
                aspect_ratio: aspectRatio,
              },
            },
            { timeout: 600000 }
          );
          const videoPart = interaction?.output_video;
          if (!videoPart?.data) {
            throw new Error("No video data returned from gemini-omni-1.1-flash.");
          }
          const videoBuffer = Buffer.from(videoPart.data, "base64");
          if (videoBuffer.length > MAX_VIDEO_CACHE_BYTES) {
            throw new Error("Generated video exceeds maximum allowed size.");
          }
          const dlToken = crypto.randomBytes(32).toString("hex");
          setVideoOpBounded(opName, {
            name: opName,
            ownerKey,
            dlToken,
            createdAt,
            done: true,
            videoBuffer,
            mimeType: safeVideoMimeType(videoPart.mime_type),
            response: {
              generatedVideos: [
                {
                  video: {
                    uri: `/api/video-download?op=${encodeURIComponent(opName)}&dl=${dlToken}`,
                  },
                },
              ],
            },
          });
        } catch (err: any) {
          console.error("[Backend] gemini-omni-1.1-flash error:", err);
          setVideoOpBounded(opName, {
            name: opName,
            ownerKey,
            createdAt,
            done: true,
            error: { message: err?.message || "Failed to generate video." },
          });
        }
      })();

      return res.json({
        name: opName,
        done: false,
      });
    } catch (error: any) {
      console.error("[Backend] /api/generate-videos error:", error);
      return res.status(500).json({ error: error.message || "Failed to start video generation." });
    }
  });

  app.post("/api/videos-operation", async (req, res): Promise<any> => {
    try {
      cleanupVideoOps();
      const opName = typeof req.body?.operation?.name === "string" ? req.body.operation.name : "";
      const storedOp = opName ? videoOps.get(opName) : undefined;
      if (!storedOp || storedOp.ownerKey !== getClientKey(req)) {
        return res.status(404).json({ error: "Video operation not found on server." });
      }
      return res.json({
        name: storedOp.name,
        done: storedOp.done,
        metadata: storedOp.metadata,
        error: storedOp.error,
        response: storedOp.response,
      });
    } catch (error: any) {
      console.error("[Backend] /api/videos-operation error:", error);
      return res.status(500).json({ error: error.message || "Failed to poll video operation." });
    }
  });

  const sendCachedVideo = (rawIdentifier: string, req: express.Request, res: express.Response): any => {
    cleanupVideoOps();
    const cleaned = rawIdentifier.split("&key=")[0].split("?key=")[0].trim();
    if (!cleaned) {
      return res.status(404).json({ error: "Video operation not found." });
    }
    const lookupKey = videoOps.has(cleaned) ? cleaned : `operations/omni-${cleaned}`;
    const stored = videoOps.get(lookupKey);
    if (!stored) {
      return res.status(404).json({ error: "Video operation not found." });
    }
    const rawDl = String(req.query?.dl || "").split("?")[0].split("&")[0].trim();
    const hasValidDl = Boolean(rawDl && stored.dlToken && rawDl === stored.dlToken);
    if (!hasValidDl && stored.ownerKey !== getClientKey(req)) {
      return res.status(404).json({ error: "Video operation not found." });
    }
    if (!stored.videoBuffer) {
      return res.status(404).json({ error: "Video data not ready." });
    }
    res.setHeader("Content-Type", safeVideoMimeType(stored.mimeType));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; media-src 'self'; sandbox");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(stored.videoBuffer);
  };

  app.get("/api/video-download", (req, res): any => {
    try {
      return sendCachedVideo(String(req.query.op || ""), req, res);
    } catch (error: any) {
      console.error("[Backend] /api/video-download error:", error);
      return res.status(500).json({ error: "Failed to download video." });
    }
  });

  app.get("/api/videos/:id", (req, res): any => {
    try {
      return sendCachedVideo(String(req.params.id || ""), req, res);
    } catch (error: any) {
      console.error("[Backend] /api/videos/:id error:", error);
      return res.status(500).json({ error: "Failed to download video." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
