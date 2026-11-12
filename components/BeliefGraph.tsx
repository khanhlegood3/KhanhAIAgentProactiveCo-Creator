
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from './Tooltip';
import { BeliefState, Entity, Attribute, Relationship, Candidate } from '../types';

interface BeliefGraphProps {
  data: BeliefState | null;
  isLoading: boolean;
  mode: 'image' | 'story' | 'video';
  view: 'graph' | 'attributes';
  isVisible?: boolean;
  pendingAttributeUpdates: Record<string, string>;
  setPendingAttributeUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingRelationshipUpdates: Record<string, string>;
  setPendingRelationshipUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingClarificationCount: number;
  currentPrompt: string;
}

interface SimulationNode {
    id: string;
    width: number;
    height: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number;
    fy: number;
    isFixed?: boolean;
    targetX?: number;
    targetY?: number;
}

interface SimulationLink {
    source: SimulationNode;
    target: SimulationNode;
    label: string;
}

const getHighestProbabilityValue = (attribute: Attribute): string => {
    if (!attribute.value || attribute.value.length === 0) return 'Unknown';
    // With strict schema output, the first item is generally the model's top choice
    return attribute.value[0].name;
};

// --- Thinking Process Component ---
const ThinkingProcess = ({ prompt }: { prompt: string }) => {
    const [step, setStep] = useState(0);

    const steps = useMemo(() => {
        const cleanPrompt = prompt.toLowerCase().replace(/[^\w\s]/g, '');
        const words = cleanPrompt.split(/\s+/).filter(w => w.length > 0);
        
        // Context detection
        const hasHuman = words.some(w => ['man', 'woman', 'boy', 'girl', 'person', 'people', 'child', 'kid', 'guy', 'lady', 'friends', 'family', 'couple'].includes(w));
        const hasAction = words.some(w => w.endsWith('ing')); 
        
        // Find a significant noun-like word (longer than 3 chars, not common stop words)
        const stopWords = ['about', 'after', 'before', 'their', 'where', 'which', 'there', 'could', 'would', 'with', 'from', 'that', 'this', 'some', 'what'];
        const significantWord = words.find(w => w.length > 3 && !stopWords.includes(w)) || 'entities';
        const truncatedKeyword = significantWord.length > 10 ? significantWord.substring(0, 9) + '...' : significantWord;

        const generatedSteps = [
            "Parsing prompt syntax...",
            `Identifying key concepts like '${truncatedKeyword}'...`,
        ];

        if (hasHuman) {
            generatedSteps.push("Analyzing poses and expressions...");
        } else {
            generatedSteps.push("Analyzing object attributes...");
        }

        generatedSteps.push("Deducing implicit surroundings...");
        
        if (hasAction) {
            generatedSteps.push("Mapping interaction dynamics...");
        }

        return generatedSteps;
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

// --- Styles Placeholder Component ---
const EmptyStatePlaceholder = ({ text }: { text: React.ReactNode }) => (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-8 max-w-lg w-full shadow-sm mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <div className="text-sm font-medium">{text}</div>
    </div>
);

// --- Legend Component ---
const Legend = () => (
    <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm text-sm space-y-2 z-40 pointer-events-none select-none">
        <div className="flex items-center gap-2">
            <div className="w-6 h-4 border-2 border-gray-600 dark:border-gray-400 rounded bg-white dark:bg-gray-700"></div>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Explicit (in prompt)</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-6 h-4 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded bg-white dark:bg-gray-700"></div>
            <span className="text-gray-500 dark:text-gray-400">Implicit (inferred)</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-6 h-4 border-2 border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <span className="text-xs text-gray-400 line-through decoration-gray-400">Abs</span>
            </div>
            <span className="text-gray-500 dark:text-gray-400">Marked Absent</span>
        </div>
    </div>
);

interface AttributeEditorProps {
    attribute: Attribute;
    entity: Entity;
    onChange: (entityName: string, attributeName: string, newValue: string) => void;
    isLoading: boolean;
    pendingValue?: string;
}

const AttributeEditor: React.FC<AttributeEditorProps> = ({ attribute, entity, onChange, isLoading, pendingValue }) => {
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customValue, setCustomValue] = useState("");
    
    // Check if this is an existence attribute (supports legacy 'existence_in_image' and new 'existence')
    const isExistence = attribute.name.toLowerCase() === 'existence' || attribute.name.toLowerCase() === 'existence_in_image';

    // Determine the value to show
    let currentValue = pendingValue;
    
    if (currentValue === undefined) {
        if (isExistence) {
             // For existence, we look at the candidates. Usually [ {name: 'true', ...}, {name: 'false', ...} ]
             currentValue = getHighestProbabilityValue(attribute).toLowerCase();
             if (currentValue === 'unknown') currentValue = 'true'; // Default to true if missing for existence
        } else {
             // For standard attributes:
             // If explicitly in prompt, show the inferred value.
             // If not in prompt, show 'Unknown' to allow user to explicitly select the inferred value later.
             currentValue = attribute.presence_in_prompt ? getHighestProbabilityValue(attribute) : 'Unknown';
        }
    } else if (isExistence) {
        currentValue = currentValue.toLowerCase();
    }

    const isModified = pendingValue !== undefined;

    // Reset custom mode when attribute changes (e.g. after a refresh)
    useEffect(() => {
        setIsCustomMode(false);
        setCustomValue("");
    }, [attribute]);

    // --- Existence Toggle (Available for all entities) ---
    if (isExistence) {
        const isPresent = currentValue === 'true';
        const isExplicit = entity.presence_in_prompt;
        
        // If explicitly in prompt OR user has modified it -> Green.
        // If it's implicit (not in prompt) AND not modified -> Grey.
        const useGreen = isExplicit || isModified;

        const presentColor = useGreen 
            ? 'bg-green-600 text-white' 
            : 'bg-gray-500 dark:bg-gray-600 text-white'; // Grey for implicit entities

        return (
            <div key={attribute.name} className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-4 items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors px-2 rounded-lg">
                <label className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">Existence</label>
                <div className={`flex rounded-md border overflow-hidden w-full ${isModified ? 'border-blue-500 ring-1 ring-blue-200 dark:ring-blue-900' : 'border-gray-300 dark:border-gray-600'}`}>
                     <Tooltip content={isLoading ? "Loading..." : (useGreen ? "Set existence to Present" : "Set inferred existence to Present")} className="w-1/2">
                         <button
                            onClick={() => onChange(entity.name, attribute.name, 'true')}
                            disabled={isLoading}
                            className={`w-full text-xs sm:text-sm font-semibold py-1.5 px-1 sm:px-2 transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:z-10 ${
                                isPresent
                                    ? presentColor
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            Present
                        </button>
                    </Tooltip>
                    <Tooltip content={isLoading ? "Loading..." : "Set existence to Absent"} className="w-1/2">
                        <button
                            onClick={() => onChange(entity.name, attribute.name, 'false')}
                            disabled={isLoading}
                            className={`w-full text-xs sm:text-sm font-semibold py-1.5 px-1 sm:px-2 transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:z-10 ${
                                !isPresent
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            Absent
                        </button>
                    </Tooltip>
                </div>
            </div>
        );
    }

    // --- Standard Attribute Editor ---
    return (
        <div key={attribute.name} className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-4 items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors px-2 rounded-lg">
            <label className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base flex items-center gap-1.5 capitalize leading-tight">
                {attribute.name.replace(/_/g, ' ')}
                {isModified && <span className="h-2 w-2 rounded-full bg-blue-500 shadow-sm ring-1 ring-blue-200 dark:ring-blue-900 flex-shrink-0" title="Modified"></span>}
            </label>
            <div className="w-full min-w-0">
                {isCustomMode ? (
                    <div className="flex gap-1 min-w-0">
                        <input
                            type="text"
                            autoFocus
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            placeholder="Type value..."
                            className="w-full min-w-0 bg-white dark:bg-gray-700 border border-blue-500 text-gray-800 dark:text-gray-200 text-sm rounded px-2 py-1.5 focus:outline-none shadow-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && customValue.trim()) {
                                    onChange(entity.name, attribute.name, customValue.trim());
                                    setIsCustomMode(false);
                                } else if (e.key === 'Escape') {
                                    setIsCustomMode(false);
                                }
                            }}
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => {
                                if (customValue.trim()) {
                                    onChange(entity.name, attribute.name, customValue.trim());
                                    setIsCustomMode(false);
                                }
                            }}
                            disabled={isLoading || !customValue.trim()}
                            className="bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setIsCustomMode(false)}
                            title="Cancel"
                            className="text-gray-400 hover:text-gray-600 px-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            disabled={isLoading}
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <select 
                            value={currentValue} 
                            onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                    setIsCustomMode(true);
                                } else {
                                    onChange(entity.name, attribute.name, e.target.value);
                                }
                            }} 
                            onKeyDown={(e) => e.stopPropagation()}
                            disabled={isLoading}
                            aria-label={`Select value for ${attribute.name}`}
                            className={`w-full text-gray-800 dark:text-gray-200 text-sm rounded-md shadow-sm px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors ${
                                isModified 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 border' 
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 border hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                        >
                            <option value="Unknown">Unknown</option>
                            {attribute.value.filter(v => v.name !== 'Unknown').map(v => (
                                <option key={v.name} value={v.name}>{v.name}</option>
                            ))}
                            {isModified && currentValue !== 'Unknown' && !attribute.value.some(v => v.name === currentValue) && (
                                <option value={currentValue}>{currentValue}</option>
                            )}
                            <option value="__custom__" className="font-bold text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-800">
                                + Type custom...
                            </option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const RelationshipEditor: React.FC<{
  rel: Relationship;
  position: { x: number; y: number };
  containerDimensions: { width: number; height: number };
  onChange: (newLabel: string) => void;
  onClose: () => void;
  isLoading: boolean;
}> = ({ rel, position, containerDimensions, onChange, onClose, isLoading }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [adjustedStyle, setAdjustedStyle] = useState<React.CSSProperties>({
      left: position.x,
      top: position.y,
      opacity: 0, 
      transform: 'translate(-50%, 8px)'
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
      // Focus the input when editor opens
      const input = editorRef.current?.querySelector('input');
      if (input) input.focus();
  }, []);

  useLayoutEffect(() => {
      if (editorRef.current && containerDimensions.width > 0) {
          const { width, height } = editorRef.current.getBoundingClientRect();
          const padding = 20; 
          
          let top = position.y + 12;
          let left = position.x;
          let transformX = '-50%';

          // Vertical check: if bottom overflows
          if (top + height > containerDimensions.height - padding) {
              top = position.y - height - 12; // Flip to above
              if (top < padding) top = padding; // Clamp top
          }

          // Horizontal check
          const halfWidth = width / 2;
          
          if (left + halfWidth > containerDimensions.width - padding) {
               // Overflow Right -> Anchor to the left of the click
               left = position.x - 12;
               transformX = '-100%';
          } else if (left - halfWidth < padding) {
               // Overflow Left -> Anchor to the right of the click
               left = position.x + 12;
               transformX = '0%';
          }

          setAdjustedStyle({
              left,
              top,
              transform: `translate(${transformX}, 0)`,
              opacity: 1,
              transition: 'opacity 0.2s ease-out',
              touchAction: 'pan-y'
          });
      }
  }, [position, containerDimensions, rel.label]);

  const allOptions: Candidate[] = [
    { name: rel.label },
    ...(rel.alternatives || [])
  ].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

  const handleCustomSubmit = () => {
    if (customLabel.trim()) {
        onChange(customLabel.trim());
        onClose();
    }
  };

  return (
    <div
      ref={editorRef}
      className="absolute bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-xl z-50 w-64 max-h-[300px] overflow-y-auto flex flex-col"
      style={adjustedStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
          <h4 className="font-bold text-base text-gray-800 dark:text-gray-100">Edit Relationship</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">&times;</button>
      </div>
      <div className="flex flex-col space-y-1 mb-3 flex-grow">
        {allOptions.map(alt => (
            <button
                key={alt.name}
                disabled={isLoading}
                onClick={() => { onChange(alt.name); onClose(); }}
                className={`text-left text-sm p-1 px-2 rounded transition-colors w-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${rel.label === alt.name ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'} disabled:opacity-50`}
            >
                {alt.name}
            </button>
        ))}
      </div>
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex gap-2">
              <input 
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  placeholder="Type custom label..."
                  className="flex-grow text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded p-1.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
              />
              <button 
                  onClick={handleCustomSubmit}
                  disabled={isLoading || !customLabel.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-2 py-0.5 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                  Save
              </button>
          </div>
      </div>
    </div>
  );
};

