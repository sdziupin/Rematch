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

export function recommendWorkout(input: RecommendationInput): Recommendation {
  const candidates = WORKOUT_SEEDS.filter((w) => {
    const durationOk = w.estimatedMinutesMin <= input.minutes + 5 && w.estimatedMinutesMax >= input.minutes - 5;
    const levelOk = levelRank[w.difficulty] <= (levelRank[input.level] ?? 2) + 1;
    const equipOk = w.equipment.every((e) => input.equipment.includes(e) || e === 'bodyweight');
    const lowImpact = input.painRecent ? w.focus === 'low_impact' || w.focus === 'core' : true;
    return durationOk && levelOk && equipOk && lowImpact;
  });

  const pool = candidates.length > 0 ? candidates : WORKOUT_SEEDS;
  const unscored = pool.filter((w) => !input.recentWorkoutIds.slice(0, 3).includes(w.id));
  const finalPool = unscored.length > 0 ? unscored : pool;
  const sorted = [...finalPool].sort((a, b) => {
    const aMid = (a.estimatedMinutesMin + a.estimatedMinutesMax) / 2;
    const bMid = (b.estimatedMinutesMin + b.estimatedMinutesMax) / 2;
    return Math.abs(aMid - input.minutes) - Math.abs(bMid - input.minutes);
  });
