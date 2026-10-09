import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { parseJsonArray } from '../db/repository';
import { dayStreak, heatmap, muscleLoad, weeklyCounts, weeklyGoalStreak, type HeatmapCell, type MuscleInfo, type MuscleWork, type WeekBucket } from '../domain/stats';
import type { ActiveWorkoutState, ScoreType } from '../domain/types';

const DAY = 24 * 60 * 60 * 1000;

export interface TrainingStats {
  totalSessions: number;
  totalActiveMs: number;
  totalReps: number;
  thisWeek: number;
  weeklyGoal: number;
  weekStreak: number;
  dayStreak: number;
  weekly: WeekBucket[];
  heatmap: HeatmapCell[][];
  pbCount: number;
  muscleLoad: Record<string, number>;
}

/** Work actually performed in a session, read from its final engine state. */
export function workFromState(state: ActiveWorkoutState): MuscleWork[] {
  const out: MuscleWork[] = [];
  const passes = (state.loop ?? 0) as number;
  for (const round of state.rounds ?? []) {
    for (const ex of round.exercises ?? []) {
      const id = ex.scaledExerciseId ?? ex.exerciseId;
      if (ex.done || ex.completedReps > 0) {
        out.push({ exerciseId: id, reps: ex.completedReps ?? 0, seconds: ex.done && ex.durationSec ? ex.durationSec : 0 });
      }
      // Completed AMRAP passes were reset in the state; credit their prescribed reps.
      if (passes > 0) out.push({ exerciseId: id, reps: (ex.targetReps ?? 0) * passes, seconds: (ex.durationSec ?? 0) * passes });
    }
  }
  return out;
}

export async function getTrainingStats(options: { weeklyGoal: number; weekStartsOn: number; muscleDays?: number }): Promise<TrainingStats> {
  const db = getDb();
  const results = await db.select().from(schema.workoutResults).orderBy(asc(schema.workoutResults.createdAt));
  const counted = results.filter((r) => !r.isAbandoned || r.completionMs > 60_000);
  const timestamps = counted.map((r) => r.createdAt);
  const now = Date.now();
  const weekly = weeklyCounts(timestamps, 12, now, options.weekStartsOn);

  const since = now - (options.muscleDays ?? 30) * DAY;
  const recentSessions = await db
    .select({ state: schema.workoutSessions.currentStateJson })
    .from(schema.workoutSessions)
    .where(and(gte(schema.workoutSessions.updatedAt, since)));
  const work: MuscleWork[] = [];
  for (const s of recentSessions) {
    try {
      work.push(...workFromState(JSON.parse(s.state) as ActiveWorkoutState));
    } catch {
      // ignore unreadable states
    }
  }
  const exercises = await db.select().from(schema.exercises);
  const muscles = new Map<string, MuscleInfo>(
    exercises.map((e) => [e.id, { primary: parseJsonArray(e.primaryMusclesJson), secondary: parseJsonArray(e.secondaryMusclesJson) }]),
  );
  const pbs = await db.select({ id: schema.personalBests.id }).from(schema.personalBests);

  return {
    totalSessions: counted.length,
    totalActiveMs: counted.reduce((sum, r) => sum + r.completionMs, 0),
    totalReps: counted.reduce((sum, r) => sum + (r.totalReps ?? 0), 0),
    thisWeek: weekly[weekly.length - 1]?.count ?? 0,
    weeklyGoal: options.weeklyGoal,
    weekStreak: weeklyGoalStreak(timestamps, options.weeklyGoal, now, options.weekStartsOn),
    dayStreak: dayStreak(timestamps, now),
    weekly,
    heatmap: heatmap(timestamps, 18, now, options.weekStartsOn),
    pbCount: pbs.length,
    muscleLoad: muscleLoad(work, muscles),
  };
}

export interface TrendPoint {
  at: number;
  value: number;
  scoreType: ScoreType;
  scaling: string;
  variantId: string;
}

/** Score history for one workout (current version), oldest first. */
export async function getWorkoutTrend(workoutId: string, versionId: string): Promise<TrendPoint[]> {
  const rows = await getDb()
    .select()
    .from(schema.workoutResults)
    .where(and(eq(schema.workoutResults.workoutId, workoutId), eq(schema.workoutResults.workoutVersionId, versionId), eq(schema.workoutResults.isAbandoned, false)))
    .orderBy(asc(schema.workoutResults.createdAt));
  return rows
    .filter((r) => r.isComplete)
    .map((r) => ({
      at: r.createdAt,
      value: r.scoreType === 'reps' ? r.scoreReps ?? 0 : r.completionMs,
      scoreType: (r.scoreType as ScoreType) ?? 'time',
      scaling: r.scalingCategory,
      variantId: r.workoutVariantId,
    }));
}

export interface BenchmarkProgress {
  workout: schema.WorkoutRow;
  attempts: number;
  first: schema.ResultRow;
  latest: schema.ResultRow;
  best: schema.PersonalBestRow | null;
  scoreType: ScoreType;
}

/** First vs latest vs best for every benchmark attempted (full RX variant of the current version first). */
export async function getBenchmarkProgress(): Promise<BenchmarkProgress[]> {
  const db = getDb();
  const results = await db.select().from(schema.workoutResults).where(eq(schema.workoutResults.isComplete, true)).orderBy(asc(schema.workoutResults.createdAt));
  const workouts = new Map((await db.select().from(schema.workouts)).map((w) => [w.id, w]));
  const pbs = await db.select().from(schema.personalBests);
  const groups = new Map<string, schema.ResultRow[]>();
  for (const r of results) {
    const key = `${r.workoutId}|${r.workoutVersionId}|${r.workoutVariantId}|${r.scalingCategory}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const out: BenchmarkProgress[] = [];
  for (const [key, list] of groups) {
    const [workoutId, versionId, variantId, scaling] = key.split('|');
    const workout = workouts.get(workoutId);
    if (!workout) continue;
    out.push({
      workout,
      attempts: list.length,
      first: list[0],
      latest: list[list.length - 1],
      best: pbs.find((p) => p.workoutId === workoutId && p.workoutVersionId === versionId && p.workoutVariantId === variantId && p.scalingCategory === scaling) ?? null,
      scoreType: (list[0].scoreType as ScoreType) ?? 'time',
    });
  }
  // Most-attempted first, then most recent.
  return out.sort((a, b) => b.attempts - a.attempts || b.latest.createdAt - a.latest.createdAt);
}

export async function getRecentPbs(limit = 5) {
  const db = getDb();
  const pbs = await db.select().from(schema.personalBests).orderBy(desc(schema.personalBests.achievedAt)).limit(limit);
  const workouts = new Map((await db.select().from(schema.workouts)).map((w) => [w.id, w]));
  return pbs.map((pb) => ({ pb, workout: workouts.get(pb.workoutId) ?? null }));
}
