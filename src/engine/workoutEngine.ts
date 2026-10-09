import type {
  ActiveWorkoutState,
  PartialKey,
  RaceMode,
  ScalingCategory,
  ScoreType,
  SessionExerciseState,
  SessionRoundState,
  WorkoutExerciseStep,
  WorkoutFormat,
  WorkoutStructure,
} from '../domain/types';

/**
 * Deterministic workout state machine.
 *
 * Every transition takes the current elapsed *active* time (pauses excluded) and
 * returns the next state plus the events it produced. Timed transitions land on
 * their exact boundary (not on the tick that noticed them), so a late tick or a
 * backgrounded app never stretches an interval or a rest.
 */

export const ENGINE_VERSION = 2;
const DEFAULT_AMRAP_SEC = 600;
const DEFAULT_EMOM_WINDOW_SEC = 60;
const MAX_OPEN_REPS = 9999;

export type CheckpointKind = 'step' | 'round' | 'cap';

export type EngineEvent =
  | { type: 'StepStarted'; atMs: number; roundNumber: number; exerciseIndex: number; exerciseId: string }
  | { type: 'Checkpoint'; atMs: number; kind: CheckpointKind; key: string; label: string; reps: number; exerciseId?: string }
  | { type: 'RestStarted'; atMs: number; durationMs: number }
  | { type: 'RestEnded'; atMs: number; skipped: boolean }
  | { type: 'TimeCapReached'; atMs: number }
  | { type: 'WorkoutCompleted'; atMs: number; reason: 'finished' | 'time_cap' };

export interface EngineResult {
  state: ActiveWorkoutState;
  events: EngineEvent[];
}

export function scoringFor(format: WorkoutFormat): ScoreType {
  return format === 'amrap' || format === 'intervals' || format === 'emom' ? 'reps' : 'time';
}

export function raceModeFor(format: WorkoutFormat): RaceMode {
  return format === 'intervals' || format === 'emom' ? 'volume' : 'pace';
}

export function formatLabel(format: WorkoutFormat): string {
  switch (format) {
    case 'fixed_rounds':
      return 'For time';
    case 'chipper':
      return 'Chipper';
    case 'ladder':
      return 'Ladder';
    case 'intervals':
      return 'Intervals';
    case 'amrap':
      return 'AMRAP';
    case 'emom':
      return 'EMOM';
  }
}

// ---------------------------------------------------------------------------
// Building a session
// ---------------------------------------------------------------------------

function toExercise(step: WorkoutExerciseStep, swaps: Record<string, string>, override?: Partial<SessionExerciseState>): SessionExerciseState {
  return {
    exerciseId: step.exerciseId,
    scaledExerciseId: swaps[step.exerciseId] ?? step.exerciseId,
    targetReps: step.reps ?? 0,
    completedReps: 0,
    durationSec: step.durationSec,
    done: false,
    ...override,
  };
}

/** Expands a structure into the concrete rounds a session walks through. */
export function buildRounds(structure: WorkoutStructure, swaps: Record<string, string> = {}): SessionRoundState[] {
  if (structure.format === 'intervals') {
    const steps = structure.rounds.flatMap((r) => r.steps);
    if (steps.length === 0) return [];
    const count = Math.max(1, structure.intervalRounds ?? steps.length);
    const rest = structure.intervalRestSec ?? 0;
    return Array.from({ length: count }, (_, i) => {
      const step = steps[i % steps.length];
      const durationSec = structure.intervalWorkSec ?? step.durationSec ?? 30;
      return {
        roundNumber: i + 1,
        completed: false,
        restAfterSec: i < count - 1 ? rest : 0,
        exercises: [toExercise(step, swaps, { durationSec, targetReps: step.reps ?? 0 })],
      };
    });
  }

  if (structure.format === 'emom') {
    const templates = structure.rounds.filter((r) => r.steps.length > 0);
    if (templates.length === 0) return [];
    const count = Math.max(1, structure.intervalRounds ?? templates.length);
    const windowSec = structure.intervalWorkSec ?? DEFAULT_EMOM_WINDOW_SEC;
    return Array.from({ length: count }, (_, i) => ({
      roundNumber: i + 1,
      completed: false,
      windowSec,
      restAfterSec: 0,
      exercises: templates[i % templates.length].steps.map((s) => toExercise(s, swaps)),
    }));
  }

  const rest = structure.restBetweenRoundsSec ?? 0;
  return structure.rounds.map((round, i, all) => ({
    roundNumber: round.roundNumber,
    completed: false,
    restAfterSec: i < all.length - 1 ? rest : 0,
    exercises: round.steps.map((s) => toExercise(s, swaps)),
  }));
}

