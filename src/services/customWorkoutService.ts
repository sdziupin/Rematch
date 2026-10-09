import { eq } from 'drizzle-orm';
import { withTransaction } from '../db/client';
import { ensureWorkoutVersion } from '../db/contentSync';
import * as schema from '../db/schema';
import { createId } from '../domain/id';
import type { Difficulty, WorkoutFormat, WorkoutStructure } from '../domain/types';
import { estimateStructureMinutes } from '../engine/workoutEngine';

export const CUSTOM_SYMBOLS = ['◆', '▲', '●', '■', '✦', '⬢', '◉', '✚', '⚑', '☄'];
export const CUSTOM_COLORS = ['#4ECDC4', '#F4A261', '#6BCB77', '#5B8DEF', '#C9B1FF', '#FB7185', '#FDE047', '#F97316'];

export interface CustomWorkoutInput {
  id?: string;
  name: string;
  symbol: string;
  identityColor: string;
  difficulty: Difficulty;
  description?: string;
  structure: WorkoutStructure;
}

/** Problems that would make a structure unplayable, phrased for the builder UI. */
export function validateStructure(structure: WorkoutStructure, name: string): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push('Give your workout a name.');
  const steps = structure.rounds.flatMap((r) => r.steps);
  if (structure.rounds.length === 0 || steps.length === 0) errors.push('Add at least one movement.');
  for (const s of steps) {
    const timed = structure.format === 'intervals';
    if (!timed && !(s.reps && s.reps > 0) && !(s.durationSec && s.durationSec > 0)) {
      errors.push('Every movement needs reps or seconds.');
      break;
    }
  }
  if (structure.format === 'amrap' && !(structure.timeCapSec && structure.timeCapSec >= 60)) errors.push('An AMRAP needs a time of at least 1 minute.');
  if (structure.format === 'intervals' && !(structure.intervalWorkSec && structure.intervalWorkSec >= 5)) errors.push('Intervals need at least 5 seconds of work.');
  if ((structure.format === 'intervals' || structure.format === 'emom') && !(structure.intervalRounds && structure.intervalRounds >= 1)) {
    errors.push(structure.format === 'emom' ? 'Set how many minutes the EMOM runs.' : 'Set how many intervals to do.');
  }
  return errors;
}

/** Repeats one list of movements into N rounds (how the builder edits round-based formats). */
export function buildStructure(
  format: WorkoutFormat,
  steps: WorkoutStructure['rounds'][number]['steps'],
  options: { rounds?: number; timeCapSec?: number; restBetweenRoundsSec?: number; intervalWorkSec?: number; intervalRestSec?: number; intervalRounds?: number },
): WorkoutStructure {
  const clean = steps.map((s) => ({ exerciseId: s.exerciseId, ...(s.reps ? { reps: s.reps } : {}), ...(s.durationSec ? { durationSec: s.durationSec } : {}) }));
  switch (format) {
    case 'amrap':
      return { format, timeCapSec: options.timeCapSec ?? 600, rounds: [{ roundNumber: 1, steps: clean }] };
    case 'emom':
      return { format, intervalRounds: options.intervalRounds ?? 10, intervalWorkSec: 60, rounds: [{ roundNumber: 1, steps: clean }] };
    case 'intervals':
      return {
        format,
        intervalWorkSec: options.intervalWorkSec ?? 40,
        intervalRestSec: options.intervalRestSec ?? 20,
        intervalRounds: options.intervalRounds ?? clean.length * 2,
        rounds: [{ roundNumber: 1, steps: clean.map((s) => ({ exerciseId: s.exerciseId })) }],
      };
    case 'chipper':
      return { format, rounds: [{ roundNumber: 1, steps: clean }] };
    default: {
      const count = Math.max(1, options.rounds ?? 3);
      return {
        format: 'fixed_rounds',
        ...(options.restBetweenRoundsSec ? { restBetweenRoundsSec: options.restBetweenRoundsSec } : {}),
        ...(options.timeCapSec ? { timeCapSec: options.timeCapSec } : {}),
        rounds: Array.from({ length: count }, (_, i) => ({ roundNumber: i + 1, steps: clean })),
      };
    }
  }
}

/** Creates or updates a custom workout. Changing its structure starts a new version, so old PBs stay honest. */
export async function saveCustomWorkout(input: CustomWorkoutInput, equipment: string[]): Promise<string> {
  const id = input.id ?? `c-${createId()}`;
  const minutes = estimateStructureMinutes(input.structure);
  const ts = Date.now();
  await withTransaction(async (tx) => {
    const values = {
      slug: `custom-${id}`,
      name: input.name.trim().toUpperCase(),
      symbol: input.symbol,
      focus: 'mixed',
      difficulty: input.difficulty,
      estimatedMinutesMin: Math.max(1, Math.round(minutes * 0.8)),
      estimatedMinutesMax: Math.max(2, Math.round(minutes * 1.3)),
      equipmentJson: JSON.stringify(equipment),
      format: input.structure.format,
      identityColor: input.identityColor,
      visualAsset: `workouts/custom-${id}`,
      progressionTier: 'custom',
      description: input.description?.trim() || null,
      kind: 'benchmark',
      source: 'custom',
      archived: false,
      updatedAt: ts,
    };
    await tx
      .insert(schema.workouts)
      .values({ id, createdAt: ts, ...values })
      .onConflictDoUpdate({ target: schema.workouts.id, set: values });
    await ensureWorkoutVersion(tx, id, input.structure, ts);
  });
  return id;
}

/** Hides a custom workout. Its history and PBs are kept. */
export async function archiveCustomWorkout(id: string) {
  await withTransaction(async (tx) => {
    await tx.update(schema.workouts).set({ archived: true, updatedAt: Date.now() }).where(eq(schema.workouts.id, id));
  });
}
