import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb, withTransaction, type Db } from '../db/client';
import * as schema from '../db/schema';
import { createId } from '../domain/id';
import { compareCheckpoints, compareScores, isBetterScore, isPbEligible, type OpponentCheckpoint } from '../domain/rematch';
import type { ActiveWorkoutState, PartialKey, RematchComparison, ScalingCategory, ScoreLike, ScoreType, WorkoutStructure } from '../domain/types';
import { createActiveState, type EngineEvent } from '../engine/workoutEngine';

const now = () => Date.now();

export interface CompatKey {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  scalingCategory: ScalingCategory | string;
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function createSession(params: {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  scalingCategory: ScalingCategory;
  structure: WorkoutStructure;
  partialKey: PartialKey;
  opponentSessionId?: string | null;
  swaps?: Record<string, string>;
  countdownSec?: number;
  programEnrollmentId?: string | null;
  programSessionKey?: string | null;
}) {
  const id = createId();
  const state = createActiveState(
    params.workoutId,
    params.workoutVersionId,
    params.workoutVariantId,
    params.partialKey,
    params.scalingCategory,
    params.structure,
    { swaps: params.swaps, countdownSec: params.countdownSec },
  );
  const ts = now();
  await withTransaction(async (tx) => {
    // Only one live session at a time: anything left hanging is abandoned.
    const stale = await tx.select({ id: schema.workoutSessions.id }).from(schema.workoutSessions).where(inArray(schema.workoutSessions.status, ['countdown', 'active', 'paused']));
    for (const s of stale) {
      await tx.update(schema.workoutSessions).set({ status: 'abandoned', updatedAt: ts }).where(eq(schema.workoutSessions.id, s.id));
    }
    await tx.insert(schema.workoutSessions).values({
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
      programEnrollmentId: params.programEnrollmentId ?? null,
      programSessionKey: params.programSessionKey ?? null,
      createdAt: ts,
      updatedAt: ts,
    });
  });
  return { sessionId: id, state };
}

export async function saveSessionState(
  sessionId: string,
  state: ActiveWorkoutState,
  timer: { elapsedActiveMs: number; pausedAccumulatedMs: number; lastPausedAt: number | null; status: string; startedAt: number | null },
) {
  await getDb()
    .update(schema.workoutSessions)
    .set({
      currentStateJson: JSON.stringify(state),
      status: timer.status,
      startedAt: timer.startedAt,
      scalingCategory: state.scalingCategory,
      elapsedActiveMs: Math.round(timer.elapsedActiveMs),
      pausedAccumulatedMs: Math.round(timer.pausedAccumulatedMs),
      lastPausedAt: timer.lastPausedAt,
      updatedAt: now(),
    })
    .where(eq(schema.workoutSessions.id, sessionId));
}

export async function appendEvent(sessionId: string, type: string, payload: Record<string, unknown>, elapsedActiveMs: number) {
  await getDb()
    .insert(schema.workoutSessionEvents)
    .values({ id: createId(), sessionId, type, payloadJson: JSON.stringify(payload), elapsedActiveMs: Math.round(elapsedActiveMs), createdAt: now() });
}

export async function addCheckpoint(sessionId: string, checkpointKey: string, label: string, elapsedActiveMs: number, reps: number | null = null) {
  await getDb()
    .insert(schema.workoutCheckpoints)
    .values({ id: createId(), sessionId, checkpointKey, label, elapsedActiveMs: Math.round(elapsedActiveMs), reps, createdAt: now() });
}

const EVENT_NAMES: Partial<Record<EngineEvent['type'], string>> = {
  StepStarted: 'ExerciseStarted',
  RestStarted: 'RestStarted',
  RestEnded: 'RestSkipped',
  TimeCapReached: 'TimeCapReached',
  WorkoutCompleted: 'WorkoutCompleted',
};

/** Persists engine output: checkpoints become telemetry, the rest goes to the event log. */
export async function recordEngineEvents(sessionId: string, events: EngineEvent[]) {
  if (events.length === 0) return;
  await withTransaction(async (tx) => {
    const ts = now();
    for (const e of events) {
      if (e.type === 'Checkpoint') {
        if (e.kind !== 'cap') {
          await tx.insert(schema.workoutCheckpoints).values({ id: createId(), sessionId, checkpointKey: e.key, label: e.label, elapsedActiveMs: Math.round(e.atMs), reps: e.reps, createdAt: ts });
        }
        await tx.insert(schema.workoutSessionEvents).values({
          id: createId(),
          sessionId,
          type: e.kind === 'round' ? 'RoundCompleted' : e.kind === 'step' ? 'ExerciseCompleted' : 'TimeCapReached',
          payloadJson: JSON.stringify({ key: e.key, label: e.label, reps: e.reps, exerciseId: e.exerciseId }),
          elapsedActiveMs: Math.round(e.atMs),
          createdAt: ts,
        });
        continue;
      }
      if (e.type === 'RestEnded' && !e.skipped) continue;
      const name = EVENT_NAMES[e.type];
      if (!name) continue;
      const { type: _type, atMs, ...payload } = e;
      await tx.insert(schema.workoutSessionEvents).values({ id: createId(), sessionId, type: name, payloadJson: JSON.stringify(payload), elapsedActiveMs: Math.round(atMs), createdAt: ts });
    }
  });
}

export async function getActiveSession() {
  const rows = await getDb()
    .select()
    .from(schema.workoutSessions)
    .where(inArray(schema.workoutSessions.status, ['active', 'paused', 'countdown']))
    .orderBy(desc(schema.workoutSessions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSession(id: string) {
  const rows = await getDb().select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCheckpoints(sessionId: string): Promise<OpponentCheckpoint[]> {
  const rows = await getDb()
    .select()
    .from(schema.workoutCheckpoints)
    .where(eq(schema.workoutCheckpoints.sessionId, sessionId))
    .orderBy(schema.workoutCheckpoints.elapsedActiveMs);
  return rows.map((c) => ({ checkpointKey: c.checkpointKey, label: c.label, elapsedActiveMs: c.elapsedActiveMs, reps: c.reps }));
}

export async function getResultBySession(sessionId: string) {
  const rows = await getDb().select().from(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export function toScore(r: Pick<schema.ResultRow, 'completionMs' | 'scoreType' | 'scoreReps' | 'isComplete' | 'isAbandoned' | 'timeCapped'>): ScoreLike {
  return {
    completionMs: r.completionMs,
    scoreType: (r.scoreType as ScoreType) ?? 'time',
    scoreReps: r.scoreReps,
    isComplete: r.isComplete,
    isAbandoned: r.isAbandoned,
    timeCapped: r.timeCapped,
  };
}

/** Recalculates the PB for one compatibility key from the full result history. */
async function recomputePb(tx: Db, key: CompatKey) {
  const results = await tx
    .select()
    .from(schema.workoutResults)
    .where(
      and(
        eq(schema.workoutResults.workoutId, key.workoutId),
        eq(schema.workoutResults.workoutVersionId, key.workoutVersionId),
        eq(schema.workoutResults.workoutVariantId, key.workoutVariantId),
        eq(schema.workoutResults.scalingCategory, key.scalingCategory),
      ),
    );
  let best: schema.ResultRow | null = null;
  // Oldest first, so a tie keeps the attempt that set the mark first.
  for (const r of [...results].sort((a, b) => a.createdAt - b.createdAt)) {
    if (isBetterScore(toScore(r), best ? toScore(best) : null)) best = r;
  }
  const existing = await tx
    .select()
    .from(schema.personalBests)
    .where(
      and(
        eq(schema.personalBests.workoutId, key.workoutId),
        eq(schema.personalBests.workoutVersionId, key.workoutVersionId),
        eq(schema.personalBests.workoutVariantId, key.workoutVariantId),
        eq(schema.personalBests.scalingCategory, key.scalingCategory),
      ),
    );
  if (existing.length === 1 && best && existing[0].resultId === best.id) return;
  for (const e of existing) await tx.delete(schema.personalBests).where(eq(schema.personalBests.id, e.id));
  if (!best) return;
  await tx.insert(schema.personalBests).values({
    id: createId(),
    workoutId: key.workoutId,
    workoutVersionId: key.workoutVersionId,
    workoutVariantId: key.workoutVariantId,
    scalingCategory: key.scalingCategory,
    resultId: best.id,
    sessionId: best.sessionId,
    completionMs: best.completionMs,
    scoreType: best.scoreType,
    scoreReps: best.scoreReps,
    achievedAt: best.createdAt,
  });
}

export interface FinishOutcome {
  resultId: string;
  isNewPb: boolean;
  previousPb: ScoreLike | null;
}

/**
 * Writes the result of a session and updates its PB. `state` is the final
 * engine state; `elapsedMs` the active time when it ended.
 */
export async function finishSession(sessionId: string, state: ActiveWorkoutState, elapsedMs: number, options: { abandoned?: boolean } = {}): Promise<FinishOutcome> {
  return withTransaction(async (tx) => {
    const session = (await tx.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId)).limit(1))[0];
    if (!session) throw new Error('Session not found');
    const existing = (await tx.select().from(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId)).limit(1))[0];
    if (existing) return { resultId: existing.id, isNewPb: false, previousPb: null };

    const abandoned = !!options.abandoned;
    const scoreType: ScoreType = state.scoring ?? 'time';
    const timeCapped = scoreType === 'time' && state.endedBy === 'time_cap';
    const isComplete = !abandoned && state.phase === 'completed' && !timeCapped;
    const scaling = state.scalingCategory ?? (session.scalingCategory as ScalingCategory);
    const key: CompatKey = { workoutId: session.workoutId, workoutVersionId: session.workoutVersionId, workoutVariantId: session.workoutVariantId, scalingCategory: scaling };

    const pbBefore = (
      await tx
        .select()
        .from(schema.personalBests)
        .where(
          and(
            eq(schema.personalBests.workoutId, key.workoutId),
            eq(schema.personalBests.workoutVersionId, key.workoutVersionId),
            eq(schema.personalBests.workoutVariantId, key.workoutVariantId),
            eq(schema.personalBests.scalingCategory, key.scalingCategory),
          ),
        )
        .limit(1)
    )[0];

    const resultId = createId();
    const ts = now();
    const completionMs = Math.max(0, Math.round(elapsedMs));
    await tx.insert(schema.workoutResults).values({
      id: resultId,
      sessionId,
      workoutId: session.workoutId,
      workoutVersionId: session.workoutVersionId,
      workoutVariantId: session.workoutVariantId,
      scalingCategory: scaling,
      completionMs,
      isComplete,
      isAbandoned: abandoned,
      scoreType,
      scoreReps: scoreType === 'reps' ? state.totalReps ?? 0 : null,
      roundsCompleted: state.roundsCompleted ?? null,
      totalReps: state.totalReps ?? null,
      timeCapped,
      createdAt: ts,
    });
    await tx
      .update(schema.workoutSessions)
      .set({ status: abandoned ? 'abandoned' : 'completed', completedAt: ts, elapsedActiveMs: completionMs, scalingCategory: scaling, currentStateJson: JSON.stringify(state), updatedAt: ts })
      .where(eq(schema.workoutSessions.id, sessionId));
    await tx.insert(schema.workoutSessionEvents).values({
      id: createId(),
      sessionId,
      type: abandoned ? 'WorkoutAbandoned' : 'WorkoutCompleted',
      payloadJson: JSON.stringify({ scoreType, reps: state.totalReps ?? 0 }),
      elapsedActiveMs: completionMs,
      createdAt: ts,
    });

    await recomputePb(tx, key);
    const pbAfter = (
      await tx
        .select()
        .from(schema.personalBests)
        .where(
          and(
            eq(schema.personalBests.workoutId, key.workoutId),
            eq(schema.personalBests.workoutVersionId, key.workoutVersionId),
            eq(schema.personalBests.workoutVariantId, key.workoutVariantId),
            eq(schema.personalBests.scalingCategory, key.scalingCategory),
          ),
        )
        .limit(1)
    )[0];
    const previousPb: ScoreLike | null = pbBefore
      ? { completionMs: pbBefore.completionMs, scoreType: pbBefore.scoreType as ScoreType, scoreReps: pbBefore.scoreReps, isComplete: true, isAbandoned: false }
      : null;
    return { resultId, isNewPb: pbAfter?.resultId === resultId, previousPb };
  });
}

/** Ends a session that was never finished (from the pause menu or recovery). */
export async function abandonSession(sessionId: string, state: ActiveWorkoutState | null, elapsedMs: number) {
  const session = await getSession(sessionId);
  if (!session) return;
  const finalState = state ?? (JSON.parse(session.currentStateJson) as ActiveWorkoutState);
  // Nothing done yet: drop it without cluttering history.
  if (elapsedMs < 1000 && (finalState.totalReps ?? 0) === 0) {
    await getDb().update(schema.workoutSessions).set({ status: 'abandoned', updatedAt: now() }).where(eq(schema.workoutSessions.id, sessionId));
    return;
  }
  await finishSession(sessionId, finalState, elapsedMs, { abandoned: true });
}

/** @deprecated Use `finishSession`. */
export async function completeSession(sessionId: string, completionMs: number, isComplete: boolean, abandoned = false) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = JSON.parse(session.currentStateJson) as ActiveWorkoutState;
  const final: ActiveWorkoutState = isComplete ? { ...state, phase: 'completed', endedBy: state.endedBy ?? 'finished' } : state;
  return (await finishSession(sessionId, final, completionMs, { abandoned })).resultId;
}

/** Deletes a session and everything recorded for it, then repairs the PB. */
export async function deleteSession(sessionId: string) {
  await withTransaction(async (tx) => {
    const session = (await tx.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId)).limit(1))[0];
    if (!session) return;
    const result = (await tx.select().from(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId)).limit(1))[0];
    await tx.delete(schema.personalBests).where(eq(schema.personalBests.sessionId, sessionId));
    await tx.delete(schema.postWorkoutFeedback).where(eq(schema.postWorkoutFeedback.sessionId, sessionId));
    await tx.delete(schema.workoutCheckpoints).where(eq(schema.workoutCheckpoints.sessionId, sessionId));
    await tx.delete(schema.workoutSessionEvents).where(eq(schema.workoutSessionEvents.sessionId, sessionId));
    await tx.delete(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId));
    // Later rematches keep working: they simply lose this opponent.
    await tx.update(schema.workoutSessions).set({ opponentSessionId: null }).where(eq(schema.workoutSessions.opponentSessionId, sessionId));
    await tx.delete(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId));
    if (result) {
      await recomputePb(tx, {
        workoutId: result.workoutId,
        workoutVersionId: result.workoutVersionId,
        workoutVariantId: result.workoutVariantId,
        scalingCategory: result.scalingCategory,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getPb(workoutId: string, versionId: string, variantId: string, scaling: ScalingCategory | string) {
  const rows = await getDb()
    .select()
    .from(schema.personalBests)
    .where(
      and(
        eq(schema.personalBests.workoutId, workoutId),
        eq(schema.personalBests.workoutVersionId, versionId),
        eq(schema.personalBests.workoutVariantId, variantId),
        eq(schema.personalBests.scalingCategory, scaling),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Finished (non-abandoned) results for one compatibility key, newest first. */
export async function listResults(workoutId: string, variantId: string, scaling: ScalingCategory | string, versionId?: string) {
  const rows = await getDb()
    .select()
    .from(schema.workoutResults)
    .where(
      and(
        eq(schema.workoutResults.workoutId, workoutId),
        eq(schema.workoutResults.workoutVariantId, variantId),
        eq(schema.workoutResults.scalingCategory, scaling),
        eq(schema.workoutResults.isAbandoned, false),
        ...(versionId ? [eq(schema.workoutResults.workoutVersionId, versionId)] : []),
      ),
    )
    .orderBy(desc(schema.workoutResults.createdAt));
  return rows.filter((r) => r.isComplete || r.timeCapped);
}

export async function getLastResult(workoutId: string, variantId: string, scaling: ScalingCategory | string, versionId?: string) {
  return (await listResults(workoutId, variantId, scaling, versionId))[0] ?? null;
}

/** Past attempts that can race you: finished results with checkpoint telemetry. */
export async function listOpponents(key: CompatKey) {
  const results = await listResults(key.workoutId, key.workoutVariantId, key.scalingCategory, key.workoutVersionId);
  const pb = await getPb(key.workoutId, key.workoutVersionId, key.workoutVariantId, key.scalingCategory);
  const ordered = [...results].sort((a, b) => a.createdAt - b.createdAt);
  return results.map((r) => ({
    ...r,
    attemptNumber: ordered.findIndex((o) => o.id === r.id) + 1,
    isPb: pb?.resultId === r.id,
  }));
}

export async function buildRematchComparison(sessionId: string, opponentSessionId: string): Promise<RematchComparison | null> {
  const [yourResult, oppResult] = await Promise.all([getResultBySession(sessionId), getResultBySession(opponentSessionId)]);
  if (!yourResult || !oppResult) return null;
  const [yourCheckpoints, oppCheckpoints] = await Promise.all([getCheckpoints(sessionId), getCheckpoints(opponentSessionId)]);
  const scoreType = (yourResult.scoreType as ScoreType) ?? 'time';
  const comparison = compareCheckpoints(yourCheckpoints, oppCheckpoints, yourResult.completionMs, oppResult.completionMs, {
    scoreType,
    yourReps: yourResult.scoreReps ?? yourResult.totalReps,
    opponentReps: oppResult.scoreReps ?? oppResult.totalReps,
  });
  const pb = await getPb(yourResult.workoutId, yourResult.workoutVersionId, yourResult.workoutVariantId, yourResult.scalingCategory);
  comparison.isNewPb = pb?.sessionId === sessionId;
  return comparison;
}

export interface ResultSummary {
  result: schema.ResultRow;
  session: schema.SessionRow;
  workout: schema.WorkoutRow | null;
  isPb: boolean;
  pb: schema.PersonalBestRow | null;
  /** The best result before this one (same key), if any. */
  previousBest: schema.ResultRow | null;
  attempts: number;
  comparison: RematchComparison | null;
  checkpoints: OpponentCheckpoint[];
  feedback: schema.PostWorkoutFeedbackRow | null;
}

export async function getResultSummary(sessionId: string): Promise<ResultSummary | null> {
  const result = await getResultBySession(sessionId);
  const session = await getSession(sessionId);
  if (!result || !session) return null;
  const db = getDb();
  const workout = (await db.select().from(schema.workouts).where(eq(schema.workouts.id, result.workoutId)).limit(1))[0] ?? null;
  const pb = await getPb(result.workoutId, result.workoutVersionId, result.workoutVariantId, result.scalingCategory);
  const history = await listResults(result.workoutId, result.workoutVariantId, result.scalingCategory, result.workoutVersionId);
  const earlier = history.filter((r) => r.createdAt < result.createdAt && isPbEligible(toScore(r)));
  const previousBest = earlier.reduce<schema.ResultRow | null>((best, r) => (!best || compareScores(toScore(r), toScore(best)) > 0 ? r : best), null);
  const comparison = session.opponentSessionId ? await buildRematchComparison(sessionId, session.opponentSessionId) : null;
  const feedback = (await db.select().from(schema.postWorkoutFeedback).where(eq(schema.postWorkoutFeedback.sessionId, sessionId)).limit(1))[0] ?? null;
  return {
    result,
    session,
    workout,
    isPb: pb?.resultId === result.id,
    pb,
    previousBest,
    attempts: history.length,
    comparison,
    checkpoints: await getCheckpoints(sessionId),
    feedback,
  };
}

export async function saveFeedback(sessionId: string, intensity?: string, technique?: string, painReported = false, note?: string) {
  const values = { intensity: intensity ?? null, technique: technique ?? null, painReported, note: note ?? null };
  await getDb()
    .insert(schema.postWorkoutFeedback)
    .values({ id: createId(), sessionId, createdAt: now(), ...values })
    .onConflictDoUpdate({ target: schema.postWorkoutFeedback.sessionId, set: values });
}

export interface HistoryItem {
  result: schema.ResultRow;
  workout: schema.WorkoutRow | null;
  isPb: boolean;
}

/** Every recorded result, newest first. */
export async function listHistory(limit = 200): Promise<HistoryItem[]> {
  const db = getDb();
  const results = await db.select().from(schema.workoutResults).orderBy(desc(schema.workoutResults.createdAt)).limit(limit);
  if (results.length === 0) return [];
  const workouts = await db.select().from(schema.workouts).where(inArray(schema.workouts.id, [...new Set(results.map((r) => r.workoutId))]));
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const pbs = await db.select({ resultId: schema.personalBests.resultId }).from(schema.personalBests);
  const pbIds = new Set(pbs.map((p) => p.resultId));
  return results.map((result) => ({ result, workout: byId.get(result.workoutId) ?? null, isPb: pbIds.has(result.id) }));
}

/** PB + latest result per workout for the current version's full variant (any scaling). */
export async function getWorkoutStatsMap(): Promise<Record<string, { pb?: schema.PersonalBestRow; last?: schema.ResultRow; attempts: number }>> {
  const db = getDb();
  const current = await db.select().from(schema.workoutVersions).where(eq(schema.workoutVersions.isCurrent, true));
  const currentIds = new Set(current.map((v) => v.id));
  const pbs = await db.select().from(schema.personalBests);
  const results = await db.select().from(schema.workoutResults).where(eq(schema.workoutResults.isAbandoned, false)).orderBy(desc(schema.workoutResults.createdAt));
  const out: Record<string, { pb?: schema.PersonalBestRow; last?: schema.ResultRow; attempts: number }> = {};
  for (const r of results) {
    if (!currentIds.has(r.workoutVersionId)) continue;
    const entry = (out[r.workoutId] ??= { attempts: 0 });
    entry.attempts += 1;
    if (!entry.last) entry.last = r;
  }
  for (const pb of pbs) {
    if (!currentIds.has(pb.workoutVersionId) || !pb.workoutVariantId.endsWith('-full') || pb.scalingCategory !== 'rx') continue;
    (out[pb.workoutId] ??= { attempts: 0 }).pb = pb;
  }
  return out;
}

export async function getRecentWorkoutIds(limit = 5): Promise<string[]> {
  const rows = await getDb().select({ workoutId: schema.workoutResults.workoutId }).from(schema.workoutResults).orderBy(desc(schema.workoutResults.createdAt)).limit(limit * 3);
  return [...new Set(rows.map((r) => r.workoutId))].slice(0, limit);
}

export async function hadPainRecently(days = 3): Promise<boolean> {
  const since = now() - days * 24 * 60 * 60 * 1000;
  const rows = await getDb().select().from(schema.postWorkoutFeedback).where(eq(schema.postWorkoutFeedback.painReported, true));
  return rows.some((r) => r.createdAt >= since);
}
