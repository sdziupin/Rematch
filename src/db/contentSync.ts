import { and, eq } from 'drizzle-orm';
import { EXERCISE_SEEDS, PARTIAL_FRACTIONS, WORKOUT_SEEDS, scaleStructure } from '../content/seed';
import type { WorkoutStructure } from '../domain/types';
import { ENGINE_VERSION, raceModeFor, scoringFor } from '../engine/workoutEngine';
import { type Db, getDb, withTransaction } from './client';
import * as schema from './schema';

/** FNV-1a: a fast, stable change detector (not a security hash). */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, '0')}${input.length.toString(16)}`;
}

/**
 * What makes two workout definitions "the same workout" for PB purposes: the
 * exact structure plus how it is scored. Metadata (names, colours, copy) can
 * change freely; this cannot without creating a new version.
 */
export function versionIdentity(structure: WorkoutStructure, scoring: string): string {
  return hashString(`${JSON.stringify(structure)}|${scoring}`);
}

export function rulesFor(format: WorkoutStructure['format']) {
  return { scoring: scoringFor(format), raceMode: raceModeFor(format), engine: ENGINE_VERSION };
}

function storedIdentity(v: typeof schema.workoutVersions.$inferSelect): string {
  if (v.contentHash) return v.contentHash;
  let scoring = 'time';
  try {
    scoring = (JSON.parse(v.rulesJson) as { scoring?: string }).scoring ?? 'time';
  } catch {
    // keep default
  }
  return versionIdentity(JSON.parse(v.structureJson) as WorkoutStructure, scoring);
}

async function ensureVariants(tx: Db, versionId: string, structure: WorkoutStructure, now: number) {
  const existing = await tx.select({ partialKey: schema.workoutVariants.partialKey }).from(schema.workoutVariants).where(eq(schema.workoutVariants.workoutVersionId, versionId));
  const have = new Set(existing.map((v) => v.partialKey));
  for (const partial of PARTIAL_FRACTIONS) {
    if (have.has(partial.key)) continue;
    await tx.insert(schema.workoutVariants).values({
      id: `${versionId}-${partial.key}`,
      workoutVersionId: versionId,
      partialKey: partial.key,
      label: partial.label,
      fraction: partial.fraction,
      structureJson: JSON.stringify(scaleStructure(structure, partial.fraction)),
      createdAt: now,
    });
  }
}

/**
 * Makes `structure` the current version of a workout, reusing an existing
 * version when the identity matches and creating `v(n+1)` otherwise.
 */
export async function ensureWorkoutVersion(tx: Db, workoutId: string, structure: WorkoutStructure, now = Date.now()): Promise<{ versionId: string; created: boolean }> {
  const rules = rulesFor(structure.format);
  const identity = versionIdentity(structure, rules.scoring);
  const versions = await tx.select().from(schema.workoutVersions).where(eq(schema.workoutVersions.workoutId, workoutId));
  const match = versions.find((v) => storedIdentity(v) === identity);

  let versionId: string;
  let created = false;
  if (match) {
    versionId = match.id;
    if (!match.contentHash || !match.isCurrent || match.rulesJson !== JSON.stringify(rules)) {
      await tx
        .update(schema.workoutVersions)
        .set({ contentHash: identity, isCurrent: true, rulesJson: JSON.stringify(rules) })
        .where(eq(schema.workoutVersions.id, match.id));
    }
  } else {
    let next = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    // Ids can be taken by versions restored from another install; skip past them.
    const taken = new Set(versions.map((v) => v.id));
    while (taken.has(`${workoutId}-v${next}`)) next += 1;
    versionId = `${workoutId}-v${next}`;
    created = true;
    await tx.insert(schema.workoutVersions).values({
      id: versionId,
      workoutId,
      version: next,
      structureJson: JSON.stringify(structure),
      rulesJson: JSON.stringify(rules),
      isCurrent: true,
      contentHash: identity,
      createdAt: now,
    });
  }
  for (const v of versions) {
    if (v.id !== versionId && v.isCurrent) {
      await tx.update(schema.workoutVersions).set({ isCurrent: false }).where(eq(schema.workoutVersions.id, v.id));
    }
  }
  await ensureVariants(tx, versionId, structure, now);
  return { versionId, created };
}

export function libraryContentHash(): string {
  return hashString(JSON.stringify({ e: EXERCISE_SEEDS, w: WORKOUT_SEEDS, p: PARTIAL_FRACTIONS, engine: ENGINE_VERSION }));
}

async function getMeta(tx: Db, key: string): Promise<string | null> {
  const rows = await tx.select().from(schema.appMeta).where(eq(schema.appMeta.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setMeta(tx: Db, key: string, value: string) {
  await tx.insert(schema.appMeta).values({ key, value }).onConflictDoUpdate({ target: schema.appMeta.key, set: { value } });
}

export const DEFAULT_PROFILE_ID = 'local-user';

/**
 * Brings shipped content (exercises, workouts, versions, variants) up to date.
 * Runs whenever the bundled content changes, so new workouts reach existing
 * installs and metadata fixes apply without touching anyone's history.
 */
export async function syncContent(options: { force?: boolean } = {}): Promise<{ changed: boolean }> {
  const hash = libraryContentHash();
  const current = await getMeta(getDb(), 'content_hash');
  const needsProfile = (await getDb().select({ id: schema.userProfile.id }).from(schema.userProfile).limit(1)).length === 0;
  if (!options.force && current === hash && !needsProfile) return { changed: false };

  await withTransaction(async (tx) => {
    const ts = Date.now();
    for (const ex of EXERCISE_SEEDS) {
      const values = {
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
        updatedAt: ts,
      };
      await tx
        .insert(schema.exercises)
        .values({ id: ex.id, createdAt: ts, ...values })
        .onConflictDoUpdate({ target: schema.exercises.id, set: values });
    }

    for (const w of WORKOUT_SEEDS) {
      const values = {
        slug: w.slug,
        name: w.name,
        symbol: w.symbol,
        focus: w.focus,
        difficulty: w.difficulty,
        estimatedMinutesMin: w.estimatedMinutesMin,
        estimatedMinutesMax: w.estimatedMinutesMax,
        equipmentJson: JSON.stringify(w.equipment),
        format: w.format,
        identityColor: w.identityColor,
        visualAsset: `workouts/${w.slug}`,
        progressionTier: w.progressionTier,
        description: w.description ?? null,
        kind: w.kind ?? 'benchmark',
        source: 'library',
        updatedAt: ts,
      };
      await tx
        .insert(schema.workouts)
        .values({ id: w.id, createdAt: ts, archived: false, ...values })
        .onConflictDoUpdate({ target: schema.workouts.id, set: values });
      await ensureWorkoutVersion(tx, w.id, w.structure, ts);
    }

    const profile = await tx.select({ id: schema.userProfile.id }).from(schema.userProfile).limit(1);
    if (profile.length === 0) {
      await tx.insert(schema.userProfile).values({
        id: DEFAULT_PROFILE_ID,
        goal: 'conditioning',
        level: 'intermediate',
        typicalMinutes: 15,
        frequencyDays: 3,
        restrictions: null,
        equipmentJson: JSON.stringify(['bodyweight', 'mat']),
        onboardingComplete: false,
        hapticsEnabled: true,
        soundEnabled: true,
        voiceEnabled: false,
        keepAwakeEnabled: true,
        countdownSec: 3,
        weekStartsOn: 1,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    await setMeta(tx, 'content_hash', hash);
  });
  return { changed: true };
}

/** Variant of the current version for a workout (defaults to the full workout). */
export async function getCurrentVariantId(db: Db, workoutId: string, partialKey = 'full'): Promise<{ versionId: string; variantId: string } | null> {
  const version = (
    await db
      .select({ id: schema.workoutVersions.id })
      .from(schema.workoutVersions)
      .where(and(eq(schema.workoutVersions.workoutId, workoutId), eq(schema.workoutVersions.isCurrent, true)))
      .limit(1)
  )[0];
  if (!version) return null;
  return { versionId: version.id, variantId: `${version.id}-${partialKey}` };
}