function timeCapFor(structure: WorkoutStructure): number | null {
  if (structure.format === 'amrap') return (structure.timeCapSec ?? DEFAULT_AMRAP_SEC) * 1000;
  // EMOM ends with its last window; intervals end with their last interval.
  if (structure.format === 'emom' || structure.format === 'intervals') return null;
  return structure.timeCapSec ? structure.timeCapSec * 1000 : null;
}

export function createActiveState(
  workoutId: string,
  workoutVersionId: string,
  workoutVariantId: string,
  partialKey: PartialKey,
  scalingCategory: ScalingCategory,
  structure: WorkoutStructure,
  options: { swaps?: Record<string, string>; countdownSec?: number } = {},
): ActiveWorkoutState {
  const swaps = options.swaps ?? {};
  const rounds = buildRounds(structure, swaps);
  return {
    workoutId,
    workoutVersionId,
    workoutVariantId,
    partialKey,
    scalingCategory,
    structure,
    currentRoundIndex: 0,
    currentExerciseIndex: 0,
    rounds,
    phase: 'countdown',
    countdownRemaining: options.countdownSec ?? 3,
    engineVersion: ENGINE_VERSION,
    scoring: scoringFor(structure.format),
    raceMode: raceModeFor(structure.format),
    stepStartedAtMs: 0,
    roundStartedAtMs: 0,
    restEndsAtMs: null,
    loop: 0,
    totalReps: 0,
    roundsCompleted: 0,
    timeCapMs: timeCapFor(structure),
    exerciseSwaps: { ...swaps },
  };
}

/**
 * Upgrades a persisted state (possibly written by an older engine) so every
 * optional field has a value. Old states keep their original round layout and
 * time scoring so an in-flight session resumes exactly where it was.
 */
