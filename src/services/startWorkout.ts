import { loadWorkoutPlan } from '../db/repository';
import type { PartialKey, ScalingCategory } from '../domain/types';
import { useSettings } from '../store/settingsStore';
import { useWorkoutStore } from '../store/workoutStore';
import { abandonSession, createSession, getActiveSession } from './sessionService';
import { getWorkoutById } from '../db/repository';
import type { ActiveWorkoutState } from '../domain/types';

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

/**
 * If another workout is still in progress, asks (via `confirm`) whether to end
 * it. Its work is kept as an unfinished result. Returns false to cancel.
 */
export async function resolveDanglingSession(confirm: (name: string) => Promise<boolean>): Promise<boolean> {
  const active = await getActiveSession();
  if (!active) return true;
  const workout = await getWorkoutById(active.workoutId);
  const ok = await confirm(workout?.name ?? 'A workout');
  if (!ok) return false;
  let state: ActiveWorkoutState | null = null;
  try {
    state = JSON.parse(active.currentStateJson) as ActiveWorkoutState;
  } catch {
    state = null;
  }
  await abandonSession(active.id, state, active.elapsedActiveMs);
  return true;
}
