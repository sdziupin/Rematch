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
      currentStateJson: JSON.stringify(state),
      status: timer.status,
      startedAt: timer.startedAt,
      elapsedActiveMs: timer.elapsedActiveMs,
      pausedAccumulatedMs: timer.pausedAccumulatedMs,
      lastPausedAt: timer.lastPausedAt,
      updatedAt: now(),
    })
    .where(eq(schema.workoutSessions.id, sessionId));
}

export async function appendEvent(sessionId: string, type: string, payload: Record<string, unknown>, elapsedActiveMs: number) {
  const db = getDb();
  await db.insert(schema.workoutSessionEvents).values({
    id: uuid(),
    sessionId,
    type,
    payloadJson: JSON.stringify(payload),
    elapsedActiveMs,
    createdAt: now(),
  });
}

export async function addCheckpoint(sessionId: string, checkpointKey: string, label: string, elapsedActiveMs: number) {
  const db = getDb();
  await db.insert(schema.workoutCheckpoints).values({
    id: uuid(),
    sessionId,
    checkpointKey,
    label,
    elapsedActiveMs,
    createdAt: now(),
  });
}

export async function getActiveSession() {
  const db = getDb();
  const statuses = ['active', 'paused', 'countdown'] as const;
  for (const status of statuses) {
    const rows = await db
      .select()
      .from(schema.workoutSessions)
      .where(eq(schema.workoutSessions.status, status))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function getSession(id: string) {
  const db = getDb();
  const rows = await db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCheckpoints(sessionId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.workoutCheckpoints)
    .where(eq(schema.workoutCheckpoints.sessionId, sessionId))
    .orderBy(schema.workoutCheckpoints.elapsedActiveMs);
}

export async function completeSession(sessionId: string, completionMs: number, isComplete: boolean, abandoned = false) {
  const db = getDb();
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const resultId = uuid();
  const ts = now();
  await db.insert(schema.workoutResults).values({
    id: resultId,
    sessionId,
    workoutId: session.workoutId,
    workoutVersionId: session.workoutVersionId,
    workoutVariantId: session.workoutVariantId,
    scalingCategory: session.scalingCategory,
    completionMs,
    isComplete,
    isAbandoned: abandoned,
    createdAt: ts,
  });

  await db
    .update(schema.workoutSessions)
    .set({ status: abandoned ? 'abandoned' : 'completed', completedAt: ts, elapsedActiveMs: completionMs, updatedAt: ts })
    .where(eq(schema.workoutSessions.id, sessionId));

  if (isComplete && !abandoned) {
    await maybeUpdatePb(session, resultId, completionMs, ts);
  }

  return resultId;
}

async function maybeUpdatePb(
  session: typeof schema.workoutSessions.$inferSelect,
  resultId: string,
  completionMs: number,
  ts: number,
) {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.personalBests)
    .where(
      and(
        eq(schema.personalBests.workoutId, session.workoutId),
        eq(schema.personalBests.workoutVersionId, session.workoutVersionId),
        eq(schema.personalBests.workoutVariantId, session.workoutVariantId),
        eq(schema.personalBests.scalingCategory, session.scalingCategory),
      ),
    )
    .limit(1);

  if (!existing[0] || completionMs < existing[0].completionMs) {
    if (existing[0]) {
      await db.delete(schema.personalBests).where(eq(schema.personalBests.id, existing[0].id));
    }
    await db.insert(schema.personalBests).values({
      id: uuid(),
