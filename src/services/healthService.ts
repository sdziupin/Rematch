import { asc, eq, like } from 'drizzle-orm';
import { Linking, Platform } from 'react-native';
import { RematchHealth, type HealthAuthorization, type HealthAvailability, type HeartRateSummary } from '../../modules/rematch-health';
import { getDb } from '../db/client';
import { getMetaValue, setMetaValue } from '../db/repository';
import * as schema from '../db/schema';
import { buildHealthWorkout, selectBackfill, sessionWindow, workoutNotes } from '../domain/health';
import { SCALING_LABELS } from '../domain/scaling';
import type { ActiveWorkoutState, ScalingCategory } from '../domain/types';
import { formatScore } from '../domain/utils';
import { useSettings } from '../store/settingsStore';
import { saveDeviceSettings } from './deviceSettings';

export type { HeartRateSummary } from '../../modules/rematch-health';

/** The health store this platform writes to, by the name people know it. */
export const HEALTH_PROVIDER: string | null = Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : null;

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

export function getHealthAvailability(): HealthAvailability {
  if (!RematchHealth) return 'unsupported';
  try {
    return RematchHealth.getAvailability();
  } catch {
    try {
      return RematchHealth.isAvailable() ? 'available' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  }
}

/**
 * True where a health store exists or can be installed: an iPhone with Health, or an
 * Android phone with (or able to get) Health Connect. False on iPad, the web and in tests.
 */
export function isHealthSupported(): boolean {
  return getHealthAvailability() !== 'unsupported';
}

export async function getHealthAuthorization(): Promise<HealthAuthorization> {
  if (!RematchHealth || getHealthAvailability() !== 'available') return 'unavailable';
  try {
    return await RematchHealth.getAuthorizationStatus();
  } catch {
    return 'unavailable';
  }
}

/** Opens the health app (or its permissions), or the store page when Health Connect is missing. */
export async function openHealthApp(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('x-apple-health://');
      return;
    }
    if (Platform.OS === 'android') {
      if (getHealthAvailability() === 'available' && (await RematchHealth?.openSettings())) return;
      await Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`));
    }
  } catch {
    // Nothing to open: the toggle explains what to do.
  }
}

/**
 * Asks for access (iOS shows the system sheet only for types not asked about before) and
 * turns syncing on when workouts may be written. Recent sessions are caught up in the
 * background. Returns the resulting write status.
 */
export async function connectHealth(): Promise<HealthAuthorization> {
  const availability = getHealthAvailability();
  if (!RematchHealth || availability === 'unsupported') return 'unavailable';
  if (availability !== 'available') {
    // Health Connect missing or outdated: send them to the store, nothing to request yet.
    await openHealthApp();
    return 'unavailable';
  }
  const status = await RematchHealth.requestAuthorization();
  await saveDeviceSettings({ healthSync: status === 'authorized' });
  if (status === 'authorized') void syncRecentSessionsToHealth().catch((error) => console.warn('[rematch] Health catch-up failed', error));
  return status;
}

export async function disconnectHealth() {
  await saveDeviceSettings({ healthSync: false });
}

const SAVED_PREFIX = 'health.saved.';
const savedKey = (sessionId: string) => `${SAVED_PREFIX}${sessionId}`;
const heartKey = (sessionId: string) => `health.hr.${sessionId}`;
const inFlight = new Set<string>();

async function canWrite(): Promise<boolean> {
  if (!RematchHealth || !useSettings.getState().healthSync) return false;
  return (await getHealthAuthorization()) === 'authorized';
}

function exerciseIdsOf(stateJson: string | null | undefined): string[] {
  if (!stateJson) return [];
  try {
    const state = JSON.parse(stateJson) as Partial<ActiveWorkoutState>;
    return [...new Set((state.rounds ?? []).flatMap((r) => r.exercises.map((e) => e.scaledExerciseId ?? e.exerciseId)))];
  } catch {
    return [];
  }
}

async function exportOne(sessionId: string, bodyMassKg: number | null): Promise<'saved' | 'skipped'> {
  if (!RematchHealth || inFlight.has(sessionId)) return 'skipped';
  if (await getMetaValue(savedKey(sessionId))) return 'skipped';
  inFlight.add(sessionId);
  try {
    const db = getDb();
    const session = (await db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId)).limit(1))[0];
    const result = (await db.select().from(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId)).limit(1))[0];
    if (!session || !result) return 'skipped';
    const workout = (await db.select().from(schema.workouts).where(eq(schema.workouts.id, result.workoutId)).limit(1))[0] ?? null;
    const events = await db
      .select({ type: schema.workoutSessionEvents.type, createdAt: schema.workoutSessionEvents.createdAt })
      .from(schema.workoutSessionEvents)
      .where(eq(schema.workoutSessionEvents.sessionId, sessionId))
      .orderBy(asc(schema.workoutSessionEvents.createdAt));

    const draft = buildHealthWorkout({
      sessionId,
      startedAt: session.startedAt,
      pausedAccumulatedMs: session.pausedAccumulatedMs,
      result,
      workout: workout ? { name: workout.name, focus: workout.focus, kind: workout.kind, format: workout.format, exerciseIds: exerciseIdsOf(session.currentStateJson) } : null,
      events,
      bodyMassKg,
      notes: workoutNotes({
        scoreLabel: result.isAbandoned ? 'unfinished' : formatScore(result),
        scaling: SCALING_LABELS[result.scalingCategory as ScalingCategory] ?? null,
      }),
    });
    if (!draft) return 'skipped';
    const id = await RematchHealth.saveWorkout(draft);
    await setMetaValue(savedKey(sessionId), id || 'saved');
    return 'saved';
  } finally {
    inFlight.delete(sessionId);
  }
}

/**
 * Writes a finished session to the health store once. Quietly does nothing when syncing is
 * off, access was withdrawn, or the session is too short to count.
 */
export async function exportSessionToHealth(sessionId: string): Promise<'saved' | 'skipped'> {
  if (!(await canWrite())) return 'skipped';
  const bodyMassKg = await RematchHealth!.getBodyMassKg().catch(() => null);
  return exportOne(sessionId, bodyMassKg);
}

export interface HealthSyncSummary {
  saved: number;
  skipped: number;
  failed: number;
}

/**
 * Catch-up: writes recent sessions that never reached the health store (finished before
 * syncing was on, or while access was off). Safe to run repeatedly.
 */
export async function syncRecentSessionsToHealth(options: { days?: number; limit?: number } = {}): Promise<HealthSyncSummary> {
  const summary: HealthSyncSummary = { saved: 0, skipped: 0, failed: 0 };
  if (!(await canWrite())) return summary;
  const db = getDb();
  const [results, savedRows] = await Promise.all([
    db
      .select({
        sessionId: schema.workoutResults.sessionId,
        createdAt: schema.workoutResults.createdAt,
        completionMs: schema.workoutResults.completionMs,
        isAbandoned: schema.workoutResults.isAbandoned,
      })
      .from(schema.workoutResults),
    db.select({ key: schema.appMeta.key }).from(schema.appMeta).where(like(schema.appMeta.key, `${SAVED_PREFIX}%`)),
  ]);
  const saved = new Set(savedRows.map((r) => r.key.slice(SAVED_PREFIX.length)));
  const todo = selectBackfill(results, saved, { now: Date.now(), days: options.days ?? 90, limit: options.limit ?? 200 });
  const bodyMassKg = todo.length ? await RematchHealth!.getBodyMassKg().catch(() => null) : null;
  for (const r of todo) {
    try {
      const outcome = await exportOne(r.sessionId, bodyMassKg);
      summary[outcome] += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn('[rematch] Health export failed', r.sessionId, error);
    }
  }
  return summary;
}

/** Takes a deleted result back out of the health store, if REMATCH put it there. */
export async function removeSessionFromHealth(sessionId: string): Promise<boolean> {
  const id = await getMetaValue(savedKey(sessionId));
  await setMetaValue(heartKey(sessionId), null).catch(() => undefined);
  if (!id) return false;
  await setMetaValue(savedKey(sessionId), null);
  if (!RematchHealth || getHealthAvailability() !== 'available') return false;
  try {
    return await RematchHealth.deleteWorkout(id === 'saved' ? '' : id, sessionId);
  } catch (error) {
    console.warn('[rematch] Health delete failed', error);
    return false;
  }
}

/**
 * Average, peak and lowest heart rate a watch or band recorded during a session. Only
 * asked for while syncing is on (that is when read access was requested). Found values
 * are cached: the watch's data never changes afterwards.
 */
export async function getSessionHeartRate(sessionId: string): Promise<HeartRateSummary | null> {
  if (!RematchHealth || !useSettings.getState().healthSync || getHealthAvailability() !== 'available') return null;
  const cached = await getMetaValue(heartKey(sessionId));
  if (cached) {
    try {
      return JSON.parse(cached) as HeartRateSummary;
    } catch {
      // Re-read below.
    }
  }
  const db = getDb();
  const session = (await db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId)).limit(1))[0];
  const result = (await db.select().from(schema.workoutResults).where(eq(schema.workoutResults.sessionId, sessionId)).limit(1))[0];
  if (!session || !result || result.completionMs <= 0) return null;
  const { start, end } = sessionWindow({ startedAt: session.startedAt, pausedAccumulatedMs: session.pausedAccumulatedMs, completionMs: result.completionMs, endedAt: result.createdAt });
  const summary = await RematchHealth.getHeartRate(start, end).catch(() => null);
  if (summary && summary.avgBpm > 0) {
    await setMetaValue(heartKey(sessionId), JSON.stringify(summary)).catch(() => undefined);
    return summary;
  }
  return null;
}
