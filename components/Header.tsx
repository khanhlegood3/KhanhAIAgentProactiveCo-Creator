
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Tooltip } from './Tooltip';

interface HeaderProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    onShowInfo: () => void;
    isLoading: boolean;
    mode: 'image' | 'story' | 'video';
}

const Header: React.FC<HeaderProps> = ({ 
    isDarkMode, 
    toggleDarkMode, 
    onShowInfo,
    isLoading,
    mode
}) => {
  return (
    <header className="bg-white dark:bg-gray-850 py-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200 relative z-[100]">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Proactive Co-Creator</h1>
      <div className="flex items-center gap-2">
        <Tooltip content="Learn more about this app" position="bottom-right">
            <button
              onClick={onShowInfo}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-gray-500 dark:text-gray-400 text-[13px] font-normal hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Info</span>
            </button>
        </Tooltip>
        <Tooltip content={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"} position="bottom-right">
            <button
              onClick={toggleDarkMode}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-gray-500 dark:text-gray-400 text-[13px] font-normal hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
              ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
              )}
              <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
            </button>
        </Tooltip>
      </div>
    </header>
  );
};

export default Header;
