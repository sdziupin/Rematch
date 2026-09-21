import { and, desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { ActiveWorkoutState, ScalingCategory, SessionRoundState, WorkoutStructure } from '../domain/types';
import { compareCheckpoints } from '../domain/rematch';
import type { RematchComparison } from '../domain/types';

import { createActiveState as buildState } from '../engine/workoutEngine';

const now = () => Date.now();

export async function createSession(params: {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  scalingCategory: ScalingCategory;
  structure: WorkoutStructure;
  partialKey: ActiveWorkoutState['partialKey'];
  opponentSessionId?: string | null;
}) {
  const db = getDb();
  const id = uuid();
  const state = buildState(
    params.workoutId,
    params.workoutVersionId,
    params.workoutVariantId,
    params.partialKey,
    params.scalingCategory,
    params.structure,
  );
  const ts = now();
  await db.insert(schema.workoutSessions).values({
    id,
    workoutId: params.workoutId,
    workoutVersionId: params.workoutVersionId,
    workoutVariantId: params.workoutVariantId,
    opponentSessionId: params.opponentSessionId ?? null,
    scalingCategory: params.scalingCategory,
    status: 'countdown',
    startedAt: null,
    completedAt: null,
    elapsedActiveMs: 0,
    pausedAccumulatedMs: 0,
    lastPausedAt: null,
    currentStateJson: JSON.stringify(state),
    createdAt: ts,
    updatedAt: ts,
  });
  return { sessionId: id, state };
}

export async function saveSessionState(
  sessionId: string,
  state: ActiveWorkoutState,
  timer: { elapsedActiveMs: number; pausedAccumulatedMs: number; lastPausedAt: number | null; status: string; startedAt: number | null },
) {
  const db = getDb();
  await db
    .update(schema.workoutSessions)
    .set({
