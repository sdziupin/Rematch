import type { Difficulty } from '../domain/types';
import { WORKOUT_SEEDS } from '../content/seed';
import { normalizeEquipment, type WorkoutSeed } from '../content/types';
import { titleCase } from '../domain/utils';

export interface RecommendationInput {
  minutes: number;
  level: string;
  goal: string;
  equipment: string[];
  recentWorkoutIds: string[];
  painRecent: boolean;
  /** Varies the pick from day to day. Defaults to today's date. */
  daySeed?: number;
  /** Candidate pool; defaults to the shipped benchmarks. */
  pool?: Pick<WorkoutSeed, 'id' | 'focus' | 'difficulty' | 'estimatedMinutesMin' | 'estimatedMinutesMax' | 'equipment' | 'kind'>[];
}

export interface Recommendation {
  workoutId: string;
  reason: string;
  alternatives: string[];
}

const levelRank: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, elite: 4 };

const GOAL_FOCUS: Record<string, string[]> = {
  conditioning: ['conditioning', 'cardio', 'full_body', 'explosive'],
  strength_endurance: ['strength_endurance', 'upper', 'lower', 'full_body'],
  general_fitness: ['full_body', 'mixed', 'core', 'cardio'],
  consistency: ['full_body', 'mixed', 'low_impact', 'core'],
};

const LOW_IMPACT_FOCUS = new Set(['low_impact', 'core', 'mobility']);

function daySeedOf(ts = Date.now()): number {
  const d = new Date(ts);
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
}

export function recommendWorkout(input: RecommendationInput): Recommendation {
  const pool = (input.pool ?? WORKOUT_SEEDS).filter((w) => (w.kind ?? 'benchmark') === 'benchmark');
  const owned = new Set(normalizeEquipment(input.equipment));
  const level = levelRank[input.level] ?? 2;

  const usable = pool.filter((w) => {
    const equipOk = w.equipment.every((e) => e === 'bodyweight' || e === 'mat' || owned.has(e as never));
    const levelOk = levelRank[w.difficulty] <= level + 1;
    const impactOk = !input.painRecent || LOW_IMPACT_FOCUS.has(w.focus);
    return equipOk && levelOk && impactOk;
  });
  const candidates = usable.length > 0 ? usable : pool.filter((w) => w.equipment.every((e) => e === 'bodyweight' || e === 'mat'));
  const finalPool = candidates.length > 0 ? candidates : pool;

  const recent = new Set(input.recentWorkoutIds.slice(0, 3));
  const preferred = GOAL_FOCUS[input.goal] ?? [];
  const scored = finalPool.map((w) => {
    const mid = (w.estimatedMinutesMin + w.estimatedMinutesMax) / 2;
    let score = Math.abs(mid - input.minutes);
    if (input.minutes < w.estimatedMinutesMin - 5 || input.minutes > w.estimatedMinutesMax + 5) score += 10;
    if (recent.has(w.id)) score += 15;
    if (preferred.includes(w.focus)) score -= 2;
    score += Math.abs((levelRank[w.difficulty] ?? 2) - level) * 1.5;
    return { w, score };
  });
  scored.sort((a, b) => a.score - b.score || a.w.id.localeCompare(b.w.id));

  // Rotate among the closest matches so "Today" changes day to day.
  const best = scored[0].score;
  const top = scored.filter((s) => s.score <= best + 3).slice(0, 4);
  const seed = input.daySeed ?? daySeedOf();
  const pick = top[seed % top.length].w;

  return {
    workoutId: pick.id,
    reason: `${input.minutes} min · ${titleCase(pick.focus)} · ${titleCase(pick.difficulty)}`,
    alternatives: scored
      .map((s) => s.w.id)
      .filter((id) => id !== pick.id)
      .slice(0, 3),
  };
}

export function recommendTodayWorkout(input: RecommendationInput): Recommendation {
  return recommendWorkout({ ...input, minutes: input.minutes || 15 });
}

export function difficultyLabel(d: Difficulty | string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function focusLabel(focus: string): string {
  return titleCase(focus);
}
