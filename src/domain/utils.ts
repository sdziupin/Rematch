import type { CompatibilityKey, ScoreType } from './types';

export function makeCompatibilityKey(key: CompatibilityKey): string {
  return `${key.workoutId}|${key.workoutVersionId}|${key.workoutVariantId}|${key.scalingCategory}`;
}

export function areCompatible(a: CompatibilityKey, b: CompatibilityKey): boolean {
  return (
    a.workoutId === b.workoutId &&
    a.workoutVersionId === b.workoutVersionId &&
    a.workoutVariantId === b.workoutVariantId &&
    a.scalingCategory === b.scalingCategory
  );
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Countdown display: rounds up so "0:00" only shows when time is really up. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  if (totalSec < 60) return `${totalSec}`;
  return formatDuration(totalSec * 1000);
}

export function formatDelta(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  const abs = Math.abs(ms);
  // Close races need tenths: "+0 sec" would hide who is actually ahead.
  if (abs < 10_000) return `${sign}${(Math.floor(abs / 100) / 10).toFixed(1)} sec`;
  const sec = Math.floor(abs / 1000);
  if (sec < 60) return `${sign}${sec} sec`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${sign}${min}:${rem.toString().padStart(2, '0')}`;
}

export function formatRepDelta(reps: number): string {
  const sign = reps > 0 ? '+' : reps < 0 ? '−' : '±';
  return `${sign}${Math.abs(reps)} rep${Math.abs(reps) === 1 ? '' : 's'}`;
}

export function formatReps(reps: number): string {
  return `${reps} rep${reps === 1 ? '' : 's'}`;
}

/** AMRAP style score: "5 rounds + 7 reps". */
export function formatRoundsAndReps(rounds: number, extraReps: number): string {
  const r = `${rounds} round${rounds === 1 ? '' : 's'}`;
  return extraReps > 0 ? `${r} + ${extraReps}` : r;
}

export function formatScore(result: { scoreType?: string | null; completionMs: number; scoreReps?: number | null }): string {
  if ((result.scoreType as ScoreType) === 'reps') return formatReps(result.scoreReps ?? 0);
  return formatDuration(result.completionMs);
}

export function formatMinutes(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function relativeDay(ts: number, now = Date.now()): string {
  const day = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diff = Math.floor((startOfToday.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / day);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diff > 300 ? 'numeric' : undefined });
}
