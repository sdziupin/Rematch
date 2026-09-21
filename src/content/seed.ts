import type { WorkoutStructure } from '../domain/types';

export interface ExerciseSeed {
  id: string;
  name: string;
  description: string;
  instructions: string;
  startPosition: string;
  movementSequence: string;
  cues: string[];
  mistakes: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  category: string;
  equipment: string[];
  impactLevel: 'low' | 'medium' | 'high';
  easierVariantId?: string;
  harderVariantId?: string;
  visualAsset: string;
}
