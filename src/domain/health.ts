/**
 * Turning a finished session into a health-store workout (Apple Health on iOS, Health
 * Connect on Android). Pure, so it runs in tests; the native calls live in
 * services/healthService.
 */

export type HealthActivity =
  | 'hiit'
  | 'functionalStrength'
  | 'traditionalStrength'
  | 'coreTraining'
  | 'flexibility'
  | 'mixedCardio'
  | 'crossTraining'
  | 'jumpRope'
  | 'warmup'
  | 'cooldown';

export interface HealthWorkoutDraft {
  start: number;
  end: number;
  activity: HealthActivity;
  energyKcal: number | null;
  pauses: number[][];
  externalId: string;
  title: string;
  notes: string | null;
}

/** Shorter abandoned attempts aren't training worth logging (same rule as the stats). */
export const MIN_ABANDONED_MS = 60_000;

/** Wall-clock slack before a session's own start time is no longer trusted. */
const START_TOLERANCE_MS = 2 * 60_000;

/** Rough metabolic equivalents per activity, used only when body mass is known. */
const METS: Record<HealthActivity, number> = {
  hiit: 8,
  functionalStrength: 6,
  traditionalStrength: 5,
  coreTraining: 4,
  flexibility: 2.5,
  mixedCardio: 7,
  crossTraining: 7,
  jumpRope: 10,
  warmup: 3.5,
  cooldown: 2.5,
};

export interface HealthWorkoutInfo {
  name?: string;
  focus: string;
  kind?: string | null;
  format?: string | null;
  /** Movements the session actually used (after scaling), when known. */
  exerciseIds?: string[];
}

/** The closest workout type the health stores know for a REMATCH workout. */
export function healthActivityFor(workout: HealthWorkoutInfo | null): HealthActivity {
  if (!workout) return 'hiit';
  if (workout.kind === 'warmup') return 'warmup';
  if (workout.kind === 'cooldown') return 'cooldown';
  if (workout.focus === 'mobility') return 'flexibility';
  const ids = workout.exerciseIds ?? [];
  if (ids.length > 0 && ids.every((id) => id === 'jump-rope')) return 'jumpRope';
  // Tabata and Death by are interval training whatever the movements are.
  if (workout.format === 'tabata' || workout.format === 'death_by') return 'hiit';
  switch (workout.focus) {
    case 'core':
      return 'coreTraining';
    case 'strength_endurance':
    case 'upper':
    case 'lower':
      return 'functionalStrength';
    case 'cardio':
    case 'low_impact':
      return 'mixedCardio';
    case 'mixed':
      return 'crossTraining';
    default:
      return 'hiit';
  }
}

/**
 * Active energy (above resting) for `activeMs` of work: (MET − 1) × kg × hours.
 * Null without a plausible body mass; a guess from a default weight would be noise in Health.
 */
export function estimateActiveKcal(activity: HealthActivity, activeMs: number, bodyMassKg: number | null | undefined): number | null {
  if (!bodyMassKg || bodyMassKg < 25 || bodyMassKg > 350 || activeMs <= 0) return null;
  const kcal = (METS[activity] - 1) * bodyMassKg * (activeMs / 3_600_000);
  return Math.round(kcal);
}

/** Pause/resume pairs (epoch ms) from the session's event log, clipped to [start, end]. */
export function pauseIntervals(events: { type: string; createdAt: number }[], start: number, end: number): number[][] {
  const out: number[][] = [];
  let open: number | null = null;
  for (const e of [...events].sort((a, b) => a.createdAt - b.createdAt)) {
    if (e.type === 'WorkoutPaused' && open === null) {
      open = Math.max(start, e.createdAt);
    } else if (e.type === 'WorkoutResumed' && open !== null) {
      const resumed = Math.min(end, e.createdAt);
      if (resumed > open && open < end) out.push([open, resumed]);
      open = null;
    }
  }
  if (open !== null && open < end) out.push([open]);
  return out;
}

/** The wall-clock span of a session: its real start when that adds up, else the active time before the result. */
export function sessionWindow(input: { startedAt: number | null; pausedAccumulatedMs: number; completionMs: number; endedAt: number }): { start: number; end: number; trusted: boolean } {
  const end = input.endedAt;
  const span = input.completionMs + Math.max(0, input.pausedAccumulatedMs);
  // Prefer the real start; when it doesn't add up (a session revived after the app was
  // killed, a clock change) use just the active time, ending when the result was saved.
  const trusted = input.startedAt !== null && Math.abs(end - input.startedAt - span) <= START_TOLERANCE_MS;
  return { start: trusted ? input.startedAt! : end - input.completionMs, end, trusted };
}

/** A one-line summary for the workout's notes (Health Connect shows them; HealthKit has none). */
export function workoutNotes(input: { scoreLabel?: string | null; scaling?: string | null; versus?: string | null }): string | null {
  const parts = [input.scoreLabel, input.scaling, input.versus].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length ? `REMATCH · ${parts.join(' · ')}` : null;
}

export function buildHealthWorkout(input: {
  sessionId: string;
  startedAt: number | null;
  pausedAccumulatedMs: number;
  result: { completionMs: number; isAbandoned: boolean; createdAt: number };
  workout: HealthWorkoutInfo | null;
  events: { type: string; createdAt: number }[];
  bodyMassKg?: number | null;
  notes?: string | null;
}): HealthWorkoutDraft | null {
  const { result } = input;
  if (result.completionMs <= 0) return null;
  if (result.isAbandoned && result.completionMs < MIN_ABANDONED_MS) return null;

  const { start, end, trusted } = sessionWindow({
    startedAt: input.startedAt,
    pausedAccumulatedMs: input.pausedAccumulatedMs,
    completionMs: result.completionMs,
    endedAt: result.createdAt,
  });
  if (end <= start) return null;

  const activity = healthActivityFor(input.workout);
  return {
    start,
    end,
    activity,
    energyKcal: estimateActiveKcal(activity, result.completionMs, input.bodyMassKg),
    pauses: trusted ? pauseIntervals(input.events, start, end) : [],
    externalId: input.sessionId,
    title: input.workout?.name ?? 'REMATCH',
    notes: input.notes ?? null,
  };
}

/**
 * Which finished sessions a catch-up sync should write: newest first, within `days`,
 * not already saved, and long enough to count. Pure so the rules are testable.
 */
export function selectBackfill<T extends { sessionId: string; createdAt: number; completionMs: number; isAbandoned: boolean }>(
  results: T[],
  saved: Set<string>,
  options: { now: number; days: number; limit: number },
): T[] {
  const since = options.now - options.days * 86_400_000;
  return results
    .filter((r) => r.createdAt >= since && r.createdAt <= options.now + START_TOLERANCE_MS)
    .filter((r) => !saved.has(r.sessionId))
    .filter((r) => r.completionMs > 0 && (!r.isAbandoned || r.completionMs >= MIN_ABANDONED_MS))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, options.limit);
}
