import { and, asc, eq, inArray } from 'drizzle-orm';
import type { WorkoutStructure } from '../domain/types';
import { normalizeEquipment, type EquipmentId } from '../content/types';
import { getDb } from './client';
import * as schema from './schema';

export type Profile = schema.ProfileRow;

export async function getProfile(): Promise<Profile | null> {
  const rows = await getDb().select().from(schema.userProfile).limit(1);
  return rows[0] ?? null;
}

export async function updateProfile(patch: Partial<typeof schema.userProfile.$inferInsert>) {
  const profile = await getProfile();
  if (!profile) return;
  await getDb()
    .update(schema.userProfile)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(schema.userProfile.id, profile.id));
}

export function profileEquipment(profile: Profile | null): EquipmentId[] {
  try {
    return normalizeEquipment(JSON.parse(profile?.equipmentJson ?? '[]') as string[]);
  } catch {
    return ['bodyweight'];
  }
}

export async function listWorkouts(options: { includeArchived?: boolean } = {}) {
  const rows = await getDb().select().from(schema.workouts).orderBy(asc(schema.workouts.name));
  return options.includeArchived ? rows : rows.filter((w) => !w.archived);
}

export async function getWorkoutById(id: string) {
  const rows = await getDb().select().from(schema.workouts).where(eq(schema.workouts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCurrentVersion(workoutId: string) {
  const rows = await getDb().select().from(schema.workoutVersions).where(eq(schema.workoutVersions.workoutId, workoutId));
  return rows.find((r) => r.isCurrent) ?? rows.sort((a, b) => b.version - a.version)[0] ?? null;
}

export async function getVersionById(versionId: string) {
  const rows = await getDb().select().from(schema.workoutVersions).where(eq(schema.workoutVersions.id, versionId)).limit(1);
  return rows[0] ?? null;
}

export async function getVariant(versionId: string, partialKey = 'full') {
  const rows = await getDb().select().from(schema.workoutVariants).where(eq(schema.workoutVariants.workoutVersionId, versionId));
  return rows.find((r) => r.partialKey === partialKey) ?? rows.find((r) => r.partialKey === 'full') ?? rows[0] ?? null;
}

export async function getVariantById(id: string) {
  const rows = await getDb().select().from(schema.workoutVariants).where(eq(schema.workoutVariants.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Everything needed to start or preview a workout variant. */
export async function loadWorkoutPlan(workoutId: string, partialKey = 'full') {
  const workout = await getWorkoutById(workoutId);
  if (!workout) return null;
  const version = await getCurrentVersion(workoutId);
  if (!version) return null;
  const variant = await getVariant(version.id, partialKey);
  if (!variant) return null;
  return {
    workout,
    version,
    variant,
    structure: JSON.parse(variant.structureJson) as WorkoutStructure,
    fullStructure: JSON.parse(version.structureJson) as WorkoutStructure,
  };
}

export async function getExercise(id: string) {
  const rows = await getDb().select().from(schema.exercises).where(eq(schema.exercises.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listExercises() {
  return getDb().select().from(schema.exercises).orderBy(asc(schema.exercises.name));
}

export async function getExercisesByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, schema.ExerciseRow>();
  const rows = await getDb().select().from(schema.exercises).where(inArray(schema.exercises.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function listCustomWorkouts() {
  return getDb()
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.source, 'custom'), eq(schema.workouts.archived, false)))
    .orderBy(asc(schema.workouts.name));
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Benchmarks whose current version uses an exercise. */
export async function findWorkoutsUsingExercise(exerciseId: string, limit = 6) {
  const db = getDb();
  const versions = await db
    .select({ workoutId: schema.workoutVersions.workoutId, structureJson: schema.workoutVersions.structureJson })
    .from(schema.workoutVersions)
    .where(eq(schema.workoutVersions.isCurrent, true));
  const needle = `"exerciseId":${JSON.stringify(exerciseId)}`;
  const ids = versions.filter((v) => v.structureJson.includes(needle)).map((v) => v.workoutId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(schema.workouts).where(inArray(schema.workouts.id, ids));
  return rows.filter((w) => !w.archived && w.kind === 'benchmark').slice(0, limit);
}
