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
