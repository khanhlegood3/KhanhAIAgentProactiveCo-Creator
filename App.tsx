
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import ClarificationCard from './components/ClarificationCard';
import BeliefGraph from './components/BeliefGraph';
import OutputDisplay from './components/OutputGallery';
import {
  parsePromptToBeliefGraph,
  updateBeliefGraph,
  generateClarifications,
  generateImagesFromPrompt,
  generateStoryFromPrompt,
  generateVideosFromPrompt,
  refinePromptWithAllUpdates,
} from './services/geminiService';
import { BeliefState, Clarification, GraphUpdate, Attribute, ImagePart, StoryType, GeneratedImage, AspectRatio, Proactiveness } from './types';
import ReviewPromptModal from './components/ReviewPromptModal';

interface ProposedPromptState {
  text: string;
  qaPairs: any[];
  graphUpdates: GraphUpdate[];
  newAnsweredQuestions: string[];
  action: 'apply' | 'analyze' | 'generate';
}

type Mode = 'image' | 'story' | 'video';
type ToolTab = 'clarify' | 'graph' | 'attributes';
type MobileView = 'editor' | 'preview';

function App() {
  const [prompt, setPrompt] = useState('a cat hosting a party for its bunny friends');
  const [uploadedImages, setUploadedImages] = useState<ImagePart[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  // Default resolution for Image mode
  const [resolution, setResolution] = useState<string>('1K');
  // Default to Image mode model
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');
  const [selectedClarificationModel, setSelectedClarificationModel] = useState<string>('gemini-3-flash-preview');
  const [storyType, setStoryType] = useState<StoryType>('generic');
  const [proactiveness, setProactiveness] = useState<Proactiveness>('medium');
  
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [isAttributesLoading, setIsAttributesLoading] = useState(false);
  const [isClarificationsLoading, setIsClarificationsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  
  const [proposedPromptState, setProposedPromptState] = useState<ProposedPromptState | null>(null);
  
  const [isOutdated, setIsOutdated] = useState(false); 
  const [showModeChangePopup, setShowModeChangePopup] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(true);
  // Default to Image mode
  const [mode, setMode] = useState<Mode>('image');
  
  const modeRef = useRef<Mode>(mode);
  const analysisRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [story, setStory] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [galleryErrors, setGalleryErrors] = useState<Record<Mode, string | null>>({ image: null, story: null, video: null });
  const [requiresApiKey, setRequiresApiKey] = useState(false);
  
  const [beliefGraph, setBeliefGraph] = useState<BeliefState | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);
  const [skippedQuestions, setSkippedQuestions] = useState<string[]>([]); 
  const [hasGenerated, setHasGenerated] = useState(false);

  const [lastAnalyzedPrompt, setLastAnalyzedPrompt] = useState<string | null>(null);
  const [lastAnalyzedMode, setLastAnalyzedMode] = useState<Mode | null>(null);
  // Store a simplified signature of images to detect changes (e.g. count + length of first image)
  const [lastAnalyzedImagesSignature, setLastAnalyzedImagesSignature] = useState<string>("");

  const [pendingAttributeUpdates, setPendingAttributeUpdates] = useState<Record<string, string>>({});
  const [pendingRelationshipUpdates, setPendingRelationshipUpdates] = useState<Record<string, string>>({});
  const [pendingClarificationAnswers, setPendingClarificationAnswers] = useState<{[key: string]: string}>({});
  
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>('clarify');
  const [mobileView, setMobileView] = useState<MobileView>('editor');

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  
  const introModalRef = useRef<HTMLDivElement>(null);
  const infoModalRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isGenerating) {
        setMobileView('preview');
    }
  }, [isGenerating]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
          document.body.style.backgroundColor = '#111827';
      } else {
          document.documentElement.classList.remove('dark');
          document.body.style.backgroundColor = '#f3f4f6';
      }
  }, [isDarkMode]);

  // Update this version whenever you want the welcome screen to show up again for all users
  const APP_VERSION = '2.0';

  // Check if intro has been shown before
  useEffect(() => {
      // Intentionally not checking localStorage so the welcome screen shows every time
  }, []);

  // Trap focus for Intro Modal
  useEffect(() => {
      if (showIntroModal && introModalRef.current) {
          lastActiveElement.current = document.activeElement as HTMLElement;
          const modal = introModalRef.current;
          const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (firstElement) firstElement.focus();

          const handleTab = (e: KeyboardEvent) => {
              if (e.key === 'Tab') {
                  // If focus somehow escaped the modal, bring it back
                  if (!modal.contains(document.activeElement)) {
                      e.preventDefault();
                      firstElement.focus();
                      return;
                  }

                  if (e.shiftKey) { // Shift + Tab
                      if (document.activeElement === firstElement) {
                          e.preventDefault();
                          lastElement.focus();
                      }
                  } else { // Tab
                      if (document.activeElement === lastElement) {
                          e.preventDefault();
                          firstElement.focus();
                      }
                  }
              }
              if (e.key === 'Escape') {
                  closeIntroModal();
              }
          };

          // Use document listener to catch focus events even if focus is currently outside
          document.addEventListener('keydown', handleTab);
          return () => {
              document.removeEventListener('keydown', handleTab);
              if (lastActiveElement.current) lastActiveElement.current.focus();
          };
      }
  }, [showIntroModal]);

  // Trap focus for Info Modal
  useEffect(() => {
      if (showInfoModal && infoModalRef.current) {
          lastActiveElement.current = document.activeElement as HTMLElement;
          const modal = infoModalRef.current;
          const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (firstElement) firstElement.focus();

          const handleTab = (e: KeyboardEvent) => {
              if (e.key === 'Tab') {
                  if (!modal.contains(document.activeElement)) {
                      e.preventDefault();
                      firstElement.focus();
                      return;
                  }

                  if (e.shiftKey) {
                      if (document.activeElement === firstElement) {
                          e.preventDefault();
                          lastElement.focus();
                      }
                  } else {
                      if (document.activeElement === lastElement) {
                          e.preventDefault();
                          firstElement.focus();
                      }
                  }
              }
              if (e.key === 'Escape') {
                  setShowInfoModal(false);
              }
          };

          document.addEventListener('keydown', handleTab);
          return () => {
              document.removeEventListener('keydown', handleTab);
              if (lastActiveElement.current) lastActiveElement.current.focus();
          };
      }
  }, [showInfoModal]);
  
  // Auto-dismiss mode change popup
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (showModeChangePopup) {
        timer = setTimeout(() => {
            setShowModeChangePopup(false);
        }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showModeChangePopup]);

  const closeIntroModal = () => {
      setShowIntroModal(false);
      localStorage.setItem(`hasSeenProactiveIntro_${APP_VERSION}`, 'true');
  };

  const clearPendingUpdates = () => {
    setPendingAttributeUpdates({});
    setPendingRelationshipUpdates({});
    setPendingClarificationAnswers({});
  };

  const handleStatusUpdate = useCallback((msg: string) => {
    setStatusNotification(msg);
  }, []);

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return;
    analysisRequestIdRef.current += 1;
    generationRequestIdRef.current += 1;
    
    // Check if we have existing analysis data that will become outdated
    const hasAnalysisData = beliefGraph !== null || clarifications.length > 0;

    setMode(newMode);
    setIsGraphLoading(false);
    setIsAttributesLoading(false);
    setIsClarificationsLoading(false);
    setIsGenerating(false);
    setIsUpdatingPrompt(false);
    setStatusNotification(null);
    
    if (hasAnalysisData) setShowModeChangePopup(true);
    
    setRequiresApiKey(false); 
    
    // Set defaults for new mode
    if (newMode === 'video') {
      setAspectRatio('16:9');
      setResolution('720p');
      setSelectedModel('gemini-omni-1.1-flash');
    } else if (newMode === 'image') {
      setAspectRatio('16:9');
      setResolution('1K');
      setSelectedModel('gemini-2.5-flash-image');
    } else {
      setSelectedModel('gemini-flash-latest');
    }
  };

  const getImagesSignature = (imgs: ImagePart[]) => {
      if (imgs.length === 0) return "";
      return `${imgs.length}-${imgs[0].inlineData.data.substring(0, 20)}`;
  };

  const refreshAnalysis = useCallback(async (currentPrompt: string, currentAnsweredQuestions: string[], currentMode: Mode, currentImages: ImagePart[] = [], currentStoryType: StoryType = 'generic', currentClarificationModel: string = 'gemini-3-flash-preview', currentProactiveness: Proactiveness = 'medium', isAugment: boolean = false, graphToAugment?: BeliefState | null) => {
    const requestId = ++analysisRequestIdRef.current;
    const isCurrent = () => modeRef.current === currentMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsGraphLoading(true);
    setIsAttributesLoading(true);
    setIsClarificationsLoading(true);

    let graphPromise;
    const baseGraph = graphToAugment || beliefGraph;
    if (isAugment && baseGraph) {
        graphPromise = updateBeliefGraph(baseGraph, currentPrompt, currentMode, safeStatusUpdate, currentImages, currentStoryType, currentProactiveness, currentClarificationModel);
    } else {
        graphPromise = parsePromptToBeliefGraph(currentPrompt, currentMode, safeStatusUpdate, currentImages, currentStoryType, currentProactiveness, currentClarificationModel);
    }

    graphPromise
        .then(graphStructure => {
            if (isCurrent() && graphStructure) setBeliefGraph(graphStructure);
        })
        .finally(() => {
            if (isCurrent()) {
                setIsGraphLoading(false);
                setIsAttributesLoading(false);
            }
        });

    const clarificationPromise = generateClarifications(currentPrompt, currentAnsweredQuestions, currentMode, safeStatusUpdate, currentImages, currentStoryType, currentClarificationModel, currentProactiveness)
        .then(generatedClarifications => {
            if (isCurrent()) setClarifications(generatedClarifications);
        })
        .finally(() => {
             if (isCurrent()) setIsClarificationsLoading(false);
        });

    if (isCurrent()) {
         setLastAnalyzedPrompt(currentPrompt);
         setLastAnalyzedMode(currentMode);
         setLastAnalyzedImagesSignature(getImagesSignature(currentImages));
    }
    return Promise.all([graphPromise, clarificationPromise]);
  }, [handleStatusUpdate, beliefGraph]);

  const handleRefreshClarifications = useCallback(() => {
    const requestId = ++analysisRequestIdRef.current;
    const requestMode = mode;
    const isCurrent = () => modeRef.current === requestMode && analysisRequestIdRef.current === requestId;
    const safeStatusUpdate = (msg: string) => { if (isCurrent()) handleStatusUpdate(msg); };

    setIsClarificationsLoading(true);
    setPendingClarificationAnswers({});
    setStatusNotification(null);
    
    const currentQuestions = clarifications.map(c => c.question);
    setSkippedQuestions(prev => [...prev, ...currentQuestions]);

    generateClarifications(prompt, [...answeredQuestions, ...skippedQuestions, ...currentQuestions], requestMode, safeStatusUpdate, uploadedImages, storyType, selectedClarificationModel, proactiveness)
        .then(newClarifications => {
            if (isCurrent()) setClarifications(newClarifications);
        })
        .finally(() => {
             if (isCurrent()) setIsClarificationsLoading(false);
        });
  }, [prompt, answeredQuestions, mode, clarifications, skippedQuestions, handleStatusUpdate, uploadedImages, storyType, selectedClarificationModel, proactiveness]);

  const processRequest = useCallback(async (
    currentPrompt: string, 
    currentAnsweredQuestions: string[], 
    currentMode: Mode,
    skipAnalysis: boolean = false,
    skipGeneration: boolean = false,
    currentImages: ImagePart[] = [],
    currentRatio: AspectRatio = '16:9',
    currentResolution: string = '1K',
    currentModel: string = 'gemini-2.5-flash-image',
    currentStoryType: StoryType = 'generic',
    currentClarificationModel: string = 'gemini-3-flash-preview',
    currentProactiveness: Proactiveness = 'medium',
    graphToAugment?: BeliefState | null
  ) => {
    const genRequestId = ++generationRequestIdRef.current;
    const requestMode = currentMode;
    const isGenCurrent = () => modeRef.current === requestMode && generationRequestIdRef.current === genRequestId;
    const safeGenStatusUpdate = (msg: string) => { if (isGenCurrent()) handleStatusUpdate(msg); };

    setGalleryErrors(prev => ({ ...prev, [requestMode]: null }));
    setRequiresApiKey(false);

    if (!skipGeneration) {
        if (requestMode === 'image') setImages([]);
        else if (requestMode === 'story') setStory(null);
        else if (requestMode === 'video') setVideo(null);
        setIsOutdated(false);
    }
    
    setStatusNotification(null);
    setShowModeChangePopup(false);
    
    const isAugment = (graphToAugment !== undefined ? graphToAugment !== null : beliefGraph !== null) && 
                      lastAnalyzedMode === currentMode && 
                      lastAnalyzedImagesSignature === getImagesSignature(currentImages);

    if (!skipAnalysis) {
        if (!isAugment) {
            setBeliefGraph(null); 
        }
        setClarifications([]);
        clearPendingUpdates();
        setSkippedQuestions([]); 
    }
    
    const analysisPromise = !skipAnalysis 
        ? refreshAnalysis(currentPrompt, currentAnsweredQuestions, currentMode, currentImages, currentStoryType, currentClarificationModel, currentProactiveness, isAugment, graphToAugment)
        : Promise.resolve();

    let generationPromise = Promise.resolve();
    if (!skipGeneration) {
        setIsGenerating(true);
        generationPromise = (async () => {
            try {
                if (requestMode === 'image') {
                    const win = window as any;
                    if ((currentModel === 'gemini-3-pro-image-preview' || currentModel === 'gemini-3.1-flash-image-preview') && false) {
                        if (!await win.aistudio.hasSelectedApiKey()) {
                            if (isGenCurrent()) {
                                setRequiresApiKey(true);
                                setIsGenerating(false);
                                return;
                            }
                        }
                    }
                    const generatedImages = await generateImagesFromPrompt(currentPrompt, safeGenStatusUpdate, currentImages, currentRatio, currentModel, currentResolution);
                    if (isGenCurrent()) setImages(generatedImages);
                } else if (requestMode === 'story') {
                    const generatedStory = await generateStoryFromPrompt(currentPrompt, safeGenStatusUpdate, currentImages, currentModel, currentStoryType);
                    if (isGenCurrent()) setStory(generatedStory);
                } else if (requestMode === 'video') {
                    const win = window as any;
                    // For Omni models, check for API key
                    if (false) {
                        if (!await win.aistudio.hasSelectedApiKey()) {
                            if (isGenCurrent()) {
                                setRequiresApiKey(true);
                                setIsGenerating(false);
                                return;
                            }
                        }
                    }
                    const generatedVideo = await generateVideosFromPrompt(currentPrompt, safeGenStatusUpdate, currentImages, currentRatio, currentModel, currentResolution);
                    if (isGenCurrent()) setVideo(generatedVideo);
                }
            } catch (error: any) {
                if (isGenCurrent()) {
                    let userFriendlyError = error.message || "Failed to generate.";
                    
                    // Handle API key issues
                    if (userFriendlyError.includes("Requested entity was not found") || 
                        userFriendlyError.includes("API_KEY_INVALID") ||
                        userFriendlyError.includes("invalid api key")) {
                        setRequiresApiKey(true);
                        userFriendlyError = "Please select a valid API key to continue.";
                    } else if (userFriendlyError.includes("429") || userFriendlyError.includes("RESOURCE_EXHAUSTED")) {
                        userFriendlyError = "API Quota exceeded. Please check your billing account or try again later.";
                    }
                    
                    setGalleryErrors(prev => ({ ...prev, [requestMode]: userFriendlyError }));
                }
            } finally {
                if (isGenCurrent()) {
                    setIsGenerating(false);
                }
            }
        })();
    }
    
    await Promise.all([analysisPromise, generationPromise]).finally(() => {
        if (isGenCurrent()) {
            setStatusNotification(null);
        }
    });
  }, [refreshAnalysis, handleStatusUpdate, beliefGraph, lastAnalyzedMode, lastAnalyzedImagesSignature]);

  const handlePromptSubmit = useCallback(async () => {
    setHasGenerated(true);
    const qaPairs = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({question: q, answer: a as string}));
    const graphUpdates: GraphUpdate[] = [];
    Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
        const [entity, attribute] = key.split(':');
        graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
    });
    Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
        const [source, target] = key.split(':');
        const originalRel = beliefGraph?.relationships.find(r => r.source === source && r.target === target);
        if (originalRel) graphUpdates.push({ type: 'relationship', source, target, oldLabel: originalRel.label, newLabel: value as string });
    });

    let targetPrompt = prompt;
    let targetAnsweredQuestions = [...answeredQuestions];
    let shouldSkipAnalysis = false;

    if (qaPairs.length > 0 || graphUpdates.length > 0) {
        setIsUpdatingPrompt(true);
        try {
            const refinedPrompt = await refinePromptWithAllUpdates(prompt, qaPairs, graphUpdates, handleStatusUpdate, proactiveness);
            setProposedPromptState({
                text: refinedPrompt,
                qaPairs,
                graphUpdates,
                newAnsweredQuestions: [...answeredQuestions, ...qaPairs.map(a => a.question)],
                action: 'generate'
            });
        } finally {
            setIsUpdatingPrompt(false);
        }
    } else {
        const currentImagesSignature = getImagesSignature(uploadedImages);
        shouldSkipAnalysis = prompt === lastAnalyzedPrompt && mode === lastAnalyzedMode && currentImagesSignature === lastAnalyzedImagesSignature;
        processRequest(targetPrompt, targetAnsweredQuestions, mode, shouldSkipAnalysis, false, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, proactiveness);
    }
  }, [prompt, mode, lastAnalyzedPrompt, lastAnalyzedMode, lastAnalyzedImagesSignature, answeredQuestions, pendingClarificationAnswers, pendingAttributeUpdates, pendingRelationshipUpdates, beliefGraph, processRequest, handleStatusUpdate, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, proactiveness]);

  const handleAnalyzeOnly = useCallback(async () => {
     setHasGenerated(true);
     const hasPendingUpdates = Object.keys(pendingClarificationAnswers).length > 0 || 
                               Object.keys(pendingAttributeUpdates).length > 0 || 
                               Object.keys(pendingRelationshipUpdates).length > 0;
     
     if (hasPendingUpdates) {
         if (isUpdatingPrompt) return;
         setIsUpdatingPrompt(true);
         const qaPairs = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({question: q, answer: a as string}));
         const graphUpdates: GraphUpdate[] = [];
         Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
             const [entity, attribute] = key.split(':');
             graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
         });
         Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
             const [source, target] = key.split(':');
             const originalRel = beliefGraph?.relationships.find(r => r.source === source && r.target === target);
             if (originalRel) graphUpdates.push({ type: 'relationship', source, target, oldLabel: originalRel.label, newLabel: value as string });
         });

         const newAnsweredQuestions = [...answeredQuestions, ...qaPairs.map(a => a.question)];

         try {
             const newRefinedPrompt = await refinePromptWithAllUpdates(prompt, qaPairs, graphUpdates, handleStatusUpdate, proactiveness);
             setProposedPromptState({
                 text: newRefinedPrompt,
                 qaPairs,
                 graphUpdates,
                 newAnsweredQuestions,
                 action: 'analyze'
             });
         } finally {
             setIsUpdatingPrompt(false);
         }
     } else {
         setAnsweredQuestions([]);
         setClarifications([]);
         processRequest(prompt, [], mode, false, true, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, proactiveness);
     }
  }, [prompt, mode, processRequest, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, pendingClarificationAnswers, pendingAttributeUpdates, pendingRelationshipUpdates, isUpdatingPrompt, answeredQuestions, beliefGraph, handleStatusUpdate, clearPendingUpdates, proactiveness]);

  const handleSelectApiKey = async () => {
      const win = window as any;
      if (win.aistudio?.openSelectKey) {
          await win.aistudio.openSelectKey();
          setRequiresApiKey(false);
      }
  };

  const handleApplyAllUpdates = async () => {
    if (isUpdatingPrompt) return;
    setIsUpdatingPrompt(true);
    const qaPairs = Object.entries(pendingClarificationAnswers).map(([q, a]) => ({question: q, answer: a as string}));
    const graphUpdates: GraphUpdate[] = [];
    Object.entries(pendingAttributeUpdates).forEach(([key, value]) => {
        const [entity, attribute] = key.split(':');
        graphUpdates.push({ type: 'attribute', entity, attribute, value: value as string });
    });
    Object.entries(pendingRelationshipUpdates).forEach(([key, value]) => {
        const [source, target] = key.split(':');
        const originalRel = beliefGraph?.relationships.find(r => r.source === source && r.target === target);
        if (originalRel) graphUpdates.push({ type: 'relationship', source, target, oldLabel: originalRel.label, newLabel: value as string });
    });

    const newAnsweredQuestions = [...answeredQuestions, ...qaPairs.map(a => a.question)];

    try {
        const newRefinedPrompt = await refinePromptWithAllUpdates(prompt, qaPairs, graphUpdates, handleStatusUpdate, proactiveness);
        setProposedPromptState({
            text: newRefinedPrompt,
            qaPairs,
            graphUpdates,
            newAnsweredQuestions,
            action: 'apply'
        });
    } finally {
        setIsUpdatingPrompt(false);
    }
  };

  const handleAcceptProposedPrompt = (editedPrompt: string) => {
      if (!proposedPromptState) return;
      const { newAnsweredQuestions, action, graphUpdates } = proposedPromptState;
      setPrompt(editedPrompt);
      setAnsweredQuestions(newAnsweredQuestions);
      setIsOutdated(true);
      
      let updatedGraph = beliefGraph ? JSON.parse(JSON.stringify(beliefGraph)) : null;
      if (updatedGraph && graphUpdates && graphUpdates.length > 0) {
          graphUpdates.forEach(update => {
              if (update.type === 'attribute') {
                  const entity = updatedGraph.entities.find((e: any) => e.name === update.entity);
                  if (entity) {
                      const attr = entity.attributes.find((a: any) => a.name === update.attribute);
                      if (attr) {
                          attr.value = [{ name: update.value }];
                          attr.presence_in_prompt = true;
                      }
                      entity.presence_in_prompt = true;
                  }
              } else if (update.type === 'relationship') {
                  const rel = updatedGraph.relationships.find((r: any) => r.source === update.source && r.target === update.target);
                  if (rel) {
                      rel.label = update.newLabel;
                      rel.presence_in_prompt = true;
                  }
              }
          });
          setBeliefGraph(updatedGraph);
      }

      clearPendingUpdates();
      setProposedPromptState(null);
      
      if (action === 'analyze') {
          processRequest(editedPrompt, newAnsweredQuestions, mode, false, true, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, proactiveness, updatedGraph);
      } else if (action === 'apply') {
          refreshAnalysis(editedPrompt, newAnsweredQuestions, mode, uploadedImages, storyType, selectedClarificationModel, proactiveness, true, updatedGraph);
      } else if (action === 'generate') {
          processRequest(editedPrompt, newAnsweredQuestions, mode, false, false, uploadedImages, aspectRatio, resolution, selectedModel, storyType, selectedClarificationModel, proactiveness, updatedGraph);
      }
  };

  const handleRejectProposedPrompt = () => {
      setProposedPromptState(null);
  };

  const handleUseAsReference = useCallback((imageDataUrl: string) => {
    try {
      // Data URLs are like: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
      const [header, data] = imageDataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
      
      const newImage: ImagePart = {
        inlineData: {
          data,
          mimeType
        }
      };
      
      setUploadedImages(prev => [...prev, newImage]);
      setMobileView('editor'); // Switch to editor so the user sees the new reference
      handleStatusUpdate("Image added as reference.");
      setTimeout(() => setStatusNotification(prev => prev === "Image added as reference." ? null : prev), 3000);
    } catch (e) {
      console.error("Failed to parse image data URL", e);
    }
  }, [handleStatusUpdate]);

  const handleApplyStoryToPrompt = useCallback(() => {
    if (story) {
        setPrompt(story);
        setMobileView('editor');
        handleStatusUpdate("Story applied to prompt.");
        setTimeout(() => setStatusNotification(prev => prev === "Story applied to prompt." ? null : prev), 3000);
    }
  }, [story, handleStatusUpdate]);
  
  const ToolTabButton = ({ label, tab, current }: { label: string, tab: ToolTab, current: ToolTab }) => (
      <button 
        onClick={() => setActiveToolTab(tab)}
        className={`flex-1 py-2 text-[12px] font-normal text-center transition-colors relative z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 focus-visible:ring-inset rounded-t-sm ${current === tab ? 'text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700'}`}
      >
        {label}
      </button>
  );

  const totalUpdateCount = Object.keys(pendingClarificationAnswers).length + Object.keys(pendingAttributeUpdates).length + Object.keys(pendingRelationshipUpdates).length;

  const isBannerVisible = isUpdatingPrompt || statusNotification;

  return (
    <div className={`${isDarkMode ? 'dark' : ''} font-sans fixed inset-0 flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-200 overflow-hidden`}>
        <Header 
            isDarkMode={isDarkMode} 
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
            onShowInfo={() => setShowInfoModal(true)}
            isLoading={isGenerating || isUpdatingPrompt || isGraphLoading || isClarificationsLoading}
            mode={mode}
        />

        {isBannerVisible && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] animate-fade-in-down px-4 w-full max-w-md" role="status" aria-live="polite">
                <div className="bg-amber-100 dark:bg-amber-900/90 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-sm">
                    {isUpdatingPrompt ? (
                        <svg className="animate-spin h-5 w-5 text-amber-600 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1-1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    )}
                    <span className="text-sm font-medium flex-1">{isUpdatingPrompt ? "Refining prompt..." : statusNotification}</span>
                    {!isUpdatingPrompt && <button onClick={() => setStatusNotification(null)} className="ml-auto text-amber-600 dark:text-amber-300 p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500" aria-label="Close notification"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
            </div>
        )}

        {showModeChangePopup && !statusNotification && !isUpdatingPrompt && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] animate-fade-in-down px-4 w-full max-w-md" role="alert">
                <div className="bg-blue-100 dark:bg-blue-900/90 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 backdrop-blur-sm relative">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 pr-6">
                        <p className="text-sm font-bold">Switched to {mode === 'image' ? 'Image' : (mode === 'video' ? 'Video' : 'Story')} Mode</p>
                        <p className="text-xs mt-1">
                            Clarifications, graph and attributes are from the previous mode. Click <span className="font-bold italic">Refine prompt</span> again to update them for {mode === 'image' ? 'images' : (mode === 'video' ? 'videos' : 'stories')}.
                        </p>
                    </div>
                    <button onClick={() => setShowModeChangePopup(false)} className="absolute top-3 right-3 text-blue-600 dark:text-blue-300 p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        )}

        <main className="flex-1 flex flex-col w-full max-w-screen-2xl mx-auto sm:px-4 sm:py-2 overflow-hidden min-h-0 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] sm:pb-0">
            <div className="flex-1 flex flex-col sm:grid sm:grid-cols-2 sm:gap-4 min-h-0">
            {/* Left Panel: Prompt + Tools. Scrollable vertically. */}
            <div className={`flex flex-col gap-0 bg-white dark:bg-gray-800 sm:rounded-lg sm:border border-gray-200 dark:border-gray-700 shadow-sm ${mobileView === 'editor' ? 'flex flex-1' : 'hidden sm:flex'} h-full overflow-y-auto relative`}>
                
                <div className="relative flex-shrink-0 bg-white dark:bg-gray-800 z-50">
                    <PromptInput
                        prompt={prompt}
                        setPrompt={setPrompt}
                        onSubmit={handlePromptSubmit}
                        onAnalyze={handleAnalyzeOnly}
                        isLoading={isGenerating || isUpdatingPrompt}
                        isGenerating={isGenerating}
                        isAnalyzing={isGraphLoading || isClarificationsLoading}
                        isFirstRun={!hasGenerated}
                        mode={mode}
                        setMode={handleModeChange}
                        uploadedImages={uploadedImages}
                        setUploadedImages={setUploadedImages}
                        pendingAttributeUpdates={pendingAttributeUpdates}
                        pendingRelationshipUpdates={pendingRelationshipUpdates}
                        aspectRatio={aspectRatio}
                        setAspectRatio={setAspectRatio}
                        resolution={resolution}
                        setResolution={setResolution}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        selectedClarificationModel={selectedClarificationModel}
                        setSelectedClarificationModel={setSelectedClarificationModel}
                        storyType={storyType}
                        setStoryType={setStoryType}
                        proactiveness={proactiveness}
                        setProactiveness={setProactiveness}
                    />
                </div>

                <div className="z-30 flex flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 justify-between items-center pr-2 shadow-sm sticky top-0">
                    <div className="flex flex-1">
                        <ToolTabButton label="Clarifications" tab="clarify" current={activeToolTab} />
                        <ToolTabButton label="Belief Graph" tab="graph" current={activeToolTab} />
                        <ToolTabButton label={mode === 'image' ? 'Image Attributes' : (mode === 'video' ? 'Video Attributes' : 'Story Attributes')} tab="attributes" current={activeToolTab} />
                    </div>
                </div>

                {/* Content Area */}
                <div className="relative bg-gray-50/30 dark:bg-gray-900/30 flex flex-col w-full flex-1 min-h-0">
                    {totalUpdateCount > 0 && (
                        <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 p-2 flex justify-between items-center animate-fade-in z-20 gap-2">
                            <div className="text-xs md:text-sm text-blue-800 dark:text-blue-200 font-bold flex items-center gap-1.5 flex-1 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span className="truncate">{totalUpdateCount} pending change{totalUpdateCount !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button 
                                    onClick={clearPendingUpdates} 
                                    disabled={isUpdatingPrompt}
                                    className={`text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${isUpdatingPrompt ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Cancel changes
                                </button>
                                <button 
                                    onClick={handleApplyAllUpdates} 
                                    disabled={isUpdatingPrompt || isGenerating} 
                                    title={isGenerating ? "Cannot update prompt while generation is in progress" : undefined}
                                    className={`bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-normal py-1 px-3 rounded-md shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${(isUpdatingPrompt || isGenerating) ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'}`}
                                >
                                    {isUpdatingPrompt ? "Updating..." : (
                                        <>
                                            <span className="sm:hidden">Update</span>
                                            <span className="hidden sm:inline">Update prompt</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                    <div className={`w-full ${activeToolTab === 'clarify' ? 'flex flex-col flex-1 min-h-[250px] md:min-h-[450px]' : 'hidden'}`}>
                        <ClarificationCard 
                            clarifications={clarifications} 
                            onRefresh={handleRefreshClarifications} 
                            isLoading={isClarificationsLoading} 
                            pendingAnswers={pendingClarificationAnswers} 
                            setPendingAnswers={setPendingClarificationAnswers} 
                            prompt={prompt} 
                        />
                    </div>
                    <div className={`w-full ${activeToolTab !== 'clarify' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}`}>
                        {/* 
                            For Graph and Attributes, we use flex-1 to fill the remaining space.
                            Reduced min-h to 250px to better accommodate small landscape devices.
                        */}
                        <div className={`w-full flex flex-col relative flex-1 min-h-[250px] md:min-h-[450px]`}>
                            <BeliefGraph 
                                data={beliefGraph} 
                                isLoading={isGraphLoading} 
                                mode={mode} 
                                view={activeToolTab === 'attributes' ? 'attributes' : 'graph'} 
                                isVisible={activeToolTab !== 'clarify'} 
                                pendingAttributeUpdates={pendingAttributeUpdates} 
                                setPendingAttributeUpdates={setPendingAttributeUpdates} 
                                pendingRelationshipUpdates={pendingRelationshipUpdates} 
                                setPendingRelationshipUpdates={setPendingRelationshipUpdates} 
                                pendingClarificationCount={Object.keys(pendingClarificationAnswers).length} 
                                currentPrompt={prompt} 
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className={`flex flex-col sm:flex ${mobileView === 'preview' ? 'flex' : 'hidden sm:flex'} flex-1 h-full min-h-0 sm:pb-0`}>
                <OutputDisplay images={images} story={story} video={video} mode={mode} isLoading={isGenerating} error={galleryErrors[mode]} isOutdated={isOutdated} requiresApiKey={requiresApiKey} onSelectKey={handleSelectApiKey} aspectRatio={aspectRatio} onUseAsReference={handleUseAsReference} onApplyToPrompt={handleApplyStoryToPrompt} />
            </div>
            </div>
        </main>

        <div className="sm:hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 flex justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[200] fixed bottom-0 left-0 right-0 h-auto min-h-[3.5rem]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex w-full max-sm:max-w-sm h-14">
                <button 
                    onClick={() => setMobileView('editor')} 
                    className={`flex-1 flex flex-col items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        mobileView === 'editor' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-[11px] font-normal uppercase tracking-tight">Editor</span>
                </button>
                <button 
                    onClick={() => setMobileView('preview')} 
                    className={`flex-1 flex flex-col items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        mobileView === 'preview' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[11px] font-normal uppercase tracking-tight">Preview</span>
                </button>
            </div>
        </div>
        
        {showIntroModal && (
            <div className="fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="intro-modal-title">
                <div 
                    ref={introModalRef}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[90vh] outline-none"
                    tabIndex={-1}
                >
                    {/* ... Intro Content ... */}
                    <div className="text-center mb-6">
                        <h2 id="intro-modal-title" className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">Proactive Co-Creator</h2>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Your Intelligent Creative Partner</p>
                    </div>

                    <div className="space-y-5 mb-8">
                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">1. Visualize Interpretation</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                    The AI proactively maps your prompt into a <strong>Belief Graph</strong> and asks questions to reveal its hidden assumptions.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">2. Align Intent</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                    Edit the graph or answer questions to correct the AI. Click <strong>Update Prompt</strong> to sync your vision.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">3. Create</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                    Generate <strong>Images</strong>, <strong>Stories</strong>, or <strong>Videos</strong> with an AI that truly understands you.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={closeIntroModal}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-normal py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                        >
                            Start Creating
                        </button>
                        <a 
                            href="https://zi-wang.com/human-ai/" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="w-full text-center text-sm font-normal text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 py-2 transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                        >
                            Learn about our research
                        </a>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed text-left">
                            This app is intended for research. The AI is your creative partner, but it isn't perfect. Its interpretations, belief graphs, and clarifications are generated dynamically and may contain inaccuracies.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {showInfoModal && (
            <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowInfoModal(false)} role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
                <div 
                    ref={infoModalRef}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[90vh] outline-none" 
                    onClick={e => e.stopPropagation()}
                    tabIndex={-1}
                >
                    {/* ... Info Content ... */}
                    <button onClick={() => setShowInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded" aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    
                    <div className="text-center mb-6">
                        <h2 id="info-modal-title" className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Proactive Co-Creator</h2>
                        <p className="text-gray-600 dark:text-gray-400">An Intelligent Multi-Modal Creative Partner</p>
                    </div>

                    <div className="mb-6 text-left space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-2">How it works</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Start with a prompt or image. The AI maps your idea into a <strong>Belief Graph</strong>, revealing hidden details. 
                        </p>
                        <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400 list-disc pl-4 marker:text-blue-500">
                            <li>Click <strong>nodes</strong> (circles) or <strong>edges</strong> (lines) to edit specific details.</li>
                            <li>Answer <strong>clarifying questions</strong> to resolve ambiguities.</li>
                            <li>Click <strong>Update Prompt</strong> to apply your changes before generating.</li>
                            <li>Switch modes (Image/Story/Video) for different outputs.</li>
                        </ul>
                    </div>

                    <div className="flex gap-3 mb-8">
                        <a href="https://zi-wang.com/human-ai/" target="_blank" rel="noreferrer" className="flex-1 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center transition-colors group focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <div className="flex items-center justify-center gap-2 mb-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                <span className="font-bold text-sm">Our Research</span>
                            </div>
                            <div className="text-[10px] opacity-80 group-hover:underline">Human-AI Alignment</div>
                        </a>
                        <a href="https://zi-wang.com/co-creator-feedback/" target="_blank" rel="noreferrer" className="flex-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <div className="flex items-center justify-center gap-2 mb-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                <span className="font-bold text-sm">Give Feedback</span>
                            </div>
                            <div className="text-[10px] opacity-80 group-hover:underline">Help us improve</div>
                        </a>
                    </div>

                    <div className="mb-6 text-left">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-2 mb-4">Pro Workflow</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Image Mode</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Visualize your concept. Generate an image and click <strong>"Use as Reference"</strong>.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Story Mode (Video Description)</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Switch to <strong>"Video"</strong> type in settings. Generate a cinematic description and copy it.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Video Mode</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Paste the description. Use the reference image. Generate your video.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                        <button 
                            onClick={() => {
                                setShowInfoModal(false);
                                setShowIntroModal(true);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                            View Welcome Screen
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Questions? Reach out to <a href="https://zi-wang.com" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Zi Wang</a>.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {proposedPromptState && (
            <ReviewPromptModal
                originalPrompt={prompt}
                proposedPrompt={proposedPromptState.text}
                onAccept={handleAcceptProposedPrompt}
                onReject={handleRejectProposedPrompt}
            />
        )}
    </div>
  );
}

export default App;
