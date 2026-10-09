import { and, desc, eq } from 'drizzle-orm';
import { PROGRAM_SEEDS } from '../content/seed';
import type { ProgramSeed } from '../content/types';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { createId } from '../domain/id';
import { programProgress, type ProgramProgress } from '../domain/programs';

export function listPrograms(): ProgramSeed[] {
  return PROGRAM_SEEDS;
}

export function getProgram(id: string): ProgramSeed | null {
  return PROGRAM_SEEDS.find((p) => p.id === id || p.slug === id) ?? null;
}

export async function getActiveEnrollment() {
  const rows = await getDb()
    .select()
    .from(schema.programEnrollments)
    .where(eq(schema.programEnrollments.status, 'active'))
    .orderBy(desc(schema.programEnrollments.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Starts a program. Any other active program is left (its history stays). */
export async function enroll(programId: string) {
  const db = getDb();
  const ts = Date.now();
  await db.update(schema.programEnrollments).set({ status: 'abandoned', updatedAt: ts }).where(eq(schema.programEnrollments.status, 'active'));
  const id = createId();
  await db.insert(schema.programEnrollments).values({ id, programId, status: 'active', startedAt: ts, completedAt: null, createdAt: ts, updatedAt: ts });
  return id;
}

export async function leaveProgram(enrollmentId: string) {
  await getDb()
    .update(schema.programEnrollments)
    .set({ status: 'abandoned', updatedAt: Date.now() })
    .where(eq(schema.programEnrollments.id, enrollmentId));
}

/** Program sessions finished under an enrollment (an abandoned attempt doesn't count). */
export async function completedProgramKeys(enrollmentId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ key: schema.workoutSessions.programSessionKey, status: schema.workoutSessions.status })
    .from(schema.workoutSessions)
    .where(and(eq(schema.workoutSessions.programEnrollmentId, enrollmentId), eq(schema.workoutSessions.status, 'completed')));
  return new Set(rows.map((r) => r.key).filter((k): k is string => !!k));
}

export interface ActiveProgram {
  program: ProgramSeed;
  enrollment: schema.EnrollmentRow;
  progress: ProgramProgress;
}

/** The athlete's current program with progress; finishes it once every session is done. */
export async function getActiveProgram(): Promise<ActiveProgram | null> {
  const enrollment = await getActiveEnrollment();
  if (!enrollment) return null;
  const program = getProgram(enrollment.programId);
  if (!program) return null;
  const progress = programProgress(program, await completedProgramKeys(enrollment.id));
  if (progress.complete) {
    const ts = Date.now();
    await getDb()
      .update(schema.programEnrollments)
      .set({ status: 'completed', completedAt: ts, updatedAt: ts })
      .where(eq(schema.programEnrollments.id, enrollment.id));
    return { program, enrollment: { ...enrollment, status: 'completed', completedAt: ts }, progress };
  }
  return { program, enrollment, progress };
}

export async function listEnrollments() {
  return getDb().select().from(schema.programEnrollments).orderBy(desc(schema.programEnrollments.startedAt));
}