const getIntersection = (x1: number, y1: number, x2: number, y2: number, w: number, h: number, gap: number = 0) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist === 0) return { x: x1, y: y1 };

    const halfW = w / 2;
    const halfH = h / 2;

    const tanTheta = Math.abs(dy / dx);
    const tanCorner = halfH / halfW;
    
    let ix, iy;
    
    if (tanTheta < tanCorner) {
        const sign = Math.sign(dx);
        ix = x1 + (halfW + gap) * sign;
        iy = y1 + (halfW + gap) * sign * (dy / dx);
    } else {
        const sign = Math.sign(dy);
        iy = y1 + (halfH + gap) * sign;
        ix = x1 + (halfH + gap) * sign * (dx / dy);
    }
    return { x: ix, y: iy };
}

const getEdgePath = (
    x1: number, y1: number, 
    x2: number, y2: number, 
    sourceW: number, sourceH: number,
    targetW: number, targetH: number
) => {
    const start = getIntersection(x1, y1, x2, y2, sourceW, sourceH, 0); 
    const end = getIntersection(x2, y2, x1, y1, targetW, targetH, 5); // 5px gap for arrowhead

    const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const labelX = (start.x + end.x) / 2;
    const labelY = (start.y + end.y) / 2;

    return { path, labelX, labelY };
};

const truncate = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};

