export type ScalingCategory = 'rx' | 'scaled' | 'modified';
export type WorkoutFormat = 'fixed_rounds' | 'chipper' | 'ladder' | 'intervals' | 'amrap';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PartialKey = 'full' | 'three_quarter' | 'half' | 'quarter';

export interface WorkoutExerciseStep {
  exerciseId: string;
  reps?: number;
  durationSec?: number;
  label?: string;
}

export interface WorkoutRound {
  roundNumber: number;
  steps: WorkoutExerciseStep[];
}

export interface WorkoutStructure {
  format: WorkoutFormat;
  rounds: WorkoutRound[];
  timeCapSec?: number;
  restBetweenRoundsSec?: number;
  intervalWorkSec?: number;
  intervalRestSec?: number;
  intervalRounds?: number;
}

export interface SessionExerciseState {
  exerciseId: string;
  scaledExerciseId: string;
  targetReps: number;
  completedReps: number;
  durationSec?: number;
}

export interface SessionRoundState {
  roundNumber: number;
  exercises: SessionExerciseState[];
  completed: boolean;
}

export interface ActiveWorkoutState {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  partialKey: PartialKey;
  scalingCategory: ScalingCategory;
  structure: WorkoutStructure;
  currentRoundIndex: number;
  currentExerciseIndex: number;
  rounds: SessionRoundState[];
  phase: 'countdown' | 'active' | 'paused' | 'completed';
  countdownRemaining: number;
}

export type SessionEventType =
  | 'WorkoutStarted'
  | 'RoundStarted'
  | 'ExerciseStarted'
  | 'RepMilestone'
  | 'ExerciseCompleted'
  | 'RoundCompleted'
  | 'WorkoutPaused'