export function normalizeState(raw: ActiveWorkoutState): ActiveWorkoutState {
  const legacy = raw.engineVersion === undefined;
  const rounds = raw.rounds.map((round, ri) => ({
    ...round,
    exercises: round.exercises.map((ex, ei) => {
      const before = ri < raw.currentRoundIndex || (ri === raw.currentRoundIndex && ei < raw.currentExerciseIndex);
      return { ...ex, done: ex.done ?? (round.completed || before) };
    }),
  }));
  const state: ActiveWorkoutState = {
    ...raw,
    rounds,
    engineVersion: ENGINE_VERSION,
    scoring: raw.scoring ?? (legacy ? 'time' : scoringFor(raw.structure.format)),
    raceMode: raw.raceMode ?? (legacy ? 'pace' : raceModeFor(raw.structure.format)),
    stepStartedAtMs: raw.stepStartedAtMs ?? 0,
    roundStartedAtMs: raw.roundStartedAtMs ?? raw.stepStartedAtMs ?? 0,
    restEndsAtMs: raw.restEndsAtMs ?? null,
    loop: raw.loop ?? 0,
    roundsCompleted: raw.roundsCompleted ?? rounds.filter((r) => r.completed).length,
    timeCapMs: raw.timeCapMs !== undefined ? raw.timeCapMs : legacy ? null : timeCapFor(raw.structure),
    exerciseSwaps: raw.exerciseSwaps ?? {},
  };
  if (state.totalReps === undefined) {
    state.totalReps = rounds.reduce(
      (sum, r) => sum + r.exercises.reduce((s, e) => s + (e.done ? e.completedReps : 0), 0),
      0,
    );
  }
  return state;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getCurrentExercise(state: ActiveWorkoutState): SessionExerciseState | undefined {
  return state.rounds[state.currentRoundIndex]?.exercises[state.currentExerciseIndex];
}

export function getCurrentRound(state: ActiveWorkoutState): SessionRoundState | undefined {
  return state.rounds[state.currentRoundIndex];
}

/** Round number across AMRAP passes (1-based). */
export function absoluteRoundNumber(state: ActiveWorkoutState): number {
  return (state.loop ?? 0) * state.rounds.length + state.currentRoundIndex + 1;
}

/** Key of the checkpoint the athlete is currently working toward. */
export function getCheckpointKey(state: ActiveWorkoutState): string {
  // Resting (or paused in a rest): the current movement is done, the next target is the next round.
  if (getCurrentExercise(state)?.done) return `r${absoluteRoundNumber(state) + 1}-e1`;
  return `r${absoluteRoundNumber(state)}-e${state.currentExerciseIndex + 1}`;
}

export function stepsPerPass(state: ActiveWorkoutState): number {
  return state.rounds.reduce((sum, r) => sum + r.exercises.length, 0);
}

export function completedStepCount(state: ActiveWorkoutState): number {
  const inPass = state.rounds.reduce((sum, r) => sum + r.exercises.filter((e) => e.done).length, 0);
  return (state.loop ?? 0) * stepsPerPass(state) + inPass;
}

/** Reps banked so far, including the partial count on the current step. */
export function liveReps(state: ActiveWorkoutState): number {
  const current = getCurrentExercise(state);
  const partial = current && !current.done && state.phase !== 'completed' ? current.completedReps : 0;
  return (state.totalReps ?? 0) + partial;
}

/** Timed step: ms left. `null` for rep-based steps. */
export function stepRemainingMs(state: ActiveWorkoutState, atMs: number): number | null {
  const ex = getCurrentExercise(state);
  if (!ex?.durationSec || state.phase === 'rest') return null;
  return Math.max(0, (state.stepStartedAtMs ?? 0) + ex.durationSec * 1000 - atMs);
}

export function restRemainingMs(state: ActiveWorkoutState, atMs: number): number | null {
  if (state.restEndsAtMs == null) return null;
  if (state.phase !== 'rest' && state.resumePhase !== 'rest') return null;
  return Math.max(0, state.restEndsAtMs - atMs);
}

export function capRemainingMs(state: ActiveWorkoutState, atMs: number): number | null {
  if (state.timeCapMs == null) return null;
  return Math.max(0, state.timeCapMs - atMs);
}

/** EMOM: ms left in the current minute window. */
export function windowRemainingMs(state: ActiveWorkoutState, atMs: number): number | null {
  const round = getCurrentRound(state);
  if (!round?.windowSec) return null;
  return Math.max(0, (state.roundStartedAtMs ?? 0) + round.windowSec * 1000 - atMs);
}

export function isExerciseComplete(state: ActiveWorkoutState): boolean {
  const ex = getCurrentExercise(state);
  if (!ex) return false;
  if (ex.done) return true;
  if (ex.durationSec) return false;
  return ex.targetReps > 0 && ex.completedReps >= ex.targetReps;
}

/** Whether the athlete may end the current step by tapping. Timed steps run their clock. */
export function canCompleteManually(state: ActiveWorkoutState): boolean {
  const ex = getCurrentExercise(state);
  return state.phase === 'active' && !!ex && !ex.durationSec;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

function updateCurrentExercise(state: ActiveWorkoutState, patch: (e: SessionExerciseState) => SessionExerciseState): ActiveWorkoutState {
  return {
    ...state,
    rounds: state.rounds.map((r, ri) =>
      ri !== state.currentRoundIndex
        ? r
        : { ...r, exercises: r.exercises.map((e, ei) => (ei === state.currentExerciseIndex ? patch(e) : e)) },
    ),
  };
}

function stepStarted(state: ActiveWorkoutState, atMs: number): EngineEvent {
  const ex = getCurrentExercise(state);
  return {
    type: 'StepStarted',
    atMs,
    roundNumber: absoluteRoundNumber(state),
    exerciseIndex: state.currentExerciseIndex,
    exerciseId: ex?.scaledExerciseId ?? '',
  };
}

function roundLabel(state: ActiveWorkoutState, n: number): string {
  if (state.structure.format === 'intervals') return `Interval ${n}`;
  if (state.structure.format === 'emom') return `Minute ${n}`;
  return `Round ${n}`;
}

export function startWorkout(state: ActiveWorkoutState, atMs = 0): EngineResult {
  if (state.phase !== 'countdown') return { state, events: [] };
  if (state.rounds.length === 0) {
    return {
      state: { ...state, phase: 'completed', endedBy: 'finished', countdownRemaining: 0 },
      events: [{ type: 'WorkoutCompleted', atMs, reason: 'finished' }],
    };
  }
  const next: ActiveWorkoutState = {
    ...state,
    phase: 'active',
    countdownRemaining: 0,
    stepStartedAtMs: atMs,
    roundStartedAtMs: atMs,
    restEndsAtMs: null,
  };
  return { state: next, events: [stepStarted(next, atMs)] };
}

/** Rep counter. Rep-based steps stop at their target; timed steps count freely. */
export function advanceRep(state: ActiveWorkoutState, delta: number): ActiveWorkoutState {
  const ex = getCurrentExercise(state);
  if (!ex || ex.done) return state;
  const max = !ex.durationSec && ex.targetReps > 0 ? ex.targetReps : MAX_OPEN_REPS;
  const nextReps = Math.max(0, Math.min(max, ex.completedReps + delta));
  if (nextReps === ex.completedReps) return state;
  return updateCurrentExercise(state, (e) => ({ ...e, completedReps: nextReps }));
}

function finishRound(state: ActiveWorkoutState, atMs: number, events: EngineEvent[]): ActiveWorkoutState {
  let s = state;
  const roundNo = absoluteRoundNumber(s);
  const round = s.rounds[s.currentRoundIndex];
  s = {
    ...s,
    roundsCompleted: (s.roundsCompleted ?? 0) + 1,
    rounds: s.rounds.map((r, i) => (i === s.currentRoundIndex ? { ...r, completed: true } : r)),
  };
  events.push({ type: 'Checkpoint', atMs, kind: 'round', key: `round-${roundNo}`, label: roundLabel(s, roundNo), reps: s.totalReps ?? 0 });

  const isLast = s.currentRoundIndex >= s.rounds.length - 1;

  if (s.structure.format === 'amrap') {
    if (isLast) {
      s = {
        ...s,
        loop: (s.loop ?? 0) + 1,
        currentRoundIndex: 0,
        currentExerciseIndex: 0,
        rounds: s.rounds.map((r) => ({
          ...r,
          completed: false,
          // A new pass: every movement follows the current swaps, including ones finished before a swap.
          exercises: r.exercises.map((e) => ({ ...e, scaledExerciseId: s.exerciseSwaps?.[e.exerciseId] ?? e.scaledExerciseId, completedReps: 0, done: false })),
        })),
      };
    } else {
      s = { ...s, currentRoundIndex: s.currentRoundIndex + 1, currentExerciseIndex: 0 };
    }
    s = { ...s, stepStartedAtMs: atMs, roundStartedAtMs: atMs };
    events.push(stepStarted(s, atMs));
    return s;
  }

  if (isLast) {
    events.push({ type: 'WorkoutCompleted', atMs, reason: 'finished' });
    return { ...s, phase: 'completed', endedBy: 'finished', restEndsAtMs: null };
  }

  if (round.windowSec) {
    // EMOM: the rest of the minute is rest; the next round starts on the boundary.
    const windowEnd = (s.roundStartedAtMs ?? 0) + round.windowSec * 1000;
    if (windowEnd > atMs) {
      events.push({ type: 'RestStarted', atMs, durationMs: windowEnd - atMs });
      return { ...s, phase: 'rest', restStartedAtMs: atMs, restEndsAtMs: windowEnd };
    }
    return beginNextRound(s, atMs, events);
  }

  const restSec = round.restAfterSec ?? 0;
  if (restSec > 0) {
    events.push({ type: 'RestStarted', atMs, durationMs: restSec * 1000 });
    return { ...s, phase: 'rest', restStartedAtMs: atMs, restEndsAtMs: atMs + restSec * 1000 };
  }
  return beginNextRound(s, atMs, events);
}

function beginNextRound(state: ActiveWorkoutState, atMs: number, events: EngineEvent[]): ActiveWorkoutState {
  const s: ActiveWorkoutState = {
    ...state,
    phase: 'active',
    restEndsAtMs: null,
    restStartedAtMs: null,
    currentRoundIndex: state.currentRoundIndex + 1,
    currentExerciseIndex: 0,
    stepStartedAtMs: atMs,
    roundStartedAtMs: atMs,
  };
  events.push(stepStarted(s, atMs));
  return s;
}

function completeStepAt(state: ActiveWorkoutState, atMs: number, events: EngineEvent[]): ActiveWorkoutState {
  const ex = getCurrentExercise(state);
  if (!ex || state.phase !== 'active') return state;
  // "Done" on a rep step means the prescribed reps; timed steps keep what was counted.
  const credited = !ex.durationSec && ex.targetReps > 0 ? ex.targetReps : ex.completedReps;
  let s = updateCurrentExercise(state, (e) => ({ ...e, completedReps: credited, done: true }));
  s = { ...s, totalReps: (s.totalReps ?? 0) + credited };
  const roundNo = absoluteRoundNumber(s);
  const round = s.rounds[s.currentRoundIndex];
  events.push({
    type: 'Checkpoint',
    atMs,
    kind: 'step',
    key: `r${roundNo}-e${s.currentExerciseIndex + 1}`,
    label: `${roundLabel(s, roundNo)} · ${s.currentExerciseIndex + 1}/${round.exercises.length}`,
    reps: s.totalReps ?? 0,
    exerciseId: ex.scaledExerciseId,
  });

  if (s.currentExerciseIndex < round.exercises.length - 1) {
    s = { ...s, currentExerciseIndex: s.currentExerciseIndex + 1, stepStartedAtMs: atMs };
    events.push(stepStarted(s, atMs));
    return s;
  }
  return finishRound(s, atMs, events);
}

/**
 * The athlete finished the current step (tap on DONE / NEXT).
 * Boundaries that already passed are applied first; if one fired (the minute
 * ended, the cap hit), the tap belonged to a moment that is over and is dropped.
 */
export function completeStep(state: ActiveWorkoutState, atMs: number): EngineResult {
  const due = tick(state, atMs);
  if (due.events.length > 0) return due;
  const events: EngineEvent[] = [];
  const next = completeStepAt(state, atMs, events);
  return { state: next, events };
}

function endAtCap(state: ActiveWorkoutState, capMs: number, events: EngineEvent[]): ActiveWorkoutState {
  const ex = getCurrentExercise(state);
  let s = state;
  if (ex && !ex.done && state.phase === 'active' && ex.completedReps > 0) {
    s = updateCurrentExercise(s, (e) => ({ ...e, done: true }));
    s = { ...s, totalReps: (s.totalReps ?? 0) + ex.completedReps };
  }
  events.push({ type: 'TimeCapReached', atMs: capMs });
  events.push({ type: 'Checkpoint', atMs: capMs, kind: 'cap', key: 'cap', label: 'Time cap', reps: s.totalReps ?? 0 });
  events.push({ type: 'WorkoutCompleted', atMs: capMs, reason: 'time_cap' });
  return { ...s, phase: 'completed', endedBy: 'time_cap', restEndsAtMs: null };
}

/** EMOM: the minute ran out before the round was finished. Partial reps count. */
function expireWindow(state: ActiveWorkoutState, windowEnd: number, events: EngineEvent[]): ActiveWorkoutState {
  const round = state.rounds[state.currentRoundIndex];
  const partial = round.exercises.reduce((sum, e) => sum + (e.done ? 0 : e.completedReps), 0);
  let s: ActiveWorkoutState = {
    ...state,
    totalReps: (state.totalReps ?? 0) + partial,
    rounds: state.rounds.map((r, i) =>
      i === state.currentRoundIndex ? { ...r, exercises: r.exercises.map((e) => ({ ...e, done: true })) } : r,
    ),
  };
  const roundNo = absoluteRoundNumber(s);
  s = {
    ...s,
    roundsCompleted: (s.roundsCompleted ?? 0) + 1,
    rounds: s.rounds.map((r, i) => (i === s.currentRoundIndex ? { ...r, completed: true } : r)),
  };
  events.push({ type: 'Checkpoint', atMs: windowEnd, kind: 'round', key: `round-${roundNo}`, label: roundLabel(s, roundNo), reps: s.totalReps ?? 0 });
  if (s.currentRoundIndex >= s.rounds.length - 1) {
    events.push({ type: 'WorkoutCompleted', atMs: windowEnd, reason: 'finished' });
    return { ...s, phase: 'completed', endedBy: 'finished' };
  }
  return beginNextRound(s, windowEnd, events);
}

/** One automatic transition, if one is due. Returns null when nothing is due. */
function autoStep(state: ActiveWorkoutState, atMs: number, events: EngineEvent[]): ActiveWorkoutState | null {
  if (state.phase !== 'active' && state.phase !== 'rest') return null;

  // The next boundary that is due, in chronological order.
  const cap = state.timeCapMs ?? Infinity;
  let boundary = Infinity;
  let kind: 'cap' | 'rest' | 'window' | 'step' | null = null;

  if (state.phase === 'rest' && state.restEndsAtMs != null) {
    boundary = state.restEndsAtMs;
    kind = 'rest';
  } else if (state.phase === 'active') {
    const round = getCurrentRound(state);
    const ex = getCurrentExercise(state);
    if (round?.windowSec) {
      boundary = (state.roundStartedAtMs ?? 0) + round.windowSec * 1000;
      kind = 'window';
    }
    if (ex?.durationSec) {
      const stepEnd = (state.stepStartedAtMs ?? 0) + ex.durationSec * 1000;
      if (stepEnd < boundary) {
        boundary = stepEnd;
        kind = 'step';
      }
    }
  }

  if (cap <= boundary && cap <= atMs) return endAtCap(state, cap, events);
  if (kind === null || boundary > atMs) return null;

  switch (kind) {
    case 'rest':
      events.push({ type: 'RestEnded', atMs: boundary, skipped: false });
      return beginNextRound(state, boundary, events);
    case 'window':
      return expireWindow(state, boundary, events);
    case 'step':
      return completeStepAt(state, boundary, events);
    default:
      return null;
  }
}

/** Applies every automatic transition due by `atMs` (timed steps, rests, windows, caps). */
export function tick(state: ActiveWorkoutState, atMs: number): EngineResult {
  const events: EngineEvent[] = [];
  let s = state;
  for (let guard = 0; guard < 10_000; guard++) {
    const next = autoStep(s, atMs, events);
    if (!next) break;
    s = next;
  }
  return { state: s, events };
}

export function skipRest(state: ActiveWorkoutState, atMs: number): EngineResult {
  const due = tick(state, atMs);
  if (due.events.length > 0) return due;
  if (state.phase !== 'rest' || state.structure.format === 'emom') return { state, events: [] };
  const events: EngineEvent[] = [{ type: 'RestEnded', atMs, skipped: true }];
  return { state: beginNextRound(state, atMs, events), events };
}

export function extendRest(state: ActiveWorkoutState, seconds: number): ActiveWorkoutState {
  if (state.phase !== 'rest' || state.restEndsAtMs == null || state.structure.format === 'emom') return state;
  return { ...state, restEndsAtMs: state.restEndsAtMs + seconds * 1000 };
}

export function pauseState(state: ActiveWorkoutState): ActiveWorkoutState {
  if (state.phase !== 'active' && state.phase !== 'rest') return state;
  return { ...state, phase: 'paused', resumePhase: state.phase };
}

export function resumeState(state: ActiveWorkoutState): ActiveWorkoutState {
  if (state.phase !== 'paused') return state;
  return { ...state, phase: state.resumePhase ?? 'active', resumePhase: undefined };
}

const SCALING_RANK: Record<ScalingCategory, number> = { rx: 0, scaled: 1, modified: 2 };

export function worseScaling(a: ScalingCategory, b: ScalingCategory): ScalingCategory {
  return SCALING_RANK[a] >= SCALING_RANK[b] ? a : b;
}

/**
 * Swaps a movement for the rest of the session. Every not-yet-finished
 * occurrence changes, and the session can only move down the scaling ladder
 * so an easier attempt never lands on an RX leaderboard.
 */
export function swapExercise(
  state: ActiveWorkoutState,
  rxExerciseId: string,
  newExerciseId: string,
  category: ScalingCategory,
): ActiveWorkoutState {
  return {
    ...state,
    scalingCategory: worseScaling(state.scalingCategory, category),
    exerciseSwaps: { ...(state.exerciseSwaps ?? {}), [rxExerciseId]: newExerciseId },
    rounds: state.rounds.map((r) => ({
      ...r,
      exercises: r.exercises.map((e) => (e.exerciseId === rxExerciseId && !e.done ? { ...e, scaledExerciseId: newExerciseId } : e)),
    })),
  };
}

/** @deprecated kept for older callers; prefer `completeStep`. */
export function nextStep(state: ActiveWorkoutState, atMs = 0): { state: ActiveWorkoutState; checkpoint?: { key: string; label: string } } {
  const { state: next, events } = completeStep(state.phase === 'countdown' ? { ...state, phase: 'active' } : state, atMs);
  const round = events.find((e): e is Extract<EngineEvent, { type: 'Checkpoint' }> => e.type === 'Checkpoint' && e.kind === 'round');
  return { state: next, checkpoint: round ? { key: round.key, label: round.label } : undefined };
}

/** Plain-language summary of what a structure asks for. */
export function describeStructure(structure: WorkoutStructure): string {
  switch (structure.format) {
    case 'amrap':
      return `As many rounds as possible in ${Math.round((structure.timeCapSec ?? DEFAULT_AMRAP_SEC) / 60)} min`;
    case 'emom': {
      const n = structure.intervalRounds ?? structure.rounds.length;
      return `Every minute on the minute for ${n} min`;
    }
    case 'intervals': {
      const n = structure.intervalRounds ?? structure.rounds.flatMap((r) => r.steps).length;
      return `${n} × ${structure.intervalWorkSec ?? 30}s work / ${structure.intervalRestSec ?? 0}s rest`;
    }
    case 'chipper':
      return 'Work through the list once, for time';
    case 'ladder':
      return `${structure.rounds.length} rungs, for time`;
    default: {
      const rest = structure.restBetweenRoundsSec ? ` · ${structure.restBetweenRoundsSec}s rest` : '';
      const n = structure.rounds.length;
      return `${n} round${n === 1 ? '' : 's'} for time${rest}`;
    }
  }
}

/** Rough expected duration in minutes, used for planning and recommendations. */
export function estimateStructureMinutes(structure: WorkoutStructure, secondsPerRep = 3): number {
  const rounds = buildRounds(structure);
  if (structure.format === 'amrap') return Math.round((timeCapFor(structure) ?? 0) / 60000);
  if (structure.format === 'emom') {
    return Math.round(rounds.reduce((sum, r) => sum + (r.windowSec ?? DEFAULT_EMOM_WINDOW_SEC), 0) / 60);
  }
  let sec = 0;
  for (const r of rounds) {
    for (const e of r.exercises) sec += e.durationSec ?? e.targetReps * secondsPerRep;
    sec += r.restAfterSec ?? 0;
  }
  return Math.max(1, Math.round(sec / 60));
}
