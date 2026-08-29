import { ImageSourcePropType } from 'react-native';

export const EXERCISE_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  'push-up': require('../../assets/generated/exercises/push-up.png'),
  'air-squat': require('../../assets/generated/exercises/air-squat.png'),
  'burpee': require('../../assets/generated/exercises/burpee.png'),
  'plank-hold': require('../../assets/generated/exercises/plank-hold.png'),
};

export const WORKOUT_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  tempest: require('../../assets/generated/workouts/tempest.png'),
};

export function getExerciseImage(exerciseId: string): ImageSourcePropType | null {
  return EXERCISE_IMAGES[exerciseId] ?? null;
}

export function getWorkoutImage(slug: string): ImageSourcePropType | null {
  return WORKOUT_IMAGES[slug] ?? null;
}
