/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
  contentClassName?: string;
  trigger?: 'hover' | 'focus' | 'both';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'bottom', className = '', contentClassName = 'w-max max-w-[260px]', trigger = 'both' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    'bottom-right': 'top-full right-0 mt-2',
    'bottom-left': 'top-full left-0 mt-2',
    'top-right': 'bottom-full right-0 mb-2',
    'top-left': 'bottom-full left-0 mb-2',
  };

  const arrowClasses = {
    top: 'top-full -mt-1 left-1/2 -translate-x-1/2 border-t-gray-800 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent border-4',
    bottom: 'bottom-full -mb-1 left-1/2 -translate-x-1/2 border-b-gray-800 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent border-4',
    left: 'left-full -ml-1 top-1/2 -translate-y-1/2 border-l-gray-800 dark:border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent border-4',
    right: 'right-full -mr-1 top-1/2 -translate-y-1/2 border-r-gray-800 dark:border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent border-4',
    'bottom-right': 'bottom-full -mb-1 right-4 border-b-gray-800 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent border-4',
    'bottom-left': 'bottom-full -mb-1 left-4 border-b-gray-800 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent border-4',
    'top-right': 'top-full -mt-1 right-4 border-t-gray-800 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent border-4',
    'top-left': 'top-full -mt-1 left-4 border-t-gray-800 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent border-4',
  };

  const triggerClasses = {
    hover: 'group-hover:opacity-100',
    focus: 'group-has-[:focus-visible]:opacity-100',
    both: 'group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
  };

  return (
    <div className={`relative flex items-center group has-[:disabled]:cursor-not-allowed ${className}`}>
      {children}
      <div 
        className={`absolute ${positionClasses[position]} ${triggerClasses[trigger]} px-2 py-1 text-sm font-medium text-white bg-gray-800 dark:bg-gray-700 rounded opacity-0 transition-opacity whitespace-normal text-center pointer-events-none z-[100] shadow-md ${contentClassName}`}
        role="tooltip"
      >
        {content}
        <div className={`absolute w-0 h-0 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};

export default Tooltip;
