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
  { id: 'knee-push-up', name: 'Knee Push-up', description: 'Scaled push-up from knees.', instructions: 'Knees down, hands under shoulders.', startPosition: 'High plank from knees.', movementSequence: 'Lower chest between hands, press up.', cues: ['Straight line knee to head'], mistakes: ['Hips piking up'], primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps'], category: 'push', equipment: ['mat'], impactLevel: 'low', easierVariantId: 'wall-push-up', harderVariantId: 'push-up', visualAsset: 'exercises/knee-push-up' },
  { id: 'push-up', name: 'Push-up', description: 'Standard floor push-up.', instructions: 'Hands shoulder-width, full body plank.', startPosition: 'High plank.', movementSequence: 'Lower chest to floor, full extension up.', cues: ['Ribs down', 'Glutes tight'], mistakes: ['Partial range'], primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Core'], category: 'push', equipment: ['bodyweight'], impactLevel: 'medium', easierVariantId: 'knee-push-up', harderVariantId: 'decline-push-up', visualAsset: 'exercises/push-up' },
