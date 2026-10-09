import { eq, inArray } from 'drizzle-orm';
import { getDb, withTransaction, type Db } from '../db/client';
import { versionIdentity } from '../db/contentSync';
import { SCHEMA_VERSION } from '../db/migrations';
import * as schema from '../db/schema';
import { isBetterScore } from '../domain/rematch';
import type { WorkoutStructure } from '../domain/types';
import { createId } from '../domain/id';
import { toScore } from './sessionService';

export const BACKUP_FORMAT = 'rematch-backup';
export const BACKUP_VERSION = 1;

type Rows<T extends keyof typeof TABLES> = (typeof TABLES)[T]['$inferSelect'][];

const TABLES = {
  profile: schema.userProfile,
  workouts: schema.workouts,
  versions: schema.workoutVersions,
  variants: schema.workoutVariants,
  sessions: schema.workoutSessions,
  events: schema.workoutSessionEvents,
  checkpoints: schema.workoutCheckpoints,
  results: schema.workoutResults,
  feedback: schema.postWorkoutFeedback,
  enrollments: schema.programEnrollments,
} as const;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: number;
  data: {
    profile: Rows<'profile'>;
    workouts: Rows<'workouts'>;
    versions: Rows<'versions'>;
    variants: Rows<'variants'>;
    sessions: Rows<'sessions'>;
    events: Rows<'events'>;
    checkpoints: Rows<'checkpoints'>;
    results: Rows<'results'>;
    feedback: Rows<'feedback'>;
    enrollments: Rows<'enrollments'>;
  };
}

export class BackupError extends Error {}

/** Everything the athlete created. Shipped library content is re-synced, not exported. */
export async function createBackup(): Promise<Backup> {
  const db = getDb();
  const sessions = await db.select().from(schema.workoutSessions);
  const results = await db.select().from(schema.workoutResults);
  const custom = await db.select().from(schema.workouts).where(eq(schema.workouts.source, 'custom'));
  const referencedWorkouts = new Set([...sessions.map((s) => s.workoutId), ...results.map((r) => r.workoutId), ...custom.map((w) => w.id)]);
  const referencedVersions = new Set([...sessions.map((s) => s.workoutVersionId), ...results.map((r) => r.workoutVersionId)]);
  const workouts = referencedWorkouts.size ? await db.select().from(schema.workouts).where(inArray(schema.workouts.id, [...referencedWorkouts])) : [];
  const allVersions = await db.select().from(schema.workoutVersions);
  const versions = allVersions.filter((v) => referencedVersions.has(v.id) || custom.some((w) => w.id === v.workoutId));
  const versionIds = new Set(versions.map((v) => v.id));
  const variants = (await db.select().from(schema.workoutVariants)).filter((v) => versionIds.has(v.workoutVersionId));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: {
      profile: await db.select().from(schema.userProfile),
      workouts,
      versions,
      variants,
      sessions: sessions.filter((s) => ['completed', 'abandoned'].includes(s.status)),
      events: await db.select().from(schema.workoutSessionEvents),
      checkpoints: await db.select().from(schema.workoutCheckpoints),
      results,
      feedback: await db.select().from(schema.postWorkoutFeedback),
      enrollments: await db.select().from(schema.programEnrollments),
    },
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup);
}

