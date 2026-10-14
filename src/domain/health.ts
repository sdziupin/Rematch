/**
 * Turning a finished session into an Apple Health workout. Pure, so it runs in
 * tests; the HealthKit call itself lives in services/healthService.
 */

export type HealthActivity = 'hiit' | 'functionalStrength' | 'coreTraining' | 'flexibility' | 'mixedCardio' | 'crossTraining';

export interface HealthWorkoutDraft {
  start: number;
  end: number;
  activity: HealthActivity;
  energyKcal: number | null;
  pauses: number[][];
  externalId: string;
  title: string;
}

/** Shorter abandoned attempts aren't training worth logging (same rule as the stats). */
export const MIN_ABANDONED_MS = 60_000;

/** Wall-clock slack before a session's own start time is no longer trusted. */
const START_TOLERANCE_MS = 2 * 60_000;

/** Rough metabolic equivalents per activity, used only when body mass is known. */
const METS: Record<HealthActivity, number> = {
  hiit: 8,
  functionalStrength: 6,
  coreTraining: 4,
  flexibility: 2.5,
  mixedCardio: 7,
  crossTraining: 7,
};

export function healthActivityFor(workout: { focus: string; kind?: string | null } | null): HealthActivity {
  if (!workout) return 'hiit';
  if (workout.kind === 'warmup' || workout.kind === 'cooldown' || workout.focus === 'mobility') return 'flexibility';
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

export function buildHealthWorkout(input: {
  sessionId: string;
  startedAt: number | null;
  pausedAccumulatedMs: number;
  result: { completionMs: number; isAbandoned: boolean; createdAt: number };
  workout: { name: string; focus: string; kind?: string | null } | null;
  events: { type: string; createdAt: number }[];
  bodyMassKg?: number | null;
}): HealthWorkoutDraft | null {
  const { result } = input;
  if (result.completionMs <= 0) return null;
  if (result.isAbandoned && result.completionMs < MIN_ABANDONED_MS) return null;

  const end = result.createdAt;
  const span = result.completionMs + Math.max(0, input.pausedAccumulatedMs);
  // Prefer the real start; when it doesn't add up (a session revived after the app was
  // killed, a clock change) log just the active time, ending when the result was saved.
  const trusted = input.startedAt !== null && Math.abs(end - input.startedAt - span) <= START_TOLERANCE_MS;
  const start = trusted ? input.startedAt! : end - result.completionMs;
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
  };
}
