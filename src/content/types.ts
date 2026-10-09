import type { Difficulty, PartialKey, WorkoutStructure } from '../domain/types';

/** Canonical muscle ids, used by the body map and muscle filters. */
export const MUSCLES = [
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'upper_back',
  'lats',
  'lower_back',
  'abs',
  'obliques',
  'hip_flexors',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const;
export type MuscleId = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  upper_back: 'Upper back',
  lats: 'Lats',
  lower_back: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  hip_flexors: 'Hip flexors',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

/** Canonical equipment ids. 'bodyweight' means no equipment. */
export const EQUIPMENT = ['bodyweight', 'mat', 'pull-up-bar', 'dumbbells', 'kettlebell', 'bench', 'jump-rope', 'band'] as const;
export type EquipmentId = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  bodyweight: 'Bodyweight',
  mat: 'Mat',
  'pull-up-bar': 'Pull-up bar',
  dumbbells: 'Dumbbells',
  kettlebell: 'Kettlebell',
  bench: 'Bench / box',
  'jump-rope': 'Jump rope',
  band: 'Resistance band',
};

/** Older profiles stored free-text equipment names. */
export function normalizeEquipment(list: string[]): EquipmentId[] {
  const out = new Set<EquipmentId>(['bodyweight']);
  for (const raw of list) {
    const id = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (id === 'pull-up-bar' || id === 'pullup-bar') out.add('pull-up-bar');
    else if ((EQUIPMENT as readonly string[]).includes(id)) out.add(id as EquipmentId);
    else if (id === 'resistance-band' || id === 'bands') out.add('band');
    else if (id === 'box') out.add('bench');
  }
  return [...out];
}

export const EXERCISE_CATEGORIES = [
  'push',
  'pull',
  'squat',
  'lunge',
  'hinge',
  'core',
  'cardio',
  'conditioning',
  'accessory',
  'mobility',
  'recovery',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export interface ExerciseSeed {
  id: string;
  name: string;
  description: string;
  instructions: string;
  startPosition: string;
  movementSequence: string;
  cues: string[];
  mistakes: string[];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  category: ExerciseCategory;
  equipment: EquipmentId[];
  impactLevel: 'low' | 'medium' | 'high';
  easierVariantId?: string;
  harderVariantId?: string;
  visualAsset: string;
}

export type WorkoutKind = 'benchmark' | 'warmup' | 'cooldown';

export interface WorkoutSeed {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  focus: string;
  difficulty: Difficulty;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  equipment: EquipmentId[];
  format: WorkoutStructure['format'];
  identityColor: string;
  progressionTier: string;
  structure: WorkoutStructure;
  /** One sentence shown on the workout page. */
  description?: string;
  /** Defaults to 'benchmark'. Warm-ups and cool-downs are not raced. */
  kind?: WorkoutKind;
}

export interface ProgramSession {
  week: number;
  day: number;
  workoutId: string;
  partialKey?: PartialKey;
  /** Coaching note for this session, one short sentence. */
  note?: string;
}

export interface ProgramSeed {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  identityColor: string;
  tagline: string;
  description: string;
  level: Difficulty;
  goal: 'general_fitness' | 'conditioning' | 'strength_endurance' | 'consistency';
  weeks: number;
  daysPerWeek: number;
  equipment: EquipmentId[];
  sessions: ProgramSession[];
}
