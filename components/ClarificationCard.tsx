
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from './Tooltip';
import { Clarification } from '../types';

export const NOT_RELEVANT_TEXT = "[NOT RELEVANT] This question is not relevant to my prompt. Do not include details about it.";
export const YOU_DECIDE_TEXT = "[YOU DECIDE] I don't care, you decide. Take creative liberty here.";

interface ClarificationCardProps {
  clarifications: Clarification[];
  onRefresh: () => void;
  isLoading: boolean;
  pendingAnswers: {[key: string]: string};
  setPendingAnswers: React.Dispatch<React.SetStateAction<{[key: string]: string}>>;
  prompt?: string;
}

// --- Thinking Process Component ---
const ThinkingProcess = ({ prompt = "" }: { prompt: string }) => {
    const [step, setStep] = useState(0);

    const steps = useMemo(() => {
        const baseSteps = [
            "Analyzing prompt for ambiguities...",
            "Identifying vague attributes...",
            "Detecting implicit entities...",
            "Evaluating semantic uncertainties...",
            "Drafting clarification questions...",
        ];
        
        // Context detection for more specific steps
        if (prompt && prompt.length > 0) {
            const lowerPrompt = prompt.toLowerCase();
            if (lowerPrompt.includes("image") || lowerPrompt.includes("picture") || lowerPrompt.includes("scene")) {
                 baseSteps.splice(1, 0, "Scanning visual descriptors...");
            }
            if (lowerPrompt.includes("story") || lowerPrompt.includes("narrative") || lowerPrompt.includes("write")) {
                 baseSteps.splice(1, 0, "Evaluating narrative gaps...");
            }
            if (lowerPrompt.includes("video") || lowerPrompt.includes("movie")) {
                baseSteps.splice(1, 0, "Checking temporal dynamics...");
            }
        }
        
        return baseSteps;
    }, [prompt]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((s) => (s + 1) % steps.length);
        }, 2200); // 2.2 seconds per step
        return () => clearInterval(interval);
    }, [steps]);

    return (
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse min-w-[240px] text-center transition-all duration-300">
            {steps[step]}
        </span>
    );
};

