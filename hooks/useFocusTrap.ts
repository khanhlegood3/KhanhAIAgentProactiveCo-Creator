/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === container) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    // Focus container or first element
    setTimeout(() => {
        if (container) {
            container.focus();
        }
    }, 10);

    container.addEventListener('keydown', handleKeyDown);
    
    // Prevent focus from leaving the container
    const handleFocusOut = (e: FocusEvent) => {
      if (container && !container.contains(e.relatedTarget as Node)) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener('focusin', handleFocusOut);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusOut);
    };
  }, [isActive]);

  return containerRef;
}
