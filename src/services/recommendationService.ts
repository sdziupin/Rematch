import type { Difficulty } from '../domain/types';
import { WORKOUT_SEEDS } from '../content/seed';

export interface RecommendationInput {
  minutes: number;
  level: string;
  goal: string;
  equipment: string[];
  recentWorkoutIds: string[];
  painRecent: boolean;
}

export interface Recommendation {
  workoutId: string;
  reason: string;
}

const levelRank: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, elite: 4 };
