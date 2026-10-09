import type { CheckpointComparison, RaceMode, RematchComparison, ScoreLike, ScoreType } from './types';

export interface OpponentCheckpoint {
  checkpointKey: string;
  label: string;
  elapsedActiveMs: number;
  /** Cumulative reps banked at this checkpoint (engine v2 telemetry). */
  reps?: number | null;
}

const STEP_KEY = /^r(\d+)-e(\d+)$/;
const ROUND_KEY = /^round-(\d+)$/;

export function isStepKey(key: string): boolean {
  return STEP_KEY.test(key);
}

export function isRoundKey(key: string): boolean {
  return ROUND_KEY.test(key);
}

/** Orders checkpoint keys by their position in the workout, not alphabetically. */
export function checkpointOrder(key: string): number {
  const step = STEP_KEY.exec(key);
  if (step) return Number(step[1]) * 1000 + Number(step[2]);
  const round = ROUND_KEY.exec(key);
  if (round) return Number(round[1]) * 1000 + 999;
  return Number.MAX_SAFE_INTEGER;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Whether a result can hold a personal best at all. */
export function isPbEligible(r: ScoreLike): boolean {
  if (!r.isComplete || r.isAbandoned || r.timeCapped) return false;
  if (r.scoreType === 'reps') return (r.scoreReps ?? 0) > 0;
  return r.completionMs > 0;
}

/** Positive when `a` beats `b`, negative when it loses, 0 for a tie. */
export function compareScores(a: ScoreLike, b: ScoreLike): number {
  if (a.scoreType === 'reps' || b.scoreType === 'reps') {
    const diff = (a.scoreReps ?? 0) - (b.scoreReps ?? 0);
    if (diff !== 0) return diff;
    return 0;
  }
  return b.completionMs - a.completionMs;
}

export function isBetterScore(a: ScoreLike, b: ScoreLike | null | undefined): boolean {
  if (!isPbEligible(a)) return false;
  if (!b || !isPbEligible(b)) return true;
  return compareScores(a, b) > 0;
}

// ---------------------------------------------------------------------------
// Final comparison
// ---------------------------------------------------------------------------

export function compareCheckpoints(
  yourCheckpoints: OpponentCheckpoint[],
  opponentCheckpoints: OpponentCheckpoint[],
  yourFinalMs: number,
  opponentFinalMs: number,
  options: { scoreType?: ScoreType; yourReps?: number | null; opponentReps?: number | null } = {},
): RematchComparison {
  const scoreType = options.scoreType ?? 'time';
  const opponentMap = new Map(opponentCheckpoints.map((c) => [c.checkpointKey, c]));
  const matched: CheckpointComparison[] = [];

  for (const yours of yourCheckpoints) {
    const opp = opponentMap.get(yours.checkpointKey);
    if (!opp) continue;
    matched.push({
      checkpointKey: yours.checkpointKey,
      label: yours.label,
      youMs: yours.elapsedActiveMs,
      opponentMs: opp.elapsedActiveMs,
      deltaMs: yours.elapsedActiveMs - opp.elapsedActiveMs,
      youReps: yours.reps ?? undefined,
      opponentReps: opp.reps ?? undefined,
    });
  }
  matched.sort((a, b) => checkpointOrder(a.checkpointKey) - checkpointOrder(b.checkpointKey));

  // Round splits read best; single-round workouts (chippers) fall back to movement splits.
  const rounds = matched.filter((c) => isRoundKey(c.checkpointKey));
  const steps = matched.filter((c) => isStepKey(c.checkpointKey));
  const checkpoints = rounds.length > 1 ? rounds : steps.length > 0 ? steps : matched;

  const deltaMs = yourFinalMs - opponentFinalMs;
  let won: boolean;
  let tied: boolean;
  if (scoreType === 'reps') {
    const diff = (options.yourReps ?? 0) - (options.opponentReps ?? 0);
    won = diff > 0;
    tied = diff === 0;
  } else {
    won = deltaMs < 0;
    tied = deltaMs === 0;
  }

  return {
    youMs: yourFinalMs,
    opponentMs: opponentFinalMs,
    deltaMs,
    won,
    tied,
    checkpoints,
    isNewPb: false,
    previousPbMs: null,
    scoreType,
    youReps: options.yourReps ?? undefined,
    opponentReps: options.opponentReps ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Live race
// ---------------------------------------------------------------------------

export type RaceStatus = 'ahead' | 'behind' | 'tied' | 'none';

export interface LiveRace {
  /** 'time': delta in ms (negative = ahead). 'reps': delta in reps (positive = ahead). */
  unit: 'time' | 'reps';
  delta: number | null;
  status: RaceStatus;
}

const NONE: LiveRace = { unit: 'time', delta: null, status: 'none' };

/**
 * Pace race: compares when each of you reached the same checkpoint.
 * Between checkpoints the delta only moves when the past attempt has already
 * reached your next checkpoint — then you are behind by at least that much.
 */
export function getPaceRace(
  elapsedMs: number,
  yourCheckpoints: OpponentCheckpoint[],
  opponentCheckpoints: OpponentCheckpoint[],
  nextKey: string | null,
): LiveRace {
  const opp = new Map(opponentCheckpoints.map((c) => [c.checkpointKey, c]));
  let base: number | null = null;
  for (let i = yourCheckpoints.length - 1; i >= 0; i--) {
    const match = opp.get(yourCheckpoints[i].checkpointKey);
    if (match) {
      base = yourCheckpoints[i].elapsedActiveMs - match.elapsedActiveMs;
      break;
    }
  }
  const next = nextKey ? opp.get(nextKey) : undefined;
  const running = next && elapsedMs > next.elapsedActiveMs ? elapsedMs - next.elapsedActiveMs : null;

  let delta: number | null = base;
  if (running !== null && (delta === null || running > delta)) delta = running;
  if (delta === null) return NONE;
  return { unit: 'time', delta, status: delta < 0 ? 'ahead' : delta > 0 ? 'behind' : 'tied' };
}

/** Volume race: who had banked more reps at the same checkpoint. */
export function getVolumeRace(yourCheckpoints: OpponentCheckpoint[], opponentCheckpoints: OpponentCheckpoint[]): LiveRace {
  const opp = new Map(opponentCheckpoints.map((c) => [c.checkpointKey, c]));
  for (let i = yourCheckpoints.length - 1; i >= 0; i--) {
    const mine = yourCheckpoints[i];
    const theirs = opp.get(mine.checkpointKey);
    if (theirs && mine.reps != null && theirs.reps != null) {
      const delta = mine.reps - theirs.reps;
      return { unit: 'reps', delta, status: delta > 0 ? 'ahead' : delta < 0 ? 'behind' : 'tied' };
    }
  }
  return { ...NONE, unit: 'reps' };
}

export function getLiveRace(
  mode: RaceMode,
  elapsedMs: number,
  yourCheckpoints: OpponentCheckpoint[],
  opponentCheckpoints: OpponentCheckpoint[],
  nextKey: string | null,
): LiveRace {
  return mode === 'volume'
    ? getVolumeRace(yourCheckpoints, opponentCheckpoints)
    : getPaceRace(elapsedMs, yourCheckpoints, opponentCheckpoints, nextKey);
}

/** @deprecated Use `getPaceRace`. Kept for older callers. */
export function getLiveDelta(
  yourElapsedMs: number,
  opponentCheckpoints: OpponentCheckpoint[],
  currentCheckpointKey: string,
): number | null {
  const current = checkpointOrder(currentCheckpointKey);
  const passed = opponentCheckpoints
    .filter((c) => checkpointOrder(c.checkpointKey) < current)
    .sort((a, b) => b.elapsedActiveMs - a.elapsedActiveMs)[0];
  if (!passed) return null;
  return yourElapsedMs - passed.elapsedActiveMs;
}

/** Reps the past attempt had banked by `elapsedMs`, from its recorded telemetry. */
export function opponentRepsAt(opponentCheckpoints: OpponentCheckpoint[], elapsedMs: number): number {
  let reps = 0;
  for (const c of opponentCheckpoints) {
    if (c.elapsedActiveMs <= elapsedMs && c.reps != null && c.reps > reps) reps = c.reps;
  }
  return reps;
}

/**
 * How far along the past attempt was at `elapsedMs`, as a 0–1 fraction of
 * `totalSteps`. Uses movement checkpoints when recorded, round checkpoints for
 * older sessions.
 */
export function getOpponentProgress(
  opponentCheckpoints: OpponentCheckpoint[],
  _opponentFinalMs: number,
  yourElapsedMs: number,
  totalSteps?: number,
  totalRounds?: number,
): number {
  if (opponentCheckpoints.length === 0) return 0;
  const steps = opponentCheckpoints.filter((c) => isStepKey(c.checkpointKey));
  const source = steps.length > 0 ? steps : opponentCheckpoints.filter((c) => isRoundKey(c.checkpointKey));
  const list = source.length > 0 ? source : opponentCheckpoints;
  const total = (steps.length > 0 ? totalSteps : totalRounds) ?? list.length;
  const reached = list.filter((c) => c.elapsedActiveMs <= yourElapsedMs).length;
  return total > 0 ? Math.min(1, reached / total) : 0;
}
