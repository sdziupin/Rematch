import { loadWorkoutPlan } from '../db/repository';
import type { PartialKey, ScalingCategory } from '../domain/types';
import { useSettings } from '../store/settingsStore';
import { useWorkoutStore } from '../store/workoutStore';
import { createSession } from './sessionService';

export interface StartOptions {
  workoutId: string;
  partialKey: PartialKey;
  scalingCategory: ScalingCategory;
  swaps?: Record<string, string>;
  opponentSessionId?: string | null;
  programEnrollmentId?: string | null;
  programSessionKey?: string | null;
}

/** Creates the session and loads it into the active-workout store. */
export async function beginWorkout(options: StartOptions): Promise<string> {
  const plan = await loadWorkoutPlan(options.workoutId, options.partialKey);
  if (!plan) throw new Error('This workout could not be loaded.');
  const { sessionId, state } = await createSession({
    workoutId: plan.workout.id,
    workoutVersionId: plan.version.id,
    workoutVariantId: plan.variant.id,
    scalingCategory: options.scalingCategory,
    structure: plan.structure,
    partialKey: options.partialKey,
    swaps: options.swaps,
    opponentSessionId: options.opponentSessionId ?? null,
    countdownSec: useSettings.getState().countdownSec,
    programEnrollmentId: options.programEnrollmentId ?? null,
    programSessionKey: options.programSessionKey ?? null,
  });
  useWorkoutStore.getState().setSession(sessionId, state, options.opponentSessionId ?? null);
  return sessionId;
}
