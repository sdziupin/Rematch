/** Pure training statistics. Timestamps are ms since epoch, in local time. */

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `weekStartsOn`: 0 = Sunday, 1 = Monday. */
export function startOfWeek(ts: number, weekStartsOn = 1): number {
  const d = new Date(startOfDay(ts));
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export interface WeekBucket {
  weekStart: number;
  count: number;
}

/** Sessions per week for the last `weeks` weeks, oldest first, current week last. */
export function weeklyCounts(timestamps: number[], weeks = 8, now = Date.now(), weekStartsOn = 1): WeekBucket[] {
  const current = startOfWeek(now, weekStartsOn);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) buckets.push({ weekStart: addDays(current, -7 * i), count: 0 });
  for (const ts of timestamps) {
    const ws = startOfWeek(ts, weekStartsOn);
    const b = buckets.find((x) => x.weekStart === ws);
    if (b) b.count += 1;
  }
  return buckets;
}

/**
 * Consecutive weeks that met the weekly goal. The current week only counts once
 * the goal is met; until then it doesn't break the streak.
 */
export function weeklyGoalStreak(timestamps: number[], goalPerWeek: number, now = Date.now(), weekStartsOn = 1): number {
  if (goalPerWeek <= 0) return 0;
  const counts = new Map<number, number>();
  for (const ts of timestamps) {
    const ws = startOfWeek(ts, weekStartsOn);
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  let week = startOfWeek(now, weekStartsOn);
  let streak = 0;
  if ((counts.get(week) ?? 0) >= goalPerWeek) streak += 1;
  week = addDays(week, -7);
  for (let guard = 0; guard < 520; guard++) {
    if ((counts.get(week) ?? 0) < goalPerWeek) break;
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

/** Consecutive training days ending today (or yesterday, if today is still open). */
export function dayStreak(timestamps: number[], now = Date.now()): number {
  const days = new Set(timestamps.map(startOfDay));
  let day = startOfDay(now);
  if (!days.has(day)) day = addDays(day, -1);
  let streak = 0;
  for (let guard = 0; guard < 3650 && days.has(day); guard++) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export interface HeatmapCell {
  day: number;
  count: number;
  future: boolean;
}

/** Calendar heatmap: `weeks` columns of 7 days, oldest first. */
export function heatmap(timestamps: number[], weeks = 18, now = Date.now(), weekStartsOn = 1): HeatmapCell[][] {
  const counts = new Map<number, number>();
  for (const ts of timestamps) {
    const d = startOfDay(ts);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const today = startOfDay(now);
  const first = addDays(startOfWeek(now, weekStartsOn), -7 * (weeks - 1));
  const columns: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d);
      col.push({ day, count: counts.get(day) ?? 0, future: day > today });
    }
    columns.push(col);
  }
  return columns;
}

export interface MuscleWork {
  exerciseId: string;
  reps: number;
  seconds: number;
}

export interface MuscleInfo {
  primary: string[];
  secondary: string[];
}

/**
 * Training load per muscle: reps (timed work counts one rep per 3 s), full
 * credit to primary muscles and half to secondary. Normalised to 0–1.
 */
export function muscleLoad(work: MuscleWork[], muscles: Map<string, MuscleInfo>): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const w of work) {
    const info = muscles.get(w.exerciseId);
    if (!info) continue;
    const units = w.reps + w.seconds / 3;
    if (units <= 0) continue;
    for (const m of info.primary) raw[m] = (raw[m] ?? 0) + units;
    for (const m of info.secondary) raw[m] = (raw[m] ?? 0) + units * 0.5;
  }
  const max = Math.max(0, ...Object.values(raw));
  if (max === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = v / max;
  return out;
}

/** Linear-regression slope of y over the index; negative = getting faster for time scores. */
export function trendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

export { DAY };
