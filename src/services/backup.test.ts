import test from 'node:test';
import assert from 'node:assert/strict';
import { configureDatabase, getDb } from '../db/client';
import { syncContent } from '../db/contentSync';
import { openNodeDriver } from '../db/nodeDriver';
import { loadWorkoutPlan } from '../db/repository';
import * as schema from '../db/schema';
import { completeStep, startWorkout } from '../engine/workoutEngine';
import { BackupError, createBackup, parseBackup, resetAllData, restoreBackup, serializeBackup } from './backupService';
import { saveCustomWorkout, buildStructure, validateStructure } from './customWorkoutService';
import { createSession, finishSession, getPb, listHistory, recordEngineEvents, saveFeedback } from './sessionService';
import { enroll, getActiveProgram } from './programService';

async function freshDb() {
  await configureDatabase(openNodeDriver(':memory:'));
  await syncContent();
}

async function play(workoutId: string, stepMs: number) {
  const plan = (await loadWorkoutPlan(workoutId, 'quarter'))!;
  const { sessionId, state } = await createSession({
    workoutId,
    workoutVersionId: plan.version.id,
    workoutVariantId: plan.variant.id,
    scalingCategory: 'rx',
    structure: plan.structure,
    partialKey: 'quarter',
  });
  let s = startWorkout(state, 0).state;
  let t = 0;
  while (s.phase === 'active') {
    t += stepMs;
    const r = completeStep(s, t);
    s = r.state;
    await recordEngineEvents(sessionId, r.events);
  }
  await finishSession(sessionId, s, t);
  return sessionId;
}

test('backup round-trips history, PBs, feedback and custom workouts', async () => {
  await freshDb();
  const a = await play('w-tempest', 20_000);
  await play('w-tempest', 18_000);
  await saveFeedback(a, 'good');
  const structure = buildStructure('fixed_rounds', [{ exerciseId: 'push-up', reps: 5 }, { exerciseId: 'air-squat', reps: 10 }], { rounds: 2 });
  assert.deepEqual(validateStructure(structure, 'Mine'), []);
  const customId = await saveCustomWorkout({ name: 'Mine', symbol: '◆', identityColor: '#4ECDC4', difficulty: 'beginner', structure }, ['bodyweight']);
  await play(customId, 10_000);

  const text = serializeBackup(await createBackup());
  await resetAllData();
  assert.equal((await listHistory()).length, 0);
  assert.equal((await getDb().select().from(schema.workouts)).some((w) => w.id === customId), false);

  const restored = await restoreBackup(parseBackup(text));
  assert.equal(restored.results, 3);
  const history = await listHistory();
  assert.equal(history.length, 3);
  assert.equal(history.filter((h) => h.isPb).length, 2, 'one PB for TEMPEST, one for the custom workout');
  const feedback = await getDb().select().from(schema.postWorkoutFeedback);
  assert.equal(feedback.length, 1);
  const plan = (await loadWorkoutPlan(customId, 'quarter'))!;
  assert.ok(plan, 'custom workout restored with its versions');
});

test('restore maps version ids from another install by content', async () => {
  await freshDb();
  await play('w-tempest', 20_000);
  const backup = await createBackup();
  // Pretend the other install numbered this version differently.
  const v = backup.data.versions[0];
  const oldId = v.id;
  const renamed = `${v.workoutId}-v7`;
  backup.data.versions = backup.data.versions.map((x) => (x.id === oldId ? { ...x, id: renamed } : x));
  backup.data.variants = backup.data.variants.map((x) => (x.workoutVersionId === oldId ? { ...x, id: x.id.replace(oldId, renamed), workoutVersionId: renamed } : x));
  backup.data.sessions = backup.data.sessions.map((s) => ({ ...s, workoutVersionId: renamed, workoutVariantId: s.workoutVariantId.replace(oldId, renamed) }));
  backup.data.results = backup.data.results.map((r) => ({ ...r, workoutVersionId: renamed, workoutVariantId: r.workoutVariantId.replace(oldId, renamed) }));

  await freshDb();
  await restoreBackup(parseBackup(serializeBackup(backup)));
  const plan = (await loadWorkoutPlan('w-tempest', 'quarter'))!;
  const pb = await getPb('w-tempest', plan.version.id, plan.variant.id, 'rx');
  assert.ok(pb, 'the restored result lands on the local version and counts as the PB');
  assert.equal((await getDb().select().from(schema.workoutVersions)).some((x) => x.id === renamed), false);
});

test('invalid backups are rejected with a readable error', () => {
  assert.throws(() => parseBackup('nope'), BackupError);
  assert.throws(() => parseBackup('{"format":"other"}'), /not a REMATCH backup/);
  assert.throws(() => parseBackup('{"format":"rematch-backup","version":99,"data":{}}'), /newer version/);
});

test('programs track progress through finished sessions', async () => {
  await freshDb();
  const { PROGRAM_SEEDS } = await import('../content/seed');
  if (!PROGRAM_SEEDS?.length) return;
  const program = PROGRAM_SEEDS[0];
  const enrollmentId = await enroll(program.id);
  const first = [...program.sessions].sort((x, y) => x.week - y.week || x.day - y.day)[0];
  const plan = (await loadWorkoutPlan(first.workoutId, first.partialKey ?? 'full'))!;
  const { sessionId, state } = await createSession({
    workoutId: first.workoutId,
    workoutVersionId: plan.version.id,
    workoutVariantId: plan.variant.id,
    scalingCategory: 'rx',
    structure: plan.structure,
    partialKey: first.partialKey ?? 'full',
    programEnrollmentId: enrollmentId,
    programSessionKey: `w${first.week}d${first.day}`,
  });
  let s = startWorkout(state, 0).state;
  let t = 0;
  for (let guard = 0; guard < 5000 && s.phase !== 'completed'; guard++) {
    t += 5_000;
    const { tick } = await import('../engine/workoutEngine');
    s = s.phase === 'active' && !s.rounds[s.currentRoundIndex].exercises[s.currentExerciseIndex].durationSec ? completeStep(s, t).state : tick(s, t).state;
  }
  await finishSession(sessionId, s, t);
  const active = await getActiveProgram();
  assert.equal(active?.progress.done, 1);
  assert.notEqual(active?.progress.next, first);
});
