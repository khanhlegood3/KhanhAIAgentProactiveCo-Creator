/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const Type = {
  TYPE_UNSPECIFIED: "TYPE_UNSPECIFIED",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
  NULL: "NULL",
} as const;
export type Type = (typeof Type)[keyof typeof Type];

export const Modality = {
  MODALITY_UNSPECIFIED: "MODALITY_UNSPECIFIED",
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  DOCUMENT: "DOCUMENT",
} as const;
export type Modality = (typeof Modality)[keyof typeof Modality];

export const ThinkingLevel = {
  THINKING_LEVEL_UNSPECIFIED: "THINKING_LEVEL_UNSPECIFIED",
  MINIMAL: "MINIMAL",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type ThinkingLevel = (typeof ThinkingLevel)[keyof typeof ThinkingLevel];

export const HarmCategory = {
  HARM_CATEGORY_UNSPECIFIED: "HARM_CATEGORY_UNSPECIFIED",
  HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT",
  HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY",
} as const;
export type HarmCategory = (typeof HarmCategory)[keyof typeof HarmCategory];

export const HarmBlockThreshold = {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
  BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",
  BLOCK_NONE: "BLOCK_NONE",
  OFF: "OFF",
} as const;
export type HarmBlockThreshold = (typeof HarmBlockThreshold)[keyof typeof HarmBlockThreshold];

export const VideoGenerationReferenceType = {
  ASSET: "ASSET",
  STYLE: "STYLE",
} as const;
export type VideoGenerationReferenceType =
  (typeof VideoGenerationReferenceType)[keyof typeof VideoGenerationReferenceType];

export type Part = any;
export type Content = any;
export type Tool = any;
export type FunctionDeclaration = any;
export type Schema = any;
export type GenerateContentResponse = any;
export type GenerateImagesResponse = any;
export type GeneratedImage = any;
export type GeneratedVideo = any;

let fallbackClientId = "";
function getClientId(): string {
  try {
    const existing = window.sessionStorage.getItem("__aistudio_client_id");
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    window.sessionStorage.setItem("__aistudio_client_id", created);
    return created;
  } catch {
    if (!fallbackClientId) {
      fallbackClientId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    }
    return fallbackClientId;
  }
}

async function postJson(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": getClientId() },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

async function createNdjsonStream(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": getClientId() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  async function* generator() {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line);
        }
      }
    }
    if (buffer.trim()) {
      yield JSON.parse(buffer);
    }
  }
  return generator();
}

export class GoogleGenAI {
  constructor(_options?: any) {}

  models = {
    generateContent: async (params: any): Promise<any> => {
      return await postJson("/api/generate-content", params);
    },
    generateContentStream: async (params: any): Promise<AsyncGenerator<any, void, unknown>> => {
      return await createNdjsonStream("/api/generate-content-stream", params);
    },
    generateImages: async (params: any): Promise<any> => {
      return await postJson("/api/generate-images", params);
    },
    generateVideos: async (params: any): Promise<any> => {
      return await postJson("/api/generate-videos", params);
    },
  };

  operations = {
    getVideosOperation: async (params: any): Promise<any> => {
      return await postJson("/api/videos-operation", params);
    },
  };

  chats = {
    create: (chatParams: any) => {
      const sessionId =
        Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
      const { model, config, history } = chatParams || {};
      return {
        sendMessage: async (msgParams: any): Promise<any> => {
          return await postJson("/api/chat-message", {
            sessionId,
            model,
            config,
            history,
            message: msgParams?.message,
            msgConfig: msgParams?.config,
          });
        },
        sendMessageStream: async (
          msgParams: any
        ): Promise<AsyncGenerator<any, void, unknown>> => {
          return await createNdjsonStream("/api/chat-stream", {
            sessionId,
            model,
            config,
            history,
            message: msgParams?.message,
            msgConfig: msgParams?.config,
          });
        },
      };
    },
  };
}
