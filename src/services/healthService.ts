import { asc, eq } from 'drizzle-orm';
import { RematchHealth, type HealthAuthorization } from '../../modules/rematch-health';
import { getDb } from '../db/client';
import { getMetaValue, setMetaValue } from '../db/repository';
import * as schema from '../db/schema';
import { buildHealthWorkout } from '../domain/health';
import { useSettings } from '../store/settingsStore';
import { saveDeviceSettings } from './deviceSettings';

/** True on an iPhone with Health; false on iPad without it, Android and the web. */
export function isHealthSupported(): boolean {
  try {
    return !!RematchHealth?.isAvailable();
  } catch {
    return false;
  }
}

export function getHealthAuthorization(): HealthAuthorization {
  if (!RematchHealth) return 'unavailable';
  try {
    return RematchHealth.getAuthorizationStatus();
  } catch {
    return 'unavailable';
  }
}

/**
 * Asks for access (the system sheet only shows the first time) and turns syncing on
 * when workouts may be written. Returns the resulting write status.
 */
export async function connectHealth(): Promise<HealthAuthorization> {
  if (!RematchHealth || !isHealthSupported()) return 'unavailable';
  const status = await RematchHealth.requestAuthorization();
  await saveDeviceSettings({ healthSync: status === 'authorized' });
  return status;
}

export async function disconnectHealth() {
  await saveDeviceSettings({ healthSync: false });
}

const savedKey = (sessionId: string) => `health.saved.${sessionId}`;

/**
 * Writes a finished session to Apple Health once. Quietly does nothing when syncing is
 * off, access was withdrawn in Settings, or the session is too short to count.
 */
export async function exportSessionToHealth(sessionId: string): Promise<'saved' | 'skipped'> {
  if (!RematchHealth || !useSettings.getState().healthSync) return 'skipped';
  if (getHealthAuthorization() !== 'authorized') return 'skipped';
  if (await getMetaValue(savedKey(sessionId))) return 'skipped';

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
  const bodyMassKg = await RematchHealth.getBodyMassKg().catch(() => null);

  const draft = buildHealthWorkout({
    sessionId,
    startedAt: session.startedAt,
    pausedAccumulatedMs: session.pausedAccumulatedMs,
    result,
    workout,
    events,
    bodyMassKg,
  });
  if (!draft) return 'skipped';
  const uuid = await RematchHealth.saveWorkout(draft);
  await setMetaValue(savedKey(sessionId), uuid);
  return 'saved';
}
