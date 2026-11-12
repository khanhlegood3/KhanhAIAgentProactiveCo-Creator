
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from './Tooltip';
import { ImagePart, AspectRatio, StoryType, Proactiveness } from '../types';
import { WrenchIcon } from './icons';
import { useFocusTrap } from '../hooks/useFocusTrap';

// List of MIME types officially supported by Gemini Vision models
const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif'
];

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: () => void;
  onAnalyze: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  isAnalyzing?: boolean;
  isFirstRun: boolean;
  mode: 'image' | 'story' | 'video';
  setMode: (mode: 'image' | 'story' | 'video') => void;
  uploadedImages: ImagePart[];
  setUploadedImages: (imgs: ImagePart[]) => void;
  pendingAttributeUpdates?: Record<string, string>;
  pendingRelationshipUpdates?: Record<string, string>;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  resolution: string;
  setResolution: (res: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedClarificationModel: string;
  setSelectedClarificationModel: (model: string) => void;
  storyType: StoryType;
  setStoryType: (type: StoryType) => void;
  proactiveness: Proactiveness;
  setProactiveness: (proactiveness: Proactiveness) => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ 
  prompt, 
  setPrompt, 
  onSubmit, 
  onAnalyze,
  isLoading, 
  isGenerating, 
  isAnalyzing = false,
  isFirstRun, 
  mode, 
  setMode,
  uploadedImages, 
  setUploadedImages,
  pendingAttributeUpdates = {},
  pendingRelationshipUpdates = {},
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  selectedModel,
  setSelectedModel,
  selectedClarificationModel,
  setSelectedClarificationModel,
  storyType,
  setStoryType,
  proactiveness,
  setProactiveness,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const infoModalRef = useFocusTrap(isInfoModalOpen);
  const disclaimerModalRef = useFocusTrap(showDisclaimerModal);

  const handleUploadClick = () => {
    if (!hasAcceptedDisclaimer) {
      setShowDisclaimerModal(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleAcceptDisclaimer = () => {
    setHasAcceptedDisclaimer(true);
    setShowDisclaimerModal(false);
    // Use setTimeout to ensure the modal closes before opening the file dialog
    setTimeout(() => {
        fileInputRef.current?.click();
    }, 0);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  const getModelOptions = () => {
    switch (mode) {
      case 'image':
        return [
          { value: 'gemini-2.5-flash-image', label: 'Nano Banana' },
          { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2' },
          { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro' },
          { value: 'imagen-4.0-generate-001', label: 'Imagen 4' },
        ];
      case 'video':
        return [
          { value: 'gemini-omni-1.1-flash', label: 'Gemini Omni Flash' },
        ];
      case 'story':
      default:
        return [
          { value: 'gemini-flash-latest', label: 'Flash' },
          { value: 'gemini-3.1-flash-lite-preview', label: 'Flash Lite' },
          { value: 'gemini-3.1-pro-preview', label: 'Pro' },
        ];
    }
  };

  const getResolutionOptions = () => {
    if (mode === 'video') {
      return ['720p', '1080p'];
    }
    if (mode === 'image') {
      return ['512px', '1K', '2K', '4K'];
    }
    return [];
  };

  const showResolutionSelector = mode === 'video' || mode === 'image';

  const hasUpdates = Object.keys(pendingAttributeUpdates).length > 0 || Object.keys(pendingRelationshipUpdates).length > 0;
  const generateTooltipText = `Generate ${mode === 'story' ? 'a story' : (mode === 'video' ? 'a video' : 'images')} based on your prompt${hasUpdates ? ' and updates' : ''}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages: ImagePart[] = [];
      let pendingReads = files.length;
      
      Array.from(files).forEach((file: File) => {
          if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
            alert(`Unsupported image type: ${file.type}. Please upload a JPEG, PNG, WEBP, or HEIC file.`);
            pendingReads--;
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            newImages.push({
              inlineData: {
                data: base64,
                mimeType: file.type
              }
            });
            pendingReads--;
            if (pendingReads === 0) {
                 setUploadedImages([...uploadedImages, ...newImages]);
            }
          };
          reader.readAsDataURL(file);
      });

      // Reset input value to allow selecting the same file again immediately
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
      setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white dark:bg-gray-800 flex flex-col transition-colors duration-200">
      {/* Header with Title and Mode Selection */}
      <div className="px-3 sm:px-4 py-2 bg-transparent flex flex-wrap justify-between items-center gap-1 sm:gap-2 relative z-[60]">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 tracking-tight whitespace-nowrap">PROMPT</h2>
          
          {/* Settings Button & Popover */}
          <div className="relative" ref={settingsRef}>
               <Tooltip content="Configure generation settings">
                   <button
                      onClick={() => setShowSettings(!showSettings)}
                      className={`flex items-center justify-center p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          showSettings 
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' 
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      aria-label="Model Settings"
                   >
                      <WrenchIcon className="h-5 w-5" />
                   </button>
               </Tooltip>

               {/* Settings Popover */}
               {showSettings && (
                   <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-3 animate-fade-in z-[100]">
                      <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Model</span>
                          <select 
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                              {getModelOptions().map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                          </select>
                      </div>

                      <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Clarification Model</span>
                          <select 
                              value={selectedClarificationModel}
                              onChange={(e) => setSelectedClarificationModel(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                              <option value="gemini-3.1-flash-lite-preview">Lite (Cheapest)</option>
                              <option value="gemini-3-flash-preview">Flash (Cheaper)</option>
                              <option value="gemini-3.1-pro-preview">Pro (Better)</option>
                          </select>
                      </div>

                      <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">AI Proactiveness</span>
                          <select 
                              value={proactiveness}
                              onChange={(e) => setProactiveness(e.target.value as Proactiveness)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          >
                              <option value="low">Low (Strict to prompt)</option>
                              <option value="medium">Medium (Balanced)</option>
                              <option value="high">High (Creative liberty)</option>
                          </select>
                      </div>
                   </div>
               )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Top Right Mode Selector */}
            <div className="flex items-center bg-gray-200 dark:bg-gray-700/50 p-1 rounded-lg shrink-0 h-8 md:h-9 gap-1">
            <button
                onClick={() => setMode('image')}
                className={`flex items-center h-full px-3 rounded-md transition-all text-xs font-normal whitespace-nowrap gap-1.5 ${
                    mode === 'image'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Image
            </button>
 
            <button
                onClick={() => setMode('story')}
                className={`flex items-center h-full px-3 rounded-md transition-all text-xs font-normal whitespace-nowrap gap-1.5 ${
                    mode === 'story'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Story
            </button>
 
            <button
                onClick={() => setMode('video')}
                className={`flex items-center h-full px-3 rounded-md transition-all text-xs font-normal whitespace-nowrap gap-1.5 ${
                    mode === 'video'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Video
            </button>
        </div>
        
        {/* Info Icon */}
        <Tooltip content="How to use" position="bottom-right">
            <button 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setIsInfoModalOpen(true)}
                aria-label="Info about modes and refining"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
            </button>
        </Tooltip>
        </div>
      </div>
      
      <div className="p-2 md:px-3 md:py-1.5 flex flex-col gap-2">
        <div 
          className="w-full relative rounded-lg flex flex-col p-[1px] bg-gray-300 dark:bg-gray-600"
        >
          <div className="w-full h-full bg-white dark:bg-gray-800 rounded-[7px] flex flex-col">
            <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your vision here..."
            className={`w-full h-[98px] md:h-[125px] bg-transparent p-2 md:p-3 text-gray-800 dark:text-gray-100 focus:outline-none resize-none text-[12px] leading-relaxed transition-all disabled:opacity-50 disabled:pointer-events-none ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            disabled={isLoading}
            />

            <div className="flex flex-col w-full">
                {uploadedImages.length > 0 && (
                    <div className="flex gap-1.5 items-center flex-wrap px-1.5 md:px-2 pb-2">
                        {uploadedImages.map((img, idx) => (
                            <div key={idx} className={`relative group ${isLoading ? 'opacity-50' : ''}`}>
                                <img 
                                    src={`data:${img.inlineData.mimeType};base64,${img.inlineData.data}`} 
                                    alt={`Ref ${idx}`} 
                                    className="h-8 w-8 md:h-10 md:w-10 object-cover rounded border border-gray-300 dark:border-gray-600 shadow-sm"
                                />
                                <Tooltip content="Remove image" position="bottom-left" className="absolute -top-1.5 -right-1.5">
                                    <button 
                                        onClick={() => removeImage(idx)}
                                        disabled={isLoading}
                                        className="bg-red-500 text-white rounded-full h-3.5 w-3.5 flex items-center justify-center text-[8px] shadow-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        &times;
                                    </button>
                                </Tooltip>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-row flex-wrap items-center justify-between p-1.5 md:p-2 pt-0 gap-2 w-full">
                    <div className="flex gap-1.5 items-center shrink min-w-0">
                        {/* Aspect Ratio and Resolution Selectors */}
                        {showResolutionSelector && (
                            <div className="flex items-center gap-1.5 h-8 md:h-9 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                                <Tooltip content="Aspect ratio" position="top-left">
                                    <select 
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                        className="h-full bg-transparent text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer px-1"
                                        disabled={isLoading}
                                    >
                                        <option className="bg-white dark:bg-gray-800" value="16:9">16:9</option>
                                        {mode === 'image' && <option className="bg-white dark:bg-gray-800" value="1:1">1:1</option>}
                                        <option className="bg-white dark:bg-gray-800" value="9:16">9:16</option>
                                        {mode === 'image' && (
                                            <>
                                            <option className="bg-white dark:bg-gray-800" value="4:3">4:3</option>
                                            <option className="bg-white dark:bg-gray-800" value="3:4">3:4</option>
                                            {selectedModel === 'gemini-3.1-flash-image-preview' && (
                                                <>
                                                <option className="bg-white dark:bg-gray-800" value="1:4">1:4</option>
                                                <option className="bg-white dark:bg-gray-800" value="1:8">1:8</option>
                                                <option className="bg-white dark:bg-gray-800" value="4:1">4:1</option>
                                                <option className="bg-white dark:bg-gray-800" value="8:1">8:1</option>
                                                </>
                                            )}
                                            </>
                                        )}
                                    </select>
                                </Tooltip>
                                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                                <Tooltip content="Resolution" position="top">
                                    <select 
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="h-full bg-transparent text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer px-1"
                                        disabled={isLoading}
                                    >
                                        {getResolutionOptions().map(res => (
                                            <option className="bg-white dark:bg-gray-800" key={res} value={res}>{res}</option>
                                        ))}
                                    </select>
                                </Tooltip>
                            </div>
                        )}

                        {mode === 'story' && (
                            <div className="flex items-center h-8 md:h-9 bg-gray-100 dark:bg-gray-800/80 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                                <Tooltip content="Generate a generic story" position="top-left">
                                    <button 
                                        onClick={() => setStoryType('generic')}
                                        disabled={isLoading}
                                        className={`h-full text-xs md:text-sm px-3 md:px-4 rounded-md transition-colors font-medium ${storyType === 'generic' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                    >
                                        Generic
                                    </button>
                                </Tooltip>
                                <Tooltip content="Generate a video prompt" position="top">
                                    <button 
                                        onClick={() => setStoryType('video-prompt')}
                                        disabled={isLoading}
                                        className={`h-full text-xs md:text-sm px-3 md:px-4 rounded-md transition-colors font-medium ${storyType === 'video-prompt' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                    >
                                        Video
                                    </button>
                                </Tooltip>
                            </div>
                        )}

                        <Tooltip content="Upload reference images" position="bottom-left" className="h-8 md:h-9">
                            <button
                                onClick={handleUploadClick}
                                disabled={isLoading}
                                className="h-8 w-8 md:h-9 md:w-9 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-[14px] w-[14px] md:h-[16px] md:w-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </Tooltip>
                    </div>
                    
                    <div className="flex shrink-0 h-8 md:h-9 gap-1.5 justify-end">
                    <Tooltip content="Refine your prompt through guided questions and an editable belief graph." className="h-full" position="bottom-left" contentClassName="w-full">
                        <button
                        onClick={(e) => { e.preventDefault(); onAnalyze(); }}
                        disabled={isLoading}
                        className={`
                            relative overflow-hidden
                            h-full px-3 md:px-4 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 transition-all shadow-sm
                            text-xs md:text-sm font-normal whitespace-nowrap disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
                            ${isLoading 
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : (isAnalyzing
                                    ? 'bg-blue-600/90 text-white cursor-wait' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0')
                            }
                            ${isFirstRun && !isLoading && !isAnalyzing ? 'ring-2 ring-blue-400/50 ring-offset-1 dark:ring-offset-gray-800' : ''}
                        `}
                        >
                            {isAnalyzing ? (
                                 <svg className="animate-spin w-[18px] h-[18px] text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : null}
                            <span>Refine prompt</span>
                            {isFirstRun && !isLoading && !isAnalyzing && (
                                <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                </span>
                            )}
                        </button>
                    </Tooltip>

                    <Tooltip content={generateTooltipText} position="top-right" className="h-full" contentClassName="w-max max-w-[150px]">
                        <button
                        onClick={(e) => { e.preventDefault(); onSubmit(); }}
                        disabled={isLoading || (!prompt && uploadedImages.length === 0)}
                        className={`
                            h-full px-4 md:px-6 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 transition-all shadow-sm
                            text-xs md:text-sm font-normal whitespace-nowrap border disabled:pointer-events-none
                            ${(isLoading || (!prompt && uploadedImages.length === 0))
                                ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:hover:bg-blue-800/80 dark:text-blue-100 border-transparent'}
                        `}
                        >
                        {isGenerating && (
                            <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        <span>Generate</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            />
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Info Modal */}
      {isInfoModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsInfoModalOpen(false)}
        >
          <div 
            ref={infoModalRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">How to use</h3>
              <button 
                onClick={() => setIsInfoModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                <strong>1. Change Mode:</strong> Use the buttons at the top right to switch between generating an Image, a Story, or a Video.
              </p>
              <p>
                <strong>2. Refine Prompt:</strong> Tap the "Refine prompt" button to get guided questions and an editable belief graph that helps clarify your vision.
              </p>
              <p>
                <strong>3. Generate:</strong> Once you're happy with your prompt, tap the Generate button to see the results!
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Disclaimer Modal */}
      {showDisclaimerModal && createPortal(
        <div 
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDisclaimerModal(false)}
        >
          <div 
            ref={disclaimerModalRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Upload Reference Image</h3>
              <button 
                onClick={() => setShowDisclaimerModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Prohibited Use Policy</a>.
              </p>
              <p>
                Please note that uploads, including those from Google Workspace, may be used to develop and improve Google products and services in accordance with our <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">terms</a>.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowDisclaimerModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptDisclaimer}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
              >
                I Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PromptInput;