export function backupFileName(ts = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `rematch-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Validates an imported file. Throws `BackupError` with a message fit for the athlete. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file is not a REMATCH backup (it is not valid JSON).');
  }
  const b = raw as Partial<Backup>;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) throw new BackupError('That file is not a REMATCH backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of REMATCH. Update the app and try again.');
  const data = b.data as Partial<Backup['data']> | undefined;
  if (!data) throw new BackupError('The backup is missing its data.');
  for (const key of Object.keys(TABLES) as (keyof typeof TABLES)[]) {
    if (!Array.isArray(data[key])) throw new BackupError(`The backup is incomplete (missing ${key}).`);
  }
  const sessionIds = new Set(data.sessions!.map((s) => s.id));
  for (const r of data.results!) {
    if (!sessionIds.has(r.sessionId)) throw new BackupError('The backup is damaged: a result points to a missing session.');
  }
  return b as Backup;
}

function identityOf(v: Backup['data']['versions'][number]): string {
  if (v.contentHash) return v.contentHash;
  let scoring = 'time';
  try {
    scoring = (JSON.parse(v.rulesJson) as { scoring?: string }).scoring ?? 'time';
  } catch {
    // default
  }
  return versionIdentity(JSON.parse(v.structureJson) as WorkoutStructure, scoring);
}

async function recomputeAllPbs(tx: Db) {
  const results = await tx.select().from(schema.workoutResults);
  const best = new Map<string, schema.ResultRow>();
  for (const r of [...results].sort((a, b) => a.createdAt - b.createdAt)) {
    const key = `${r.workoutId}|${r.workoutVersionId}|${r.workoutVariantId}|${r.scalingCategory}`;
    const current = best.get(key);
    if (isBetterScore(toScore(r), current ? toScore(current) : null)) best.set(key, r);
  }
  await tx.delete(schema.personalBests);
  for (const r of best.values()) {
    await tx.insert(schema.personalBests).values({
      id: createId(),
      workoutId: r.workoutId,
      workoutVersionId: r.workoutVersionId,
      workoutVariantId: r.workoutVariantId,
      scalingCategory: r.scalingCategory,
      resultId: r.id,
      sessionId: r.sessionId,
      completionMs: r.completionMs,
      scoreType: r.scoreType,
      scoreReps: r.scoreReps,
      achievedAt: r.createdAt,
    });
  }
}

/** Replaces all personal data with the backup's. Library content stays as shipped. */
export async function restoreBackup(backup: Backup): Promise<{ sessions: number; results: number }> {
  const d = backup.data;
  return withTransaction(async (tx) => {
    // 1. Clear personal data.
    await tx.delete(schema.personalBests);
    await tx.delete(schema.postWorkoutFeedback);
    await tx.delete(schema.workoutCheckpoints);
    await tx.delete(schema.workoutSessionEvents);
    await tx.delete(schema.workoutResults);
    await tx.delete(schema.workoutSessions);
    await tx.delete(schema.programEnrollments);
    const localCustom = await tx.select({ id: schema.workouts.id }).from(schema.workouts).where(eq(schema.workouts.source, 'custom'));
    if (localCustom.length) {
      const ids = localCustom.map((w) => w.id);
      const versions = await tx.select({ id: schema.workoutVersions.id }).from(schema.workoutVersions).where(inArray(schema.workoutVersions.workoutId, ids));
      if (versions.length) await tx.delete(schema.workoutVariants).where(inArray(schema.workoutVariants.workoutVersionId, versions.map((v) => v.id)));
      await tx.delete(schema.workoutVersions).where(inArray(schema.workoutVersions.workoutId, ids));
      await tx.delete(schema.workouts).where(inArray(schema.workouts.id, ids));
    }

    // 2. Profile: keep the local row id, take the backup's preferences.
    const backupProfile = d.profile[0];
    const local = (await tx.select().from(schema.userProfile).limit(1))[0];
    if (backupProfile) {
      const { id: _id, createdAt: _c, ...prefs } = backupProfile;
      if (local) await tx.update(schema.userProfile).set({ ...prefs, updatedAt: Date.now() }).where(eq(schema.userProfile.id, local.id));
      else await tx.insert(schema.userProfile).values(backupProfile);
    }

    // 3. Workouts the backup refers to that this install doesn't have (custom ones, retired content).
    const localWorkouts = new Set((await tx.select({ id: schema.workouts.id }).from(schema.workouts)).map((w) => w.id));
    for (const w of d.workouts) {
      if (!localWorkouts.has(w.id)) {
        await tx.insert(schema.workouts).values(w);
        localWorkouts.add(w.id);
      }
    }

    // 4. Versions: match by identity so ids from another install map onto ours.
    const versionMap = new Map<string, string>();
    const localVersions = await tx.select().from(schema.workoutVersions);
    const usedIds = new Set(localVersions.map((v) => v.id));
    for (const v of d.versions) {
      const identity = identityOf(v);
      const match = localVersions.find((l) => l.workoutId === v.workoutId && (l.contentHash ?? identityOf(l)) === identity);
      if (match) {
        versionMap.set(v.id, match.id);
        continue;
      }
      let id = v.id;
      let versionNumber = v.version;
      if (usedIds.has(id)) {
        // Renumber so the id and the version number agree (content sync relies on it).
        versionNumber = localVersions.filter((l) => l.workoutId === v.workoutId).reduce((m, l) => Math.max(m, l.version), v.version) + 1;
        while (usedIds.has(`${v.workoutId}-v${versionNumber}`)) versionNumber += 1;
        id = `${v.workoutId}-v${versionNumber}`;
      }
      usedIds.add(id);
      versionMap.set(v.id, id);
      const isCustom = d.workouts.find((w) => w.id === v.workoutId)?.source === 'custom';
      const row = { ...v, id, version: versionNumber, contentHash: identity, isCurrent: isCustom ? v.isCurrent : false };
      await tx.insert(schema.workoutVersions).values(row);
      localVersions.push(row);
      for (const variant of d.variants.filter((x) => x.workoutVersionId === v.id)) {
        await tx.insert(schema.workoutVariants).values({ ...variant, id: `${id}-${variant.partialKey}`, workoutVersionId: id });
      }
    }
    const mapVersion = (id: string) => versionMap.get(id) ?? id;
    const variantPartial = new Map(d.variants.map((v) => [v.id, v.partialKey]));
    const mapVariant = (variantId: string, oldVersionId: string) => {
      const partial = variantPartial.get(variantId) ?? variantId.slice(oldVersionId.length + 1);
      return `${mapVersion(oldVersionId)}-${partial}`;
    };

    // 5. History.
    for (const s of d.sessions) {
      await tx.insert(schema.workoutSessions).values({ ...s, workoutVersionId: mapVersion(s.workoutVersionId), workoutVariantId: mapVariant(s.workoutVariantId, s.workoutVersionId) });
    }
    const sessionIds = new Set(d.sessions.map((s) => s.id));
    for (const e of d.events) if (sessionIds.has(e.sessionId)) await tx.insert(schema.workoutSessionEvents).values(e);
    for (const c of d.checkpoints) if (sessionIds.has(c.sessionId)) await tx.insert(schema.workoutCheckpoints).values(c);
    for (const r of d.results) {
      await tx.insert(schema.workoutResults).values({ ...r, workoutVersionId: mapVersion(r.workoutVersionId), workoutVariantId: mapVariant(r.workoutVariantId, r.workoutVersionId) });
    }
    for (const f of d.feedback) if (sessionIds.has(f.sessionId)) await tx.insert(schema.postWorkoutFeedback).values(f);
    for (const e of d.enrollments) await tx.insert(schema.programEnrollments).values(e);

    // 6. PBs are derived data: rebuild them.
    await recomputeAllPbs(tx);
    return { sessions: d.sessions.length, results: d.results.length };
  });
}

/** Wipes personal data (history, PBs, programs, custom workouts) and resets onboarding. */
export async function resetAllData() {
  const empty: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: { profile: [], workouts: [], versions: [], variants: [], sessions: [], events: [], checkpoints: [], results: [], feedback: [], enrollments: [] },
  };
  await restoreBackup(empty);
  await getDb().update(schema.userProfile).set({ onboardingComplete: false, updatedAt: Date.now() });
}
