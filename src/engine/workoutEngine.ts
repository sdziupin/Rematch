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

