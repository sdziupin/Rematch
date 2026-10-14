import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { planReminders, weekWidgetTimeline, type GlanceInput } from '../domain/glance';
import { formatScore } from '../domain/utils';
import { useSettings } from '../store/settingsStore';
import { readable } from '../theme';
import { updateWeekWidget } from '../widgets';
import { scheduleReminders } from './notificationService';

/** Counted results (as in the stats) and the latest finished race. */
export async function loadGlanceInput(): Promise<GlanceInput> {
  const db = getDb();
  const results = await db.select().from(schema.workoutResults).orderBy(desc(schema.workoutResults.createdAt));
  const counted = results.filter((r) => !r.isAbandoned || r.completionMs > 60_000);
  const lastResult = results.find((r) => !r.isAbandoned && (r.isComplete || r.timeCapped)) ?? null;
  let last: GlanceInput['last'] = null;
  if (lastResult) {
    const workout = (await db.select().from(schema.workouts).where(eq(schema.workouts.id, lastResult.workoutId)).limit(1))[0];
    const pb = (await db.select({ id: schema.personalBests.id }).from(schema.personalBests).where(eq(schema.personalBests.resultId, lastResult.id)).limit(1))[0];
    last = {
      name: workout?.name ?? 'Workout',
      score: formatScore(lastResult),
      isPb: !!pb,
      at: lastResult.createdAt,
      color: readable(workout?.identityColor ?? '#D6F45B'),
    };
  }
  const { weeklyGoal, weekStartsOn } = useSettings.getState();
  return { timestamps: counted.map((r) => r.createdAt), weeklyGoal, weekStartsOn, last };
}

let pending: Promise<void> | null = null;
let again = false;

/**
 * Brings the widget and the training reminders up to date. Cheap enough to call after
 * anything that changes results or settings; overlapping calls collapse into one rerun.
 */
export function refreshGlances(): Promise<void> {
  if (pending) {
    again = true;
    return pending;
  }
  pending = (async () => {
    do {
      again = false;
      try {
        const input = await loadGlanceInput();
        updateWeekWidget(weekWidgetTimeline(input));
        const { reminders, reminderHour } = useSettings.getState();
        await scheduleReminders(reminders ? planReminders({ ...input, hour: reminderHour }) : []);
      } catch (error) {
        console.warn('[rematch] glance refresh failed', error);
      }
    } while (again);
  })().finally(() => {
    pending = null;
  });
  return pending;
}