const ClarificationCard: React.FC<ClarificationCardProps> = ({ 
    clarifications, 
    onRefresh,
    isLoading,
    pendingAnswers,
    setPendingAnswers,
    prompt = ""
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  // Reset slide when clarifications change
  useEffect(() => {
    setCurrentSlide(0);
  }, [clarifications]);

  const handleSelectOption = (question: string, option: string) => {
      setPendingAnswers(prev => ({ ...prev, [question]: option }));
      // Auto-advance on mobile after selection
      if (window.innerWidth < 768 && currentSlide < clarifications.length - 1) {
          setTimeout(() => handleNext(), 300);
      }
  };

  const handleCustomAnswerChange = (question: string, value: string) => {
      setPendingAnswers(prev => {
          const newState = { ...prev, [question]: value };
          if (!value.trim()) delete newState[question];
          return newState;
      });
  };

  const handleNext = () => {
    if (currentSlide < clarifications.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleNotRelevant = () => {
      const currentQuestion = clarifications[currentSlide].question;
      setPendingAnswers(prev => ({ ...prev, [currentQuestion]: NOT_RELEVANT_TEXT }));
      handleNext();
  };

  const handleYouDecide = () => {
      const currentQuestion = clarifications[currentSlide].question;
      setPendingAnswers(prev => ({ ...prev, [currentQuestion]: YOU_DECIDE_TEXT }));
      handleNext();
  };

  const variants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? 100 : -100,
        opacity: 0
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 100 : -100,
        opacity: 0
      };
    }
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg transition-colors duration-200 flex flex-col relative w-full flex-1 min-h-0">
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-30 rounded-lg transition-opacity duration-300 min-h-0">
            <div className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 max-w-sm w-full mx-4">
                <div className="relative mb-4">
                     <svg className="animate-spin h-10 w-10 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <ThinkingProcess prompt={prompt} />
            </div>
        </div>
      )}

      {/* Content Layer */}
      <div className={`flex flex-col flex-1 min-h-0 ${isLoading ? 'opacity-30 pointer-events-none' : ''}`}>
        {clarifications.length === 0 && !isLoading ? (
            <div className="p-4 flex flex-col flex-1 justify-center items-center">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 w-full max-w-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-base font-medium">Click <span className="font-bold text-blue-600 dark:text-blue-400">Refine prompt</span> to generate clarifying questions.</p>
                </div>
            </div>
        ) : (
            <div className="flex flex-col flex-1 min-h-0 relative">
                {/* Desktop View: List */}
                <div className="hidden md:flex flex-col p-4 flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <div className="space-y-4">
                        {isLoading && clarifications.length === 0 ? (
                             [1, 2, 3].map(i => (
                                 <div key={i} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3"></div>
                                    <div className="flex gap-2">
                                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                    </div>
                                 </div>
                             ))
                        ) : (
                            clarifications.map((item, index) => (
                                <div key={index} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
                                    <p className="font-medium text-gray-800 dark:text-gray-200 mb-1.5 text-base">{item.question}</p>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {item.options.map(option => (
                                            <button
                                                key={option}
                                                onClick={() => handleSelectOption(item.question, option)}
                                                disabled={isLoading}
                                                className={`text-xs py-1 px-2.5 rounded-full border transition-colors ${
                                                    pendingAnswers[item.question] === option
                                                        ? 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-100 font-medium shadow-sm'
                                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={pendingAnswers[item.question] && !item.options.includes(pendingAnswers[item.question]) && pendingAnswers[item.question] !== NOT_RELEVANT_TEXT && pendingAnswers[item.question] !== YOU_DECIDE_TEXT ? pendingAnswers[item.question] : ''}
                                        onChange={(e) => handleCustomAnswerChange(item.question, e.target.value)}
                                        placeholder="Or type answer..."
                                        disabled={isLoading}
                                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500 bg-gray-50 dark:bg-gray-900/50 focus:bg-white dark:focus:bg-gray-800 text-gray-800 dark:text-gray-200 mb-2"
                                    />
                                    <div className="flex gap-2">
                                        <Tooltip content="Ignore this concept" position="bottom-left">
                                            <button
                                                onClick={() => handleSelectOption(item.question, NOT_RELEVANT_TEXT)}
                                                className={`text-[11px] font-medium py-1 px-2 rounded border transition-colors ${
                                                    pendingAnswers[item.question] === NOT_RELEVANT_TEXT
                                                        ? 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200'
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                Not Relevant
                                            </button>
                                        </Tooltip>
                                        <Tooltip content="Let the AI decide" position="bottom">
                                            <button
                                                onClick={() => handleSelectOption(item.question, YOU_DECIDE_TEXT)}
                                                className={`text-[11px] font-medium py-1 px-2 rounded border transition-colors ${
                                                    pendingAnswers[item.question] === YOU_DECIDE_TEXT
                                                        ? 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200'
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                You Decide
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {clarifications.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-row justify-between items-center gap-2">
                            <Tooltip content="Get different questions" position="bottom-left">
                                <button 
                                    onClick={onRefresh}
                                    disabled={isLoading}
                                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 text-gray-700 dark:text-gray-200 font-normal h-7 md:h-8 px-3 md:px-4 rounded-lg flex items-center justify-center transition-all shadow-sm text-xs md:text-sm disabled:pointer-events-none whitespace-nowrap gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh Questions
                                </button>
                            </Tooltip>
                            <span className="text-xs text-gray-400 italic text-right whitespace-nowrap">Click "Update Prompt" to apply.</span>
                        </div>
                    )}
                </div>

                {/* Mobile View: Carousel */}
                <div className="md:hidden flex-1 relative flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {isLoading && clarifications.length === 0 ? (
                        <div className="p-4 flex-1 flex flex-col justify-center">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-full mb-4"></div>
                                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-6"></div>
                                <div className="flex flex-col gap-3">
                                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        clarifications.length > 0 && (
                            <>
                                <div className="flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Question {currentSlide + 1} of {clarifications.length}
                                        </span>
                                        <Tooltip content="Refresh questions" position="bottom">
                                            <button 
                                                onClick={onRefresh}
                                                disabled={isLoading}
                                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 px-2 py-1 rounded shadow-sm transition-colors disabled:opacity-50 border border-gray-200 dark:border-gray-700"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span className="text-[11px] font-semibold">Refresh</span>
                                            </button>
                                        </Tooltip>
                                    </div>
                                    <div className="flex gap-1">
                                        {clarifications.map((_, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-4 bg-blue-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="relative w-full shrink-0">
                                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                        <motion.div
                                            key={currentSlide}
                                            custom={direction}
                                            variants={variants}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            transition={{
                                                x: { type: "spring", stiffness: 300, damping: 30 },
                                                opacity: { duration: 0.2 }
                                            }}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            dragElastic={1}
                                            onDragEnd={(e, { offset, velocity }) => {
                                                const swipe = swipePower(offset.x, velocity.x);

                                                if (swipe < -swipeConfidenceThreshold) {
                                                    handleNext();
                                                } else if (swipe > swipeConfidenceThreshold) {
                                                    handlePrev();
                                                }
                                            }}
                                            className="w-full p-2 sm:px-4 sm:py-2 flex flex-col"
                                        >
                                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 sm:px-4 sm:py-3 flex flex-col">
                                                <p className="font-medium text-gray-800 dark:text-gray-100 mb-4 text-lg leading-snug">
                                                    {clarifications[currentSlide].question}
                                                </p>
                                                <div className="flex flex-col gap-2.5 mb-4">
                                                    {clarifications[currentSlide].options.map(option => (
                                                        <button
                                                            key={option}
                                                            onClick={() => handleSelectOption(clarifications[currentSlide].question, option)}
                                                            disabled={isLoading}
                                                            className={`text-left py-3 px-4 rounded-lg border transition-all ${
                                                                pendingAnswers[clarifications[currentSlide].question] === option
                                                                    ? 'bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-500 dark:text-blue-100 font-medium shadow-sm ring-1 ring-blue-400/50'
                                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="pt-2">
                                                    <input
                                                        type="text"
                                                        value={pendingAnswers[clarifications[currentSlide].question] && !clarifications[currentSlide].options.includes(pendingAnswers[clarifications[currentSlide].question]) && pendingAnswers[clarifications[currentSlide].question] !== NOT_RELEVANT_TEXT && pendingAnswers[clarifications[currentSlide].question] !== YOU_DECIDE_TEXT ? pendingAnswers[clarifications[currentSlide].question] : ''}
                                                        onChange={(e) => handleCustomAnswerChange(clarifications[currentSlide].question, e.target.value)}
                                                        placeholder="Or type your own answer..."
                                                        disabled={isLoading}
                                                        className="w-full text-base border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900/50 focus:bg-white dark:focus:bg-gray-800 text-gray-800 dark:text-gray-200 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                <div className="p-2 sm:px-4 sm:py-2 flex justify-between items-center bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 z-10 shrink-0">
                                    <div className="flex gap-2">
                                        <Tooltip content="Ignore this concept" position="top-left">
                                            <button
                                                onClick={handleNotRelevant}
                                                className={`text-sm font-medium py-1.5 px-3 rounded-lg border transition-colors ${
                                                    clarifications[currentSlide] && pendingAnswers[clarifications[currentSlide].question] === NOT_RELEVANT_TEXT
                                                        ? 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200'
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                Not Relevant
                                            </button>
                                        </Tooltip>
                                        <Tooltip content="Let the AI decide" position="top">
                                            <button
                                                onClick={handleYouDecide}
                                                className={`text-sm font-medium py-1.5 px-3 rounded-lg border transition-colors ${
                                                    clarifications[currentSlide] && pendingAnswers[clarifications[currentSlide].question] === YOU_DECIDE_TEXT
                                                        ? 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200'
                                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                You Decide
                                            </button>
                                        </Tooltip>
                                    </div>
                                    <div className="flex gap-2">
                                        <Tooltip content="Previous question" position="top-right">
                                            <button
                                                onClick={handlePrev}
                                                disabled={currentSlide === 0}
                                                className="p-2 rounded-full bg-gray-100 text-gray-600 disabled:opacity-50 disabled:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:disabled:bg-gray-800 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </Tooltip>
                                        <Tooltip content="Next question" position="top-right">
                                            <button
                                                onClick={handleNext}
                                                disabled={currentSlide === clarifications.length - 1}
                                                className="p-2 rounded-full bg-blue-100 text-blue-600 disabled:opacity-50 disabled:bg-gray-50 dark:bg-blue-900/40 dark:text-blue-400 dark:disabled:bg-gray-800 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-h-0 pointer-events-none"></div>
                            </>
                        )
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ClarificationCard;
