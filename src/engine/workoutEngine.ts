import type { ActiveWorkoutState, ScalingCategory, SessionRoundState, WorkoutStructure } from '../domain/types';

export function advanceRep(state: ActiveWorkoutState, delta: number): ActiveWorkoutState {
  const round = state.rounds[state.currentRoundIndex];
  const exercise = round.exercises[state.currentExerciseIndex];
  const nextReps = Math.max(0, Math.min(exercise.targetReps || 999, exercise.completedReps + delta));
  const rounds = state.rounds.map((r, ri) =>
    ri !== state.currentRoundIndex
      ? r
      : {
          ...r,
          exercises: r.exercises.map((e, ei) =>
            ei !== state.currentExerciseIndex ? e : { ...e, completedReps: nextReps },
          ),
        },
  );
  return { ...state, rounds };
}

export function isExerciseComplete(state: ActiveWorkoutState): boolean {
  const ex = state.rounds[state.currentRoundIndex].exercises[state.currentExerciseIndex];
  if (ex.durationSec) return ex.completedReps >= 1;
  return ex.completedReps >= ex.targetReps;
}

export function completeCurrentExercise(state: ActiveWorkoutState): ActiveWorkoutState {
  const round = state.rounds[state.currentRoundIndex];
  const exercise = round.exercises[state.currentExerciseIndex];
  const rounds = state.rounds.map((r, ri) =>
    ri !== state.currentRoundIndex
      ? r
      : {
          ...r,
          exercises: r.exercises.map((e, ei) =>
            ei !== state.currentExerciseIndex
              ? e
              : { ...e, completedReps: e.durationSec ? 1 : e.targetReps },
          ),
        },
  );
  return { ...state, rounds };
}

export function nextStep(state: ActiveWorkoutState): { state: ActiveWorkoutState; checkpoint?: { key: string; label: string } } {
  let s = completeCurrentExercise(state);
  let checkpoint: { key: string; label: string } | undefined;

  const round = s.rounds[s.currentRoundIndex];
  const hasMoreExercises = s.currentExerciseIndex < round.exercises.length - 1;
  if (hasMoreExercises) {
    s = { ...s, currentExerciseIndex: s.currentExerciseIndex + 1 };
    return { state: s };
  }

  checkpoint = {
    key: `round-${round.roundNumber}`,
    label: `Round ${round.roundNumber}`,
  };

  const rounds = s.rounds.map((r, i) => (i === s.currentRoundIndex ? { ...r, completed: true } : r));
  s = { ...s, rounds };

  const hasMoreRounds = s.currentRoundIndex < s.rounds.length - 1;
  if (hasMoreRounds) {
    s = { ...s, currentRoundIndex: s.currentRoundIndex + 1, currentExerciseIndex: 0 };
    return { state: s, checkpoint };
  }

  s = { ...s, phase: 'completed' };
  return { state: s, checkpoint };
}

export function createActiveState(
  workoutId: string,
  workoutVersionId: string,
  workoutVariantId: string,
  partialKey: ActiveWorkoutState['partialKey'],
  scalingCategory: ScalingCategory,
  structure: WorkoutStructure,
): ActiveWorkoutState {
  return {
    workoutId,
    workoutVersionId,
    workoutVariantId,
    partialKey,
    scalingCategory,
    structure,
    currentRoundIndex: 0,
    currentExerciseIndex: 0,
    rounds: buildRoundsFromStructure(structure),
    phase: 'countdown',
    countdownRemaining: 3,
  };
}

function buildRoundsFromStructure(structure: WorkoutStructure): SessionRoundState[] {
  return structure.rounds.map((round) => ({
    roundNumber: round.roundNumber,
    completed: false,
    exercises: round.steps.map((step) => ({
      exerciseId: step.exerciseId,
      scaledExerciseId: step.exerciseId,
      targetReps: step.reps ?? 0,
      completedReps: 0,
      durationSec: step.durationSec,
    })),
  }));
}

export function scaleExercise(state: ActiveWorkoutState, scaledExerciseId: string): ActiveWorkoutState {
  const rounds = state.rounds.map((r, ri) =>
    ri !== state.currentRoundIndex
      ? r
      : {
