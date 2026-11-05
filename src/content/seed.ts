import type { WorkoutStructure } from '../domain/types';

export { EXERCISE_SEEDS } from './exercises';
export { WORKOUT_SEEDS } from './workouts';
export { PROGRAM_SEEDS } from './programs';
export type { ExerciseSeed, WorkoutSeed, ProgramSeed } from './types';

/** Formats sized by the clock (cap, windows, intervals) rather than by dropping rounds. */
export function isTimeBoxed(format: WorkoutStructure['format']): boolean {
  return format === 'amrap' || format === 'emom' || format === 'intervals' || format === 'tabata' || format === 'death_by';
}

export const PARTIAL_FRACTIONS = [
  { key: 'full', label: 'FULL', fraction: 1 },
  { key: 'three_quarter', label: '3/4', fraction: 0.75 },
  { key: 'half', label: '1/2', fraction: 0.5 },
  { key: 'quarter', label: '1/4', fraction: 0.25 },
] as const;

export function scaleStructure(structure: WorkoutStructure, fraction: number): WorkoutStructure {
  if (fraction >= 1) return structure;
  // Time-boxed formats get shorter by time (cap, minutes, intervals); their
  // rounds are templates that rotate, so dropping one would drop movements.
  const timeBoxed = isTimeBoxed(structure.format);
  const roundCount = timeBoxed ? structure.rounds.length : Math.max(1, Math.round(structure.rounds.length * fraction));
  return {
    ...structure,
    rounds: structure.rounds.slice(0, roundCount),
    timeCapSec: structure.timeCapSec ? Math.round(structure.timeCapSec * fraction) : undefined,
    intervalRounds: structure.intervalRounds ? Math.max(1, Math.round(structure.intervalRounds * fraction)) : undefined,
  };
}
