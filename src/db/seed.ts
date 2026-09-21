import { eq } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';
import { EXERCISE_SEEDS, WORKOUT_SEEDS, PARTIAL_FRACTIONS, scaleStructure } from '../content/seed';
import type { WorkoutStructure } from '../domain/types';

const now = () => Date.now();

export async function seedDatabaseIfNeeded() {
  const db = getDb();
  const existing = await db.select().from(schema.workouts).limit(1);
  if (existing.length > 0) return;

  const ts = now();

  for (const ex of EXERCISE_SEEDS) {
    await db.insert(schema.exercises).values({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      instructions: ex.instructions,
      startPosition: ex.startPosition,
      movementSequence: ex.movementSequence,
      cuesJson: JSON.stringify(ex.cues),
      mistakesJson: JSON.stringify(ex.mistakes),
      primaryMusclesJson: JSON.stringify(ex.primaryMuscles),
      secondaryMusclesJson: JSON.stringify(ex.secondaryMuscles),
      category: ex.category,
      equipmentJson: JSON.stringify(ex.equipment),
      impactLevel: ex.impactLevel,
      easierVariantId: ex.easierVariantId ?? null,
      harderVariantId: ex.harderVariantId ?? null,
      visualAsset: ex.visualAsset,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  for (const w of WORKOUT_SEEDS) {
    await db.insert(schema.workouts).values({
      id: w.id,
      slug: w.slug,
