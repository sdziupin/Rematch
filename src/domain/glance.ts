/**
 * What REMATCH shows outside the app: the home/lock screen widget and the training
 * reminders. Pure functions over result timestamps, so a widget timeline can be
 * computed ahead (the week rolls over, "today" becomes "yesterday") without the app.
 */
import { relativeDay } from './utils';
import { dayStreak, startOfDay, startOfWeek, weeklyCounts, weeklyGoalStreak } from './stats';

export interface LastRace {
  name: string;
  score: string;
  isPb: boolean;
  at: number;
  color: string;
}

export interface GlanceInput {
  /** When each counted result was recorded. */
  timestamps: number[];
  weeklyGoal: number;
  weekStartsOn: number;
  last: LastRace | null;
}

/** Widget props. Plain values only: they cross into the widget's own JS runtime. */
export interface WeekWidgetProps {
  count: number;
  goal: number;
  weekStreak: number;
  dayStreak: number;
  trainedToday: boolean;
  lastName: string;
  lastScore: string;
  lastWhen: string;
  lastPb: boolean;
  lastColor: string;
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function weekWidgetProps(input: GlanceInput, now = Date.now()): WeekWidgetProps {
  const past = input.timestamps.filter((t) => t <= now);
  const today = startOfDay(now);
  return {
    count: weeklyCounts(past, 1, now, input.weekStartsOn)[0]?.count ?? 0,
    goal: Math.max(1, input.weeklyGoal),
    weekStreak: weeklyGoalStreak(past, input.weeklyGoal, now, input.weekStartsOn),
    dayStreak: dayStreak(past, now),
    trainedToday: past.some((t) => t >= today),
    lastName: input.last?.name ?? '',
    lastScore: input.last?.score ?? '',
    lastWhen: input.last ? relativeDay(input.last.at, now) : '',
    lastPb: input.last?.isPb ?? false,
    lastColor: input.last?.color ?? '#D6F45B',
  };
}

/** Now, then every midnight for `days` days: enough for the widget to stay right for a week untouched. */
export function weekWidgetTimeline(input: GlanceInput, now = Date.now(), days = 7): { date: Date; props: WeekWidgetProps }[] {
  const entries = [{ date: new Date(now), props: weekWidgetProps(input, now) }];
  let midnight = startOfDay(now);
  for (let i = 0; i < days; i++) {
    midnight = addDays(midnight, 1);
    entries.push({ date: new Date(midnight), props: weekWidgetProps(input, midnight) });
  }
  return entries;
}

export interface PlannedReminder {
  at: number;
  title: string;
  body: string;
}

/**
 * Upcoming training reminders at `hour` o'clock: skips today once trained, and any
 * day in a week whose goal is already met. Rescheduled whenever results change.
 */
export function planReminders(input: GlanceInput & { hour: number }, now = Date.now(), max = 3): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const goal = Math.max(1, input.weeklyGoal);
  const today = startOfDay(now);
  const trainedToday = input.timestamps.some((t) => t >= today && t <= now);
  const currentWeek = startOfWeek(now, input.weekStartsOn);
  const nudge = input.last ? `${input.last.name} is waiting for a rematch.` : 'Pick a benchmark and set the mark.';
  for (let d = 0; d < 7 && out.length < max; d++) {
    const day = new Date(addDays(today, d));
    day.setHours(input.hour, 0, 0, 0);
    const at = day.getTime();
    if (at <= now || (d === 0 && trainedToday)) continue;
    const week = startOfWeek(at, input.weekStartsOn);
    const count = input.timestamps.filter((t) => t <= now && startOfWeek(t, input.weekStartsOn) === week).length;
    if (count >= goal) continue;
    out.push(
      week !== currentWeek
        ? { at, title: 'New week, new race', body: `0 of ${goal} so far. ${nudge}` }
        : { at, title: goal - count === 1 ? 'One to go this week' : `${goal - count} to go this week`, body: `${count} of ${goal} done. ${nudge}` },
    );
  }
  return out;
}
