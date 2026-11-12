/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ReviewPromptModalProps {
  originalPrompt: string;
  proposedPrompt: string;
  onAccept: (editedPrompt: string) => void;
  onReject: () => void;
}

const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({
  originalPrompt,
  proposedPrompt,
  onAccept,
  onReject,
}) => {
  const [editedPrompt, setEditedPrompt] = useState(proposedPrompt);
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    setEditedPrompt(proposedPrompt);
  }, [proposedPrompt]);

  return (
    <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Review Refined Prompt</h3>
          <button 
            onClick={onReject}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            The AI has incorporated your clarifications and graph edits into a new prompt. You can review and edit it before applying.
          </p>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Original Prompt</label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 max-h-32 overflow-y-auto">
              {originalPrompt}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Refined Prompt (Editable)</label>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full flex-1 min-h-[150px] p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onReject}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Discard Changes
          </button>
          <button
            onClick={() => onAccept(editedPrompt)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPromptModal;
