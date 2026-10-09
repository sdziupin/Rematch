export type ScalingCategory = 'rx' | 'scaled' | 'modified';
export type WorkoutFormat = 'fixed_rounds' | 'chipper' | 'ladder' | 'intervals' | 'amrap' | 'emom';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PartialKey = 'full' | 'three_quarter' | 'half' | 'quarter';

/** How a finished session is ranked. */
export type ScoreType = 'time' | 'reps';

/**
 * How the live race compares you against a past attempt.
 * - pace: who reached each checkpoint first (for time, AMRAP)
 * - volume: who banked more reps at each checkpoint (intervals, EMOM: the clock is fixed)
 */
export type RaceMode = 'pace' | 'volume';

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
  /** AMRAP: the workout length. For time formats: optional cap. */
  timeCapSec?: number;
  restBetweenRoundsSec?: number;
  /** Intervals: work seconds per interval. EMOM: window length (default 60). */
  intervalWorkSec?: number;
  intervalRestSec?: number;
  /** Intervals / EMOM: number of work intervals (minutes for EMOM). */
  intervalRounds?: number;
}

export interface SessionExerciseState {
  exerciseId: string;
  scaledExerciseId: string;
  targetReps: number;
  completedReps: number;
  durationSec?: number;
  done?: boolean;
}

export interface SessionRoundState {
  roundNumber: number;
  exercises: SessionExerciseState[];
  completed: boolean;
  /** Rest after this round, in seconds. */
  restAfterSec?: number;
  /** EMOM: the round must fit inside this window; the remainder is rest. */
  windowSec?: number;
}

export type WorkoutPhase = 'countdown' | 'active' | 'rest' | 'paused' | 'completed';

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
  phase: WorkoutPhase;
  countdownRemaining: number;
  /** Engine v2 fields. Older persisted states are upgraded by `normalizeState`. */
  engineVersion?: number;
  scoring?: ScoreType;
  raceMode?: RaceMode;
  /** Phase to return to when a pause ends. */
  resumePhase?: 'active' | 'rest';
  /** Elapsed active ms at which the current step started. */
  stepStartedAtMs?: number;
  /** Elapsed active ms at which the current round started (EMOM windows). */
  roundStartedAtMs?: number;
  /** Elapsed active ms at which the current rest started / ends. */
  restStartedAtMs?: number | null;
  restEndsAtMs?: number | null;
  /** AMRAP: completed passes through the round list. */
  loop?: number;
  /** Reps banked in completed steps. */
  totalReps?: number;
  /** Rounds completed so far (AMRAP keeps counting across passes). */
  roundsCompleted?: number;
  /** Elapsed ms at which the workout ends on its own (AMRAP, caps, EMOM). */
  timeCapMs?: number | null;
  /** RX exercise id -> exercise actually performed. */
  exerciseSwaps?: Record<string, string>;
  endedBy?: 'finished' | 'time_cap';
}

export type SessionEventType =
  | 'WorkoutStarted'
  | 'RoundStarted'
  | 'ExerciseStarted'
  | 'RepMilestone'
  | 'ExerciseCompleted'
  | 'RoundCompleted'
  | 'RestStarted'
  | 'RestSkipped'
  | 'WorkoutPaused'
  | 'WorkoutResumed'
  | 'ExerciseScaled'
  | 'ExerciseSubstituted'
  | 'TimeCapReached'
  | 'WorkoutCompleted'
  | 'WorkoutAbandoned';

export interface CompatibilityKey {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  scalingCategory: ScalingCategory;
}

export interface CheckpointComparison {
  checkpointKey: string;
  label: string;
  deltaMs: number;
  youMs: number;
  opponentMs: number;
  youReps?: number;
  opponentReps?: number;
}

export interface RematchComparison {
  youMs: number;
  opponentMs: number;
  deltaMs: number;
  won: boolean;
  tied: boolean;
  checkpoints: CheckpointComparison[];
  isNewPb: boolean;
  previousPbMs: number | null;
  scoreType?: ScoreType;
  youReps?: number;
  opponentReps?: number;
}

/** A finished result in the shape the scoring helpers need. */
export interface ScoreLike {
  completionMs: number;
  scoreType: ScoreType;
  scoreReps: number | null;
  isComplete: boolean;
  isAbandoned: boolean;
  timeCapped?: boolean;
}
