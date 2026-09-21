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

export const EXERCISE_SEEDS: ExerciseSeed[] = [
  { id: 'wall-push-up', name: 'Wall Push-up', description: 'Incline push pattern against a wall.', instructions: 'Stand arm\'s length from wall, hands at chest height.', startPosition: 'Stand facing wall, palms flat.', movementSequence: 'Bend elbows to bring chest toward wall, press back.', cues: ['Brace core', 'Elbows at 45°'], mistakes: ['Sagging hips'], primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'], category: 'push', equipment: ['bodyweight'], impactLevel: 'low', harderVariantId: 'knee-push-up', visualAsset: 'exercises/wall-push-up' },
