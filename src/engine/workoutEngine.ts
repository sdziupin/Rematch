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