// Helper function to sort attributes, putting existence first
const sortAttributes = (attributes: Attribute[]) => {
    return [...attributes].sort((a, b) => {
        const isExistA = a.name === 'existence' || a.name === 'existence_in_image';
        const isExistB = b.name === 'existence' || b.name === 'existence_in_image';
        if (isExistA && !isExistB) return -1;
        if (!isExistA && isExistB) return 1;
        return 0;
    });
};

const BeliefGraph: React.FC<BeliefGraphProps> = ({ 
    data, 
    isLoading, 
    mode, 
    view, 
    isVisible = true,
    pendingAttributeUpdates,
    setPendingAttributeUpdates,
    pendingRelationshipUpdates,
    setPendingRelationshipUpdates,
    pendingClarificationCount,
    currentPrompt
}) => {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<Relationship | null>(null);
  const [selectedRel, setSelectedRel] = useState<{rel: Relationship, position: {x: number, y: number}} | null>(null);
  
  // Explicit indexing signature for type safety
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showHint, setShowHint] = useState(false);
  
  const stablePositions = useRef<Record<string, { x: number; y: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, SVGGElement | null>>({});
  const relRefs = useRef<Record<string, SVGGElement | null>>({});
  
  // Pan and Zoom State
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const activePointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
              const { width, height } = entry.contentRect;
              if (width > 0 && height > 0) {
                   setDimensions(prev => {
                       if (Math.abs(prev.width - width) > 2 || Math.abs(prev.height - height) > 2) {
                           return { width, height };
                       }
                       return prev;
                   });
              }
          }
      });
      resizeObserver.observe(node);
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
      }
      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleGraphKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
          const focusableNodes = objectEntities.map(ent => nodeRefs.current[ent.name]).filter(Boolean) as SVGGElement[];
          const focusableEdges = activeRelationships.map(rel => relRefs.current[`${rel.source}-${rel.target}`]).filter(Boolean) as SVGGElement[];
          const allFocusable = [...focusableNodes, ...focusableEdges];
          
          const currentIndex = allFocusable.indexOf(document.activeElement as SVGGElement);
          
          if (currentIndex !== -1) {
              let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
              if (nextIndex >= 0 && nextIndex < allFocusable.length) {
                  e.preventDefault();
                  allFocusable[nextIndex]?.focus();
              } else {
                  // Let browser tab out naturally by temporarily disabling focus on graph elements
                  allFocusable.forEach(el => el.setAttribute('tabindex', '-1'));
                  requestAnimationFrame(() => {
                      allFocusable.forEach(el => el.setAttribute('tabindex', '0'));
                  });
              }
          } else if (allFocusable.length > 0) {
              // If focus is on the container itself (e.g. user clicked background then pressed Tab)
              if (document.activeElement === containerRef.current) {
                  e.preventDefault();
                  allFocusable[e.shiftKey ? allFocusable.length - 1 : 0]?.focus();
              }
          }
      }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return; 

    (e.target as Element).setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (activePointersRef.current.size === 2) {
        const points = Array.from(activePointersRef.current.values()) as {x: number, y: number}[];
        prevPinchDistRef.current = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointersRef.current.size === 2) {
          const points = Array.from(activePointersRef.current.values()) as {x: number, y: number}[];
          const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          
          if (prevPinchDistRef.current) {
            const container = containerRef.current?.getBoundingClientRect();
            if (!container) return;
            
            const scaleFactor = dist / prevPinchDistRef.current;
            
            const cx = (points[0].x + points[1].x) / 2;
            const cy = (points[0].y + points[1].y) / 2;
            const relCx = cx - container.left;
            const relCy = cy - container.top;

            const k = viewTransform.k;
            const nextK = Math.min(Math.max(0.1, k * scaleFactor), 5);
            const effectiveScale = nextK / k;

            const nextX = relCx - (dimensions.width / 2) - (relCx - (dimensions.width / 2) - viewTransform.x) * effectiveScale;
            const nextY = relCy - (dimensions.height / 2) - (relCy - (dimensions.height / 2) - viewTransform.y) * effectiveScale;

            setViewTransform({ x: nextX, y: nextY, k: nextK });
          }
          prevPinchDistRef.current = dist;
      } else if (activePointersRef.current.size === 1 && isDragging && dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointersRef.current.has(e.pointerId)) {
        (e.target as Element).releasePointerCapture(e.pointerId);
        activePointersRef.current.delete(e.pointerId);
      }
      
      if (activePointersRef.current.size < 2) {
          prevPinchDistRef.current = null;
      }
      if (activePointersRef.current.size === 0) {
          setIsDragging(false);
          dragStartRef.current = null;
      } else if (activePointersRef.current.size === 1) {
          const point = Array.from(activePointersRef.current.values())[0] as {x: number, y: number};
          dragStartRef.current = { x: point.x, y: point.y };
      }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) return;

      const offsetX = e.clientX - container.left;
      const offsetY = e.clientY - container.top;
      
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 0.9;
      
      const k = viewTransform.k;
      const nextK = Math.min(Math.max(0.1, k * factor), 5);
      const scaleRatio = nextK / k;
      
      const nextX = offsetX - (dimensions.width / 2) - (offsetX - (dimensions.width / 2) - viewTransform.x) * scaleRatio;
      const nextY = offsetY - (dimensions.height / 2) - (offsetY - (dimensions.height / 2) - viewTransform.y) * scaleRatio;
      
      setViewTransform({ x: nextX, y: nextY, k: nextK });
  };
  
  const zoomIn = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const factor = 1.2;
      const nextK = Math.min(Math.max(0.1, viewTransform.k * factor), 5);
      const scaleRatio = nextK / viewTransform.k;
      
      const nextX = viewTransform.x * scaleRatio;
      const nextY = viewTransform.y * scaleRatio;
      setViewTransform({ x: nextX, y: nextY, k: nextK });
  };

  const zoomOut = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const factor = 0.8;
      const nextK = Math.min(Math.max(0.1, viewTransform.k * factor), 5);
      const scaleRatio = nextK / viewTransform.k;
      
      const nextX = viewTransform.x * scaleRatio;
      const nextY = viewTransform.y * scaleRatio;
      setViewTransform({ x: nextX, y: nextY, k: nextK });
  };

  const resetView = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setViewTransform({ x: 0, y: 0, k: 1 });
  };

  const handleRelationshipClick = (rel: Relationship, e: React.MouseEvent | React.KeyboardEvent) => {
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) return;
      
      let x = 0;
      let y = 0;

      const isMouseEvent = (evt: React.SyntheticEvent): evt is React.MouseEvent => {
          return 'clientX' in evt;
      };

      // Check if mouse event has valid coordinates (not simulated 0,0 from keyboard)
      if (isMouseEvent(e) && (e.clientX !== 0 || e.clientY !== 0)) {
          x = e.clientX - container.left;
          y = e.clientY - container.top;
      } else {
          // Fallback to edge center for keyboard interactions
          const sourcePos = nodePositions[rel.source];
          const targetPos = nodePositions[rel.target];
          
          if (sourcePos && targetPos) {
              const midX = (sourcePos.x + targetPos.x) / 2;
              const midY = (sourcePos.y + targetPos.y) / 2;
              
              // Apply view transform
              x = (dimensions.width / 2) + midX * viewTransform.k + viewTransform.x;
              y = (dimensions.height / 2) + midY * viewTransform.k + viewTransform.y;
          } else {
              x = container.width / 2;
              y = container.height / 2;
          }
      }

      setSelectedRel({ rel, position: { x, y } });
      setSelectedEntity(null);
  };

  useEffect(() => {
      if (!data) {
          setSelectedEntity(null);
          setSelectedRel(null);
          setViewTransform({ x: 0, y: 0, k: 1 });
          stablePositions.current = {};
      } else {
          // Update selected entity with new data if it exists
          if (selectedEntity) {
              const updatedEntity = data.entities.find(e => e.name === selectedEntity.name);
              if (updatedEntity) {
                  setSelectedEntity(updatedEntity);
              } else {
                  setSelectedEntity(null);
              }
          }
          // Update selected relationship with new data if it exists
          if (selectedRel) {
              const updatedRel = data.relationships.find(r => r.source === selectedRel.rel.source && r.target === selectedRel.rel.target && r.label === selectedRel.rel.label);
              if (updatedRel) {
                  setSelectedRel({ ...selectedRel, rel: updatedRel });
              } else {
                  setSelectedRel(null);
              }
          }
      }
  }, [data]);

  useEffect(() => {
    const dismissed = localStorage.getItem('belief_graph_hint_dismissed');
    if (!dismissed && data && !isLoading && view === 'graph') {
        const timer = setTimeout(() => setShowHint(true), 800);
        return () => clearTimeout(timer);
    }
  }, [data, isLoading, view]);

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem('belief_graph_hint_dismissed', 'true');
  };

  const handleAttributeChange = (entityName: string, attributeName: string, newValue: string) => {
      const key = `${entityName}:${attributeName}`;
      setPendingAttributeUpdates(prev => ({ ...prev, [key]: newValue }));
  };

  const handleRelationshipChange = (source: string, target: string, newLabel: string) => {
      const key = `${source}:${target}`;
      setPendingRelationshipUpdates(prev => ({ ...prev, [key]: newLabel }));
  };

  // Check if an entity is present (not set to Absent)
  const isEntityPresent = useCallback((entity: Entity) => {
    const attr = entity.attributes.find(a => a.name.toLowerCase() === 'existence' || a.name.toLowerCase() === 'existence_in_image');
    if (!attr) return true;
    
    // Check pending updates first
    const key = `${entity.name}:${attr.name}`;
    if (pendingAttributeUpdates[key] !== undefined) {
        return pendingAttributeUpdates[key].toLowerCase() === 'true';
    }

    // Check model value
    const val = getHighestProbabilityValue(attr);
    return val.toLowerCase() !== 'false';
  }, [pendingAttributeUpdates]);

  const sceneEntityNames = ['image', 'the image', 'story', 'the story', 'video', 'the video', 'the video script', 'video script'];
  const sceneEntity = useMemo(() => data?.entities.find(e => sceneEntityNames.includes(e.name.toLowerCase())), [data]);
  const objectEntities = useMemo(() => data?.entities.filter(e => !sceneEntityNames.includes(e.name.toLowerCase())) || [], [data]);
  const nodeDimensions = useMemo(() => {
    const dimensions: {[key: string]: {width: number, height: number}} = {};
    if (data) {
        objectEntities.forEach(entity => {
          const textWidth = entity.name.length * 8 + 20; 
          dimensions[entity.name] = { width: Math.max(50, textWidth), height: 36 }; 
        });
    }
    return dimensions;
  }, [objectEntities, data]);

  const getCanonicalName = useCallback((name: string) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    const cleanName = lowerName.replace(/^(the|a|an)\s+/, '').trim();
    let match = objectEntities.find(e => e.name.toLowerCase() === lowerName);
    if (!match) match = objectEntities.find(e => e.name.toLowerCase().replace(/^(the|a|an)\s+/, '').trim() === cleanName);
    if (!match && cleanName.length > 2) {
         match = objectEntities.find(e => {
             const cleanEntity = e.name.toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
             return cleanEntity.includes(cleanName);
         });
         if (!match) {
             match = objectEntities.find(e => {
                 const cleanEntity = e.name.toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
                 return cleanName.includes(cleanEntity) && cleanEntity.length > 2;
             });
         }
    }
    return match ? match.name : null;
  }, [objectEntities]);

  const relationships = useMemo(() => {
    if (!data?.relationships) return [];
    const validRels = data.relationships.filter(r =>
        !sceneEntityNames.includes(r.source.toLowerCase()) &&
        !sceneEntityNames.includes(r.target.toLowerCase())
    );
    const uniqueRels: Relationship[] = [];
    const pairSet = new Set<string>();
    validRels.forEach(rel => {
        const canonicalSource = getCanonicalName(rel.source);
        const canonicalTarget = getCanonicalName(rel.target);
        if (!canonicalSource || !canonicalTarget) return;
        const normalizedRel = { ...rel, source: canonicalSource, target: canonicalTarget };
        const [k1, k2] = [canonicalSource, canonicalTarget].sort();
        const pairKey = `${k1}:${k2}`;
        if (!pairSet.has(pairKey)) {
            pairSet.add(pairKey);
            uniqueRels.push(normalizedRel);
        }
    });
    return uniqueRels;
  }, [data, getCanonicalName]);

  const activeRelationships = useMemo(() => {
    return relationships.filter(rel => {
        const sourceEntity = objectEntities.find(e => e.name === rel.source);
        const targetEntity = objectEntities.find(e => e.name === rel.target);
        const sourcePresent = sourceEntity ? isEntityPresent(sourceEntity) : true;
        const targetPresent = targetEntity ? isEntityPresent(targetEntity) : true;
        return sourcePresent && targetPresent;
    });
  }, [relationships, objectEntities, isEntityPresent]);

  const neighborsOfSelected = useMemo(() => {
    if (!selectedEntity) return null;
    const neighbors = new Set<string>();
    activeRelationships.forEach(rel => {
        if (rel.source === selectedEntity.name) neighbors.add(rel.target);
        if (rel.target === selectedEntity.name) neighbors.add(rel.source);
    });
    return neighbors;
  }, [selectedEntity, activeRelationships]);

  const neighborsOfHovered = useMemo(() => {
    if (!hoveredEntity) return new Set();
    const neighbors = new Set<string>();
    activeRelationships.forEach(rel => {
      if (rel.source === hoveredEntity) neighbors.add(rel.target);
      if (rel.target === hoveredEntity) neighbors.add(rel.source);
    });
    return neighbors;
  }, [hoveredEntity, activeRelationships]);

  // Force update dimensions when view changes to graph or data changes
  useLayoutEffect(() => {
    if (view === 'graph' && containerRef.current) {
        // Small delay to allow layout to settle (e.g. after display:none removal)
        const timer = setTimeout(() => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setDimensions({ width: rect.width, height: rect.height });
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }
  }, [view, data]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;

    if (objectEntities.length > 0) {
        const SIMULATION_TICKS = 400; // Slightly more ticks for stability
        const REPULSION_STRENGTH = 10000; // Balanced repulsion
        const LINK_STRENGTH = 0.5; // Stronger links to keep things together
        const CENTER_GRAVITY = 0.02; // Gentle pull to center
        const COLLISION_PADDING = 30; // Less padding to allow tighter packing
        const DAMPING = 0.7;

        const findPrevPosition = (entityName: string) => {
            if (stablePositions.current[entityName]) return stablePositions.current[entityName];
            
            const lowerName = entityName.toLowerCase();
            const cleanName = lowerName.replace(/^(the|a|an)\s+/, '').trim();
            
            for (const key of Object.keys(stablePositions.current)) {
                const lowerKey = key.toLowerCase();
                const cleanKey = lowerKey.replace(/^(the|a|an)\s+/, '').trim();
                if (lowerKey === lowerName || cleanKey === cleanName) {
                    return stablePositions.current[key];
                }
                if (cleanName.length > 2 && cleanKey.includes(cleanName)) {
                    return stablePositions.current[key];
                }
                if (cleanKey.length > 2 && cleanName.includes(cleanKey)) {
                    return stablePositions.current[key];
                }
            }
            return undefined;
        };

        const initRadius = Math.min(containerWidth, containerHeight) * 0.25;
        let nodes: SimulationNode[] = objectEntities.map((entity, i) => {
            const prev = findPrevPosition(entity.name);
            // Only use stable position if it's within reasonable bounds
            if (prev && !isNaN(prev.x) && !isNaN(prev.y)) {
                return {
                    id: entity.name,
                    width: nodeDimensions[entity.name]?.width || 90, 
                    height: nodeDimensions[entity.name]?.height || 36, 
                    x: prev.x, y: prev.y, vx: 0, vy: 0, fx: 0, fy: 0,
                    targetX: prev.x, targetY: prev.y
                };
            }
            const angle = (i / objectEntities.length) * 2 * Math.PI;
            return {
                id: entity.name,
                width: nodeDimensions[entity.name]?.width || 90, 
                height: nodeDimensions[entity.name]?.height || 36, 
                x: initRadius * Math.cos(angle),
                y: initRadius * Math.sin(angle),
                vx: 0, vy: 0, fx: 0, fy: 0,
            };
        });

        const nodeMap = new Map<string, SimulationNode>(nodes.map(n => [n.id, n]));
        
        // Use a temporary type for the map result to avoid type errors before filtering
        const potentialLinks = relationships.map(rel => ({
            source: nodeMap.get(rel.source), 
            target: nodeMap.get(rel.target),
            label: rel.label
        }));

        const links: SimulationLink[] = potentialLinks.filter((r): r is SimulationLink => 
            r.source !== undefined && r.target !== undefined
        );

        for (let tick = 0; tick < SIMULATION_TICKS; tick++) {
            nodes.forEach(node => { node.fx = 0; node.fy = 0; });
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i], nodeB = nodes[j];
                    let dx = nodeB.x - nodeA.x, dy = nodeB.y - nodeA.y;
                    
                    // Add jitter if nodes are exactly on top of each other
                    if (dx === 0 && dy === 0) {
                        dx = (Math.random() - 0.5) * 2;
                        dy = (Math.random() - 0.5) * 2;
                    }
                    
                    let distanceSq = dx * dx + dy * dy;
                    // Cap minimum distance squared to prevent infinite forces (e.g. min distance of 10)
                    if (distanceSq < 100) distanceSq = 100;
                    
                    const distance = Math.sqrt(distanceSq);
                    const force = REPULSION_STRENGTH / distanceSq;
                    if (!nodeA.isFixed) { nodeA.fx -= (dx / distance) * force; nodeA.fy -= (dy / distance) * force; }
                    if (!nodeB.isFixed) { nodeB.fx += (dx / distance) * force; nodeB.fy += (dy / distance) * force; }
                }
            }
            
            links.forEach((link) => {
                const midX = (link.source.x + link.target.x) / 2;
                const midY = (link.source.y + link.target.y) / 2;
                const labelWidth = (link.label || "").length * 6 + 10; 
                nodes.forEach(node => {
                    if (node === link.source || node === link.target) return;
                    let dx = node.x - midX, dy = node.y - midY;
                    if (dx === 0 && dy === 0) {
                        dx = (Math.random() - 0.5) * 2;
                        dy = (Math.random() - 0.5) * 2;
                    }
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 10) dist = 10;
                    const threshold = (labelWidth / 2) + (Math.max(node.width, node.height) / 2) + 20;
                    if (dist < threshold) {
                        const forceStrength = (threshold - dist) * 1.5; 
                        if (!node.isFixed) { node.fx += (dx / dist) * forceStrength; node.fy += (dy / dist) * forceStrength; }
                    }
                });
            });
            for (let i = 0; i < links.length; i++) {
                for (let j = i + 1; j < links.length; j++) {
                     const l1: SimulationLink = links[i];
                     const l2: SimulationLink = links[j];
                     
                     const m1x = (l1.source.x + l1.target.x) / 2, m1y = (l1.source.y + l1.target.y) / 2;
                     const m2x = (l2.source.x + l2.target.x) / 2, m2y = (l2.source.y + l2.target.y) / 2;
                     let dx = m1x - m2x, dy = m1y - m2y;
                     if (dx === 0 && dy === 0) {
                         dx = (Math.random() - 0.5) * 2;
                         dy = (Math.random() - 0.5) * 2;
                     }
                     let dist = Math.sqrt(dx*dx + dy*dy);
                     if (dist < 10) dist = 10;
                     const minDist = ((l1.label?.length || 0)*9+50 + (l2.label?.length || 0)*9+50) / 2 + 30; 
                     if (dist < minDist) {
                         const force = (minDist - dist) * 1.0; 
                         if (!l1.source.isFixed) { l1.source.fx += (dx / dist) * force * 0.5; l1.source.fy += (dy / dist) * force * 0.5; }
                         if (!l1.target.isFixed) { l1.target.fx += (dx / dist) * force * 0.5; l1.target.fy += (dy / dist) * force * 0.5; }
                         if (!l2.source.isFixed) { l2.source.fx -= (dx / dist) * force * 0.5; l2.source.fy -= (dy / dist) * force * 0.5; }
                         if (!l2.target.isFixed) { l2.target.fx -= (dx / dist) * force * 0.5; l2.target.fy -= (dy / dist) * force * 0.5; }
                     }
                }
            }
            
            links.forEach((link) => {
                const dx = link.target.x - link.source.x, dy = link.target.y - link.source.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const sourceR = link.source.width / 2, targetR = link.target.width / 2;
                // Limit the impact of very long labels on edge length, since we truncate to 16 chars anyway
                const idealVisibleLength = Math.min((link.label || "").length, 16) * 5 + 30; 
                const targetDist = sourceR + targetR + idealVisibleLength;
                if (distance > 0) {
                    const diff = distance - targetDist;
                    const force = LINK_STRENGTH * diff;
                    if (!link.source.isFixed) { link.source.fx += (dx / distance) * force; link.source.fy += (dy / distance) * force; }
                    if (!link.target.isFixed) { link.target.fx -= (dx / distance) * force; link.target.fy -= (dy / distance) * force; }
                }
            });
            nodes.forEach(node => {
                if (!node.isFixed) {
                    if (node.targetX !== undefined && node.targetY !== undefined) {
                        const dx = node.targetX - node.x;
                        const dy = node.targetY - node.y;
                        node.fx += dx * 0.05; // Pull towards stable position
                        node.fy += dy * 0.05;
                    } else {
                        const dx = 0 - node.x, dy = 0 - node.y;
                        node.fx += dx * CENTER_GRAVITY; node.fy += dy * CENTER_GRAVITY;
                    }
                }
            });
            nodes.forEach(node => {
                if (!node.isFixed) {
                    node.vx = (node.vx + node.fx) * DAMPING; node.vy = (node.vy + node.fy) * DAMPING;
                    
                    // Cap velocity to prevent nodes from flying off to infinity
                    const MAX_VELOCITY = 50;
                    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                    if (speed > MAX_VELOCITY) {
                        node.vx = (node.vx / speed) * MAX_VELOCITY;
                        node.vy = (node.vy / speed) * MAX_VELOCITY;
                    }
                    
                    node.x += node.vx; node.y += node.vy;
                }
            });
            for(let k = 0; k < 3; k++) {
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const nodeA = nodes[i], nodeB = nodes[j];
                        const dx = nodeB.x - nodeA.x, dy = nodeB.y - nodeA.y;
                        const overlapX = (nodeA.width/2 + nodeB.width/2 + COLLISION_PADDING) - Math.abs(dx);
                        const overlapY = (nodeA.height/2 + nodeB.height/2 + COLLISION_PADDING) - Math.abs(dy);
                        if (overlapX > 0 && overlapY > 0) {
                            if (overlapX < overlapY) {
                                const sign = Math.sign(dx || (Math.random() - 0.5));
                                if (!nodeA.isFixed && !nodeB.isFixed) {
                                    nodeA.x -= overlapX / 2 * sign; nodeB.x += overlapX / 2 * sign;
                                } else if (!nodeA.isFixed) {
                                    nodeA.x -= overlapX * sign;
                                } else if (!nodeB.isFixed) {
                                    nodeB.x += overlapX * sign;
                                }
                            } else {
                                const sign = Math.sign(dy || (Math.random() - 0.5));
                                if (!nodeA.isFixed && !nodeB.isFixed) {
                                    nodeA.y -= overlapY / 2 * sign; nodeB.y += overlapY / 2 * sign;
                                } else if (!nodeA.isFixed) {
                                    nodeA.y -= overlapY * sign;
                                } else if (!nodeB.isFixed) {
                                    nodeB.y += overlapY * sign;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (nodes.length > 0) {
            // Use center of mass instead of bounding box to prevent outliers from shifting the entire graph
            let sumX = 0, sumY = 0;
            nodes.forEach(n => {
                sumX += n.x;
                sumY += n.y;
            });
            
            const centerX = sumX / nodes.length;
            const centerY = sumY / nodes.length;
            
            const offsetX = -centerX;
            const offsetY = -centerY;
            
            nodes.forEach(n => { n.x += offsetX; n.y += offsetY; });
        }
        
        const finalPositions = nodes.reduce((acc, node) => {
            acc[node.id] = { x: node.x, y: node.y }; 
            return acc;
        }, {} as Record<string, { x: number; y: number }>);
        stablePositions.current = finalPositions;
        setNodePositions(finalPositions);
    }
  }, [objectEntities, relationships, nodeDimensions, dimensions]);

  const cardStyle = useMemo(() => {
    if (!selectedEntity || dimensions.width === 0 || !nodePositions[selectedEntity.name]) return undefined;

    const pos = nodePositions[selectedEntity.name];
    const x = (dimensions.width / 2) + pos.x * viewTransform.k + viewTransform.x;
    const y = (dimensions.height / 2) + pos.y * viewTransform.k + viewTransform.y;
    
    // Desktop layout
    if (dimensions.width >= 768) {
        const dims = nodeDimensions[selectedEntity.name];
        // Calculate scaled half-width/height of the node to anchor correctly
        const nodeHalfWidth = (dims?.width / 2 || 45) * viewTransform.k;
        const nodeHalfHeight = (dims?.height / 2 || 18) * viewTransform.k;
        
        const CARD_WIDTH = 384; 
        const PADDING = 20;

        // --- Horizontal Positioning ---
        // Prefer placing to the right
        let left = x + nodeHalfWidth + PADDING;
        
        // If it overflows right edge, try left
        if (left + CARD_WIDTH > dimensions.width - PADDING) {
            left = x - nodeHalfWidth - PADDING - CARD_WIDTH;
        }

        // Keep strictly within horizontal bounds
        if (left < PADDING) left = PADDING;
        if (left + CARD_WIDTH > dimensions.width - PADDING) left = dimensions.width - CARD_WIDTH - PADDING;

        // --- Vertical Positioning ---
        let top: number | 'auto' = 'auto';
        let bottom: number | 'auto' = 'auto';
        let maxHeight = 0;

        // If node is in top half, anchor Top-to-Top (expand downwards)
        if (y < dimensions.height / 2) {
             top = y - nodeHalfHeight; // Align with top of node
             if (top < PADDING) top = PADDING;
             
             // Calculate available height downwards
             maxHeight = dimensions.height - (top as number) - PADDING;
             bottom = 'auto';
        } else {
             // If node is in bottom half, anchor Bottom-to-Bottom (expand upwards)
             const nodeBottom = y + nodeHalfHeight;
             const bottomSpace = dimensions.height - nodeBottom;
             
             // Distance from bottom of container
             bottom = bottomSpace;
             if (bottom < PADDING) bottom = PADDING;
             
             // Calculate available height upwards
             maxHeight = dimensions.height - (bottom as number) - PADDING;
             top = 'auto';
        }

        return { 
            position: 'absolute', 
            left, 
            top, 
            bottom,
            width: CARD_WIDTH, 
            maxHeight,
            display: 'flex', 
            flexDirection: 'column' 
        } as React.CSSProperties;
    }
    
    // Mobile fallback (centered modal)
    return undefined; 
  }, [selectedEntity, nodePositions, viewTransform, nodeDimensions, dimensions]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full flex flex-col min-h-0 relative transition-colors duration-200 shadow-sm flex-1`}>
      
      {isLoading && (!data || view !== 'graph') && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-30 rounded-lg transition-opacity duration-300 min-h-0">
            <div className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 max-w-sm w-full mx-4">
                <div className="relative mb-4">
                     <svg className="animate-spin h-10 w-10 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <ThinkingProcess prompt={currentPrompt} />
            </div>
        </div>
      )}
      
      {isLoading && data && view === 'graph' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/30 dark:bg-gray-900/30 cursor-not-allowed rounded-lg">
              <div className="bg-white dark:bg-gray-800 px-5 py-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Updating Graph...</span>
              </div>
          </div>
      )}

      {/* Attributes View */}
      <div style={{ display: view === 'attributes' ? 'flex' : 'none' }} className="flex flex-col w-full bg-white dark:bg-gray-800 rounded-lg flex-1 min-h-0 overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <div className={`p-6 space-y-2 flex-grow flex flex-col ${(!sceneEntity || sceneEntity.attributes.length === 0) ? 'justify-center items-center' : ''}`}>
          {isLoading && (!sceneEntity || sceneEntity.attributes.length === 0) && (
              <div className="space-y-4 w-full">
                  {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
                  ))}
              </div>
          )}
          {sceneEntity && sceneEntity.attributes.length > 0 ? (
            sortAttributes(sceneEntity.attributes)
            .map(attr => {
              // Filter out Existence and meta-attributes from this view
              const lowerName = attr.name.toLowerCase();
              if (lowerName === 'existence' || lowerName === 'existence_in_image' || lowerName === 'presence_in_prompt' || lowerName === 'presence in prompt' || lowerName === 'explicit' || lowerName === 'implicit' || lowerName === 'absent' || lowerName === 'mentioned') return null;
              return (
                <AttributeEditor 
                    key={`${sceneEntity.name}-${attr.name}`} 
                    attribute={attr} 
                    entity={sceneEntity} 
                    onChange={handleAttributeChange} 
                    isLoading={isLoading}
                    pendingValue={pendingAttributeUpdates[`${sceneEntity.name}:${attr.name}`]}
                />
              );
            })
          ) : (
             !isLoading && <EmptyStatePlaceholder text={
                <div className="flex flex-col gap-2">
                    <span>Click <span className="font-bold text-blue-600 dark:text-blue-400">Refine prompt</span> to generate attributes.</span>
                    <span className="text-base text-gray-400 dark:text-gray-500 font-normal max-w-sm mx-auto">
                        Review and tweak overall attributes like atmosphere, genre, or camera movement tailored to your generation mode.
                    </span>
                </div>
            } />
          )}
        </div>
      </div>

      {/* Graph View */}
      <div 
        ref={containerRef}
        style={{ display: view === 'graph' ? 'flex' : 'none', touchAction: 'none' }} 
        className="flex-col w-full h-full cursor-move active:cursor-grabbing relative rounded-lg focus:outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleGraphKeyDown}
        tabIndex={isLoading ? -1 : 0}
      >
        <div 
          className={`relative bg-gray-50/50 dark:bg-gray-900/50 w-full h-full overflow-hidden rounded-lg ${!data && !isLoading ? 'flex items-center justify-center p-6' : ''}`} 
          ref={measureRef}
        >
            {data && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-40">
                    <Tooltip content="Zoom In" position="right">
                        <button tabIndex={selectedEntity || selectedRel || isLoading ? -1 : 0} onClick={zoomIn} className="bg-white dark:bg-gray-700 p-2 rounded shadow text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        </button>
                    </Tooltip>
                    <Tooltip content="Zoom Out" position="right">
                        <button tabIndex={selectedEntity || selectedRel || isLoading ? -1 : 0} onClick={zoomOut} className="bg-white dark:bg-gray-700 p-2 rounded shadow text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                        </button>
                    </Tooltip>
                    <Tooltip content="Reset View" position="right">
                        <button tabIndex={selectedEntity || selectedRel || isLoading ? -1 : 0} onClick={resetView} className="bg-white dark:bg-gray-700 p-2 rounded shadow text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        </button>
                    </Tooltip>
                </div>
            )}
            
            {data && <Legend />}

            {!data && !isLoading && (
               <EmptyStatePlaceholder text={
                   <div className="flex flex-col gap-2">
                       <span>Click <span className="font-bold text-blue-600 dark:text-blue-400">Refine prompt</span> to visualize the belief graph.</span>
                       <span className="text-base text-gray-400 dark:text-gray-500 font-normal max-w-sm mx-auto">
                           Explore implicit assumptions. Click on nodes to edit attributes, or edges to modify relationships.
                       </span>
                   </div>
               } />
            )}

            {data && (
              <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width || 600} ${dimensions.height || 200}`} className="overflow-hidden select-none">
                  <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-400 dark:fill-gray-500" /></marker></defs>
                  
                  <g transform={`translate(${dimensions.width / 2 + viewTransform.x}, ${dimensions.height / 2 + viewTransform.y}) scale(${viewTransform.k})`}>
                    {activeRelationships.map((rel, i) => {
                        const sourcePos = nodePositions[rel.source];
                        const targetPos = nodePositions[rel.target];
                        
                        if (!sourcePos || !targetPos) return null;
                        const sourceDims = nodeDimensions[rel.source];
                        const targetDims = nodeDimensions[rel.target];
                        if (!sourceDims || !targetDims) return null;

                        const { path, labelX, labelY } = getEdgePath(
                            sourcePos.x, sourcePos.y, 
                            targetPos.x, targetPos.y, 
                            sourceDims.width, sourceDims.height,
                            targetDims.width, targetDims.height
                        );

                        let opacity = 1;
                        if (hoveredRel) opacity = (rel === hoveredRel) ? 1 : 0.4;
                        else if (hoveredEntity) opacity = (rel.source === hoveredEntity || rel.target === hoveredEntity) ? 1 : 0.4;
                        else if (selectedEntity) opacity = (rel.source === selectedEntity.name || rel.target === selectedEntity.name) ? 1 : 0.4;

                        const isSelected = selectedRel?.rel.source === rel.source && selectedRel?.rel.target === rel.target && selectedRel?.rel.label === rel.label;
                        const isModified = pendingRelationshipUpdates[`${rel.source}:${rel.target}`] !== undefined;
                        const currentLabel = pendingRelationshipUpdates[`${rel.source}:${rel.target}`] || rel.label;
                        const isImplicit = rel.presence_in_prompt === false;

                        return (
                        <g 
                            key={`${rel.source}-${rel.target}-${rel.label}`}
                            style={{ opacity }}
                            ref={el => relRefs.current[`${rel.source}-${rel.target}`] = el as SVGGElement}
                            className="cursor-pointer group focus:outline-none"
                            onMouseEnter={() => setHoveredRel(rel)}
                            onMouseLeave={() => setHoveredRel(null)}
                            onPointerDown={(e) => { e.stopPropagation(); }} 
                            onClick={(e) => { e.stopPropagation(); handleRelationshipClick(rel, e); relRefs.current[`${rel.source}-${rel.target}`]?.focus(); }}
                            tabIndex={isLoading ? -1 : 0}
                            focusable={isLoading ? "false" : "true"}
                            role="button"
                            aria-label={`Select relationship ${rel.label} from ${rel.source} to ${rel.target}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleRelationshipClick(rel, e); } }}
                        >
                            <path 
                                d={path} 
                                stroke="#8b5cf6" 
                                strokeWidth="6" 
                                fill="none" 
                                className="opacity-0 group-focus:opacity-50 transition-opacity"
                            />
                            <path 
                                d={path} 
                                className={`
                                    fill-none transition-colors group-focus:stroke-blue-500 dark:group-focus:stroke-blue-400
                                    ${isModified || isSelected ? 'stroke-blue-500 dark:stroke-blue-400' : 'stroke-gray-400 dark:stroke-gray-600'}
                                `}
                                strokeWidth={isModified ? "3" : "2"} 
                                markerEnd="url(#arrowhead)" 
                                strokeDasharray={!isModified && isImplicit ? "4 2" : "none"}
                            />
                            <text 
                                x={labelX} y={labelY + 4} 
                                textAnchor="middle" 
                                className={`text-[10px] font-bold ${isModified ? 'fill-blue-700 dark:fill-blue-400' : (isSelected ? 'fill-blue-800 dark:fill-blue-300' : 'fill-gray-800 dark:fill-gray-200')} stroke-white dark:stroke-gray-800`}
                                strokeWidth="8px" 
                                strokeLinejoin="round" 
                                paintOrder="stroke"
                            >
                            {truncate(currentLabel, 16)}
                            </text>
                        </g>
                        );
                    })}
                    {objectEntities.map(entity => {
                        const pos = nodePositions[entity.name];
                        if (!pos) return null;
                        const isSelected = selectedEntity?.name === entity.name;
                        const dims = nodeDimensions[entity.name];
                        const hasModifiedAttr = Object.keys(pendingAttributeUpdates).some(k => k.startsWith(`${entity.name}:`));
                        const isPresent = isEntityPresent(entity);

                        let opacity = 1;
                        if (hoveredRel) opacity = (entity.name === hoveredRel.source || entity.name === hoveredRel.target) ? 1 : 0.4;
                        else if (hoveredEntity) opacity = (entity.name === hoveredEntity || neighborsOfHovered.has(entity.name)) ? 1 : 0.4;
                        else if (selectedEntity) opacity = (entity.name === selectedEntity.name || (neighborsOfSelected && neighborsOfSelected.has(entity.name))) ? 1 : 0.4;

                        return (
                        <g 
                            key={entity.name} 
                            transform={`translate(${pos.x || 0}, ${pos.y || 0})`}
                            style={{ opacity }}
                            ref={el => nodeRefs.current[entity.name] = el as SVGGElement}
                            onClick={(e) => { e.stopPropagation(); setSelectedEntity(entity); setSelectedRel(null); nodeRefs.current[entity.name]?.focus(); }}
                            onMouseEnter={() => setHoveredEntity(entity.name)} 
                            onMouseLeave={() => setHoveredEntity(null)}
                            className="group focus:outline-none cursor-pointer"
                            tabIndex={isLoading ? -1 : 0}
                            focusable={isLoading ? "false" : "true"}
                            role="button"
                            aria-label={`Select entity ${entity.name}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedEntity(entity); setSelectedRel(null); } }}
                        >
                            <rect 
                                x={-(dims?.width || 90) / 2 - 4} 
                                y={-(dims?.height || 36) / 2 - 4} 
                                width={(dims?.width || 90) + 8} 
                                height={(dims?.height || 36) + 8} 
                                rx="10"
                                fill="none"
                                stroke="#8b5cf6"
                                strokeWidth="2"
                                className="opacity-0 group-focus:opacity-100 transition-opacity"
                            />
                            <rect 
                                x={-(dims?.width || 90) / 2} 
                                y={-(dims?.height || 36) / 2} 
                                width={dims?.width || 90} 
                                height={dims?.height || 36} 
                                rx="8"
                                className={`
                                    transition-colors
                                    ${isSelected 
                                        ? (isPresent ? 'fill-yellow-100 dark:fill-yellow-900/40 stroke-yellow-400 dark:stroke-yellow-500' : 'fill-yellow-200 dark:fill-yellow-800/40 stroke-yellow-400 dark:stroke-yellow-500')
                                        : (!isPresent 
                                            ? 'fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600' 
                                            : (hasModifiedAttr 
                                                ? 'fill-blue-50 dark:fill-blue-900/30 stroke-blue-500 dark:stroke-blue-400' 
                                                : (entity.presence_in_prompt 
                                                    ? 'fill-white dark:fill-gray-800 stroke-gray-700 dark:stroke-gray-300' 
                                                    : 'fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600')
                                              )
                                          )
                                    }
                                    group-focus:stroke-blue-500 dark:group-focus:stroke-blue-400
                                `}
                                strokeWidth={isSelected || (hasModifiedAttr && isPresent) ? "2.5" : (entity.presence_in_prompt && isPresent ? "2" : "1.5")} 
                                strokeDasharray={!isPresent ? 'none' : (entity.presence_in_prompt ? 'none' : '4 2')}
                            />
                            <text 
                                textAnchor="middle" 
                                dy="0.3em" 
                                className={`text-[12px] font-semibold ${isPresent ? 'fill-gray-800 dark:fill-gray-200' : 'fill-gray-400 dark:fill-gray-500'}`}
                                textDecoration={isPresent ? "none" : "line-through"}
                            >
                                {entity.name}
                            </text>
                        </g>
                        );
                    })}
                  </g>
              </svg>
            )}

            {/* Entity Card */}
            {selectedEntity && (
                <div 
                    style={cardStyle || {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90%',
                        maxWidth: '384px',
                        maxHeight: '80%',
                    }} 
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 overflow-y-auto flex flex-col"
                    onPointerDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">{selectedEntity.name}</h3>
                        <button onClick={() => setSelectedEntity(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">&times;</button>
                    </div>
                    <div className="space-y-1 flex-grow overflow-y-auto pr-1">
                        {sortAttributes(
                            selectedEntity.attributes.some(a => a.name === 'existence' || a.name === 'existence_in_image')
                                ? selectedEntity.attributes
                                : [{ name: 'existence', value: [{ name: 'true', probability: 1 }], presence_in_prompt: selectedEntity.presence_in_prompt }, ...selectedEntity.attributes]
                        ).filter(attr => {
                            const lowerName = attr.name.toLowerCase();
                            return lowerName !== 'presence_in_prompt' && lowerName !== 'presence in prompt' && lowerName !== 'explicit' && lowerName !== 'implicit' && lowerName !== 'absent' && lowerName !== 'mentioned';
                        }).map(attr => (
                            <AttributeEditor 
                                key={`${selectedEntity.name}-${attr.name}`}
                                attribute={attr}
                                entity={selectedEntity}
                                onChange={handleAttributeChange}
                                isLoading={isLoading}
                                pendingValue={pendingAttributeUpdates[`${selectedEntity.name}:${attr.name}`]}
                            />
                        ))}
                    </div>
                </div>
            )}

            {selectedRel && (
                <RelationshipEditor 
                    rel={selectedRel.rel}
                    position={selectedRel.position}
                    containerDimensions={dimensions}
                    onChange={(newLabel) => handleRelationshipChange(selectedRel.rel.source, selectedRel.rel.target, newLabel)}
                    onClose={() => setSelectedRel(null)}
                    isLoading={isLoading}
                />
            )}

            {data && objectEntities.length === 0 && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-gray-500 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium">No other entities found to visualize.</p>
                    </div>
                  </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default BeliefGraph;
