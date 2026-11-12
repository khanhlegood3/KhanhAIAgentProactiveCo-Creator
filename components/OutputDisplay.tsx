
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { GeneratedImage } from '../types';

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface OutputDisplayProps {
  images: GeneratedImage[];
  story: string | null;
  video: string | null;
  mode: 'image' | 'story' | 'video';
  isLoading: boolean;
  error: string | null;
  isOutdated: boolean;
  requiresApiKey?: boolean;
  onSelectKey?: () => void;
  aspectRatio?: string;
  onUseAsReference?: (imageDataUrl: string) => void;
  onApplyToPrompt?: () => void;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ 
    images, 
    story, 
    video, 
    mode, 
    isLoading, 
    error, 
    isOutdated,
    requiresApiKey,
    onSelectKey,
    aspectRatio,
    onUseAsReference,
    onApplyToPrompt
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showApplyConfirmation, setShowApplyConfirmation] = useState(false);
  const modalCloseButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const placeholderCount = 4;
  
  // Trap focus for Lightbox
  useEffect(() => {
    if (selectedImage && lightboxRef.current) {
        lastActiveElement.current = document.activeElement as HTMLElement;
        const modal = lightboxRef.current;
        // Focus first button (Close)
        if (modalCloseButtonRef.current) modalCloseButtonRef.current.focus();

        const handleTab = (e: KeyboardEvent) => {
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.key === 'Tab') {
                if (!modal.contains(document.activeElement)) {
                    e.preventDefault();
                    if (firstElement) firstElement.focus();
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
                setSelectedImage(null);
            }
        };

        document.addEventListener('keydown', handleTab);
        return () => {
            document.removeEventListener('keydown', handleTab);
            if (lastActiveElement.current) lastActiveElement.current.focus();
        };
    }
  }, [selectedImage]);

  // Trap focus for Confirmation
  useEffect(() => {
    if (showApplyConfirmation && confirmationRef.current) {
        lastActiveElement.current = document.activeElement as HTMLElement;
        const modal = confirmationRef.current;
        // Focus cancel button
        if (confirmationCloseButtonRef.current) confirmationCloseButtonRef.current.focus();

        const handleTab = (e: KeyboardEvent) => {
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.key === 'Tab') {
                if (!modal.contains(document.activeElement)) {
                    e.preventDefault();
                    if (firstElement) firstElement.focus();
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
                setShowApplyConfirmation(false);
            }
        };

        document.addEventListener('keydown', handleTab);
        return () => {
            document.removeEventListener('keydown', handleTab);
            if (lastActiveElement.current) lastActiveElement.current.focus();
        };
    }
  }, [showApplyConfirmation]);

  const downloadStory = () => {
    if (!story) return;
    const fileName = "generated_story.txt";
    const element = document.createElement("a");
    const file = new Blob([story], {type: 'text/plain'});
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const copyStory = () => {
      if (!story) return;
      navigator.clipboard.writeText(story);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  const handleConfirmApply = () => {
      if (onApplyToPrompt) {
          onApplyToPrompt();
      }
      setShowApplyConfirmation(false);
  };

  const renderImageContent = () => {
      if (isLoading) {
          return Array(placeholderCount).fill(null).map((_, index) => (
              <div key={index} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                      <svg className="animate-spin h-8 w-8 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="mt-2 text-sm text-center px-4">Generating images... This may take a few seconds.</span>
                  </div>
              </div>
          ));
      }

      if (images.length > 0) {
          const content = images.map((image, index) => {
              if (image.url) {
                  return (
                      <button 
                        key={index} 
                        className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative shadow-sm border border-gray-200 dark:border-gray-700 group cursor-zoom-in focus:outline-none focus:ring-4 focus:ring-blue-500"
                        onClick={() => setSelectedImage(image.url)}
                        aria-label={`Preview generated image ${index + 1}`}
                      >
                          <img src={image.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </button>
                  );
              } else {
                  return (
                     <div key={index} className="aspect-square bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 text-center p-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                         </svg>
                         <span className="text-xs font-semibold">Generation Failed</span>
                         {image.error && <span className="text-[10px] mt-1 text-red-400 line-clamp-3">{image.error}</span>}
                     </div>
                  );
              }
          });
          
          while (content.length < 4) {
             content.push(
                 <div key={`missing-${content.length}`} className="aspect-square bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                     </svg>
                     <span className="text-xs">Generation Failed</span>
                 </div>
             );
          }
          return content;
      }

      return Array(placeholderCount).fill(null).map((_, index) => (
          <div key={index} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
          </div>
      ));
  };

  const renderVideoContent = () => {
    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                 <svg className="animate-spin h-8 w-8 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="mt-2 text-sm">Generating video... This may take a few minutes.</span>
            </div>
        );
    }
    if (video) {
        const isPortrait = aspectRatio === '9:16';
        return (
            <div className="flex flex-col items-center justify-start min-h-full w-full p-2 sm:p-4">
                <div className={`w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 relative group shrink-0 ${isPortrait ? 'max-w-[400px]' : ''}`}>
                     <video controls className="w-full h-auto max-h-[75vh]" src={video} autoPlay loop muted>
                        Your browser does not support the video tag.
                     </video>
                </div>
                <div className="flex gap-4 mt-6">
                    <a 
                        href={video} 
                        download="generated-video.mp4" 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download MP4
                    </a>
                </div>
            </div>
        )
    }
    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">Your generated video will appear here.</p>
        </div>
    );
  };

  const renderStoryContent = () => {
      if (isLoading) {
          return (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                   <svg className="animate-spin h-8 w-8 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="mt-2 text-sm">Writing story... This may take a few seconds.</span>
              </div>
          );
      }
      if(story) {
          return (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                  {story.split('\n').map((paragraph, index) => <p key={index} className="text-gray-800 dark:text-gray-200">{paragraph}</p>)}
              </div>
          )
      }
      return (
        <div className="h-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">Your creative story will appear here.</p>
        </div>
      );
  };
  
  const renderError = (errorMessage: string) => (
      <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
          {errorMessage.split('\n').map((paragraph, index) => (
              <p key={index} className="text-red-700 dark:text-red-300">{paragraph}</p>
          ))}
      </div>
  );
  
  if (requiresApiKey) {
      const modelName = mode === 'image' ? 'Nano Banana 2 or Nano Banana Pro' : 'Gemini Omni Flash';
      return (
         <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-full border border-gray-200 dark:border-gray-700 flex flex-col relative overflow-hidden transition-colors duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex-shrink-0">
                 <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{mode === 'image' ? 'Image Generation' : 'Video Generation'}</h2>
            </div>
            <div className="h-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg flex flex-col items-center justify-center p-8 text-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.543 17.543A2 2 0 0110.129 18H9a2 2 0 01-2-2v-1a2 2 0 01.586-1.414l5.223-5.223A2 2 0 0014 9a2 2 0 012-2z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Billing Account Required</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm max-w-sm mb-6">
                    Generating with {modelName} requires a paid API Key from Google Cloud. Please select a key to continue.
                    <br/>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline mt-2 inline-block">Learn more about billing</a>
                </p>
                <button 
                    onClick={onSelectKey}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-md flex items-center gap-2"
                >
                    <span>Select API Key</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>
            </div>
         </div>
      );
  }

  const firstImageError = mode === 'image' ? images.find(img => img.error)?.error : null;
  const displayError = error || firstImageError;

  return (
    <>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 h-full border border-gray-200 dark:border-gray-700 flex flex-col relative overflow-hidden transition-colors duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    {mode === 'image' ? 'Image Generation' : (mode === 'video' ? 'Video Generation' : 'Creative Writing')}
                </h2>
                {mode === 'story' && story && !isLoading && (
                    <div className="flex gap-2">
                         {onApplyToPrompt && (
                            <div className="relative group">
                                <button 
                                    onClick={() => setShowApplyConfirmation(true)} 
                                    className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded peer" 
                                    aria-label="Use as Prompt"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                </button>
                                <span className="absolute top-full right-0 mt-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 peer-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">Use as Prompt</span>
                            </div>
                        )}
                        <div className="relative group">
                            <button 
                                onClick={copyStory} 
                                className={`p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded peer ${isCopied ? 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300' : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'}`} 
                                aria-label={isCopied ? "Copied!" : "Copy to Clipboard"}
                            >
                                {isCopied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                            <span className="absolute top-full right-0 mt-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 peer-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">{isCopied ? "Copied!" : "Copy to Clipboard"}</span>
                        </div>
                        <div className="relative group">
                            <button 
                                onClick={downloadStory} 
                                className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded peer" 
                                aria-label="Download Text"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                            <span className="absolute top-full right-0 mt-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 peer-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">Download Text</span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex-grow min-h-0 relative">
                {displayError ? (
                    <div className="absolute inset-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-600">
                        {renderError(displayError)}
                    </div>
                ) : (
                    mode === 'image' 
                    ? (
                        <div className="absolute inset-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                                {renderImageContent()}
                            </div>
                        </div>
                    )
                    : (mode === 'video' ? (
                         <div className="absolute inset-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {renderVideoContent()}
                        </div>
                    ) : (
                        <div className="absolute inset-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {renderStoryContent()}
                        </div>
                    ))
                )}
                
                {isOutdated && !isLoading && !requiresApiKey && (images.length > 0 || story || video) && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-lg transition-all duration-300 pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 text-center transform scale-100 pointer-events-auto">
                            <div className="text-amber-500 mb-2 flex justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">Results Outdated</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Prompt has changed.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {selectedImage && (
            <div ref={lightboxRef} className="fixed inset-0 z-[2000] bg-black/95 flex flex-col backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedImage(null)} role="dialog" aria-modal="true" aria-label="Image Preview" tabIndex={-1}>
                <button 
                    ref={modalCloseButtonRef}
                    onClick={() => setSelectedImage(null)}
                    className="fixed top-4 right-4 z-[2010] text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Close Preview"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <div className="m-auto w-full max-w-7xl flex flex-col p-4 md:p-8 pointer-events-none">
                    <img 
                        src={selectedImage} 
                        alt="Full view" 
                        className="w-auto h-auto max-w-full object-contain rounded-lg shadow-2xl pointer-events-auto mx-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="mt-6 flex flex-wrap justify-center gap-4 pointer-events-auto flex-shrink-0 bg-black/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 mx-auto" onClick={(e) => e.stopPropagation()}>
                        {onUseAsReference && (
                          <button 
                              onClick={() => {
                                onUseAsReference(selectedImage);
                                setSelectedImage(null);
                              }}
                              className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Use as Reference
                          </button>
                        )}
                        <a 
                            href={selectedImage} 
                            download="generated-image.jpg"
                            className="bg-white text-gray-900 px-5 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg text-sm focus:outline-none focus:ring-2 focus:ring-white"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </a>
                    </div>
                </div>
            </div>
        )}

        {showApplyConfirmation && (
            <div ref={confirmationRef} className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowApplyConfirmation(false)} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" tabIndex={-1}>
                <div 
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative border border-gray-200 dark:border-gray-700 transform transition-all scale-100" 
                    onClick={e => e.stopPropagation()}
                >
                    <h3 id="confirm-modal-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Replace Prompt?</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                        This will replace your current prompt with the generated story text. <span className="font-semibold text-red-500 dark:text-red-400">This action cannot be undone.</span>
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button 
                            ref={confirmationCloseButtonRef}
                            onClick={() => setShowApplyConfirmation(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmApply}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Yes, Replace
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default OutputDisplay;
