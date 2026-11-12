
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Candidate {
  name: string; 
}

export interface Attribute {
  name:string;
  presence_in_prompt: boolean;
  value: Candidate[];
}

export interface Entity {
  name: string;
  presence_in_prompt: boolean;
  description: string;
  alternatives: Candidate[] | null;
  attributes: Attribute[];
}

export interface Relationship {
  source: string;
  target: string;
  label: string;
  alternatives?: Candidate[];
  presence_in_prompt?: boolean;
}

export interface BeliefState {
  entities: Entity[];
  relationships: Relationship[];
  prompt?: string;
}

export interface Clarification {
  question: string;
  options: string[];
}

export interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface GeneratedImage {
    url: string | null;
    error?: string;
}

export type ImageSize = '512px' | '1K' | '2K' | '4K';
export type VideoResolution = '720p' | '1080p';
export type StoryType = 'generic' | 'video-prompt';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '1:4' | '1:8' | '4:1' | '8:1';
export type Proactiveness = 'low' | 'medium' | 'high';

export type GraphUpdate = 
  | { type: 'attribute'; entity: string; attribute: string; value: string }
  | { type: 'relationship'; source: string; target: string; oldLabel: string; newLabel: string };
