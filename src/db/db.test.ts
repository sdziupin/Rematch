import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { configureDatabase, getDb } from './client';
import { syncContent } from './contentSync';
import { V1, getSchemaVersion } from './migrations';
import { openNodeDriver } from './nodeDriver';
import { loadWorkoutPlan } from './repository';
import * as schema from './schema';
import { WORKOUT_SEEDS } from '../content/seed';
import {
  buildRematchComparison,
  createSession,
  deleteSession,
  finishSession,
  getActiveSession,
  getPb,
  getResultSummary,
  listHistory,
  recordEngineEvents,
  saveFeedback,
} from '../services/sessionService';
import { advanceRep, completeStep, startWorkout, tick } from '../engine/workoutEngine';
import type { ActiveWorkoutState } from '../domain/types';

async function freshDb() {
  const driver = openNodeDriver(':memory:');
  await configureDatabase(driver);
  await syncContent();
  return driver;
}

/** Plays a for-time workout, finishing each step after `stepMs`. */
async function playForTime(workoutId: string, stepMs: number, opponentSessionId: string | null = null) {
  const plan = (await loadWorkoutPlan(workoutId, 'quarter'))!;
  const { sessionId, state } = await createSession({
    workoutId,
    workoutVersionId: plan.version.id,
    workoutVariantId: plan.variant.id,
    scalingCategory: 'rx',
    structure: plan.structure,
    partialKey: 'quarter',
    opponentSessionId,
  });
  let s: ActiveWorkoutState = startWorkout(state, 0).state;
  let t = 0;
  while (s.phase !== 'completed') {
    t += stepMs;
    const r = s.phase === 'rest' ? tick(s, t + 120_000) : completeStep(s, t);
    if (s.phase === 'rest') t += 120_000;
    s = r.state;
    await recordEngineEvents(sessionId, r.events);
  }
  const outcome = await finishSession(sessionId, s, t);
  return { sessionId, outcome, plan, elapsed: t };
}

test('fresh install: migrates, seeds content and the profile, and re-sync is a no-op', async () => {
  const driver = await freshDb();
  assert.equal(await getSchemaVersion(driver), 2);
  const workouts = await getDb().select().from(schema.workouts);
  assert.equal(workouts.length, WORKOUT_SEEDS.length);
  const profile = await getDb().select().from(schema.userProfile);
  assert.equal(profile.length, 1);
  assert.deepEqual(await syncContent(), { changed: false });
  const variants = await getDb().select().from(schema.workoutVariants);
  assert.equal(variants.length, WORKOUT_SEEDS.length * 4);
});

test('legacy v1 database upgrades in place and keeps its personal bests', async () => {
  const driver = openNodeDriver(':memory:');
  // Recreate exactly what the first release wrote: the v1 schema, user_version 0.
  await driver.exec(V1);
  const tempest = WORKOUT_SEEDS.find((w) => w.slug === 'tempest')!;
  const drift = WORKOUT_SEEDS.find((w) => w.slug === 'drift')!;
  const ts = 1_700_000_000_000;
  for (const w of [tempest, drift]) {
    await driver.query(
      `INSERT INTO workouts (id, slug, name, symbol, focus, difficulty, estimated_minutes_min, estimated_minutes_max, equipment_json, format, identity_color, visual_asset, progression_tier, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [w.id, w.slug, w.name, w.symbol, w.focus, w.difficulty, w.estimatedMinutesMin, w.estimatedMinutesMax, '["bodyweight"]', w.format, w.identityColor, `workouts/${w.slug}`, w.progressionTier, ts, ts],
      'run',
    );
    await driver.query(
      `INSERT INTO workout_versions (id, workout_id, version, structure_json, rules_json, is_current, created_at) VALUES (?,?,?,?,?,?,?)`,
      [`${w.id}-v1`, w.id, 1, JSON.stringify(w.structure), JSON.stringify({ scoring: 'time', restBetweenRoundsSec: 0 }), 1, ts],
      'run',
    );
  }
  await driver.query(
    `INSERT INTO workout_sessions (id, workout_id, workout_version_id, workout_variant_id, scaling_category, status, elapsed_active_ms, current_state_json, created_at, updated_at) VALUES ('s1', ?, ?, ?, 'rx', 'completed', 600000, '{}', ?, ?)`,
    [tempest.id, `${tempest.id}-v1`, `${tempest.id}-v1-full`, ts, ts],
    'run',
  );
  await driver.query(
    `INSERT INTO workout_results (id, session_id, workout_id, workout_version_id, workout_variant_id, scaling_category, completion_ms, is_complete, is_abandoned, created_at) VALUES ('r1','s1',?,?,?,'rx',600000,1,0,?)`,
    [tempest.id, `${tempest.id}-v1`, `${tempest.id}-v1-full`, ts],
    'run',
  );
  await driver.query(
    `INSERT INTO personal_bests (id, workout_id, workout_version_id, workout_variant_id, scaling_category, result_id, session_id, completion_ms, achieved_at) VALUES ('pb1',?,?,?,'rx','r1','s1',600000,?)`,
    [tempest.id, `${tempest.id}-v1`, `${tempest.id}-v1-full`, ts],
    'run',
  );

  await configureDatabase(driver);
  await syncContent();

  const tempestVersions = await getDb().select().from(schema.workoutVersions).where(eq(schema.workoutVersions.workoutId, tempest.id));
  assert.deepEqual(tempestVersions.map((v) => [v.id, v.isCurrent]), [[`${tempest.id}-v1`, true]], 'unchanged workouts keep v1');
  const pb = await getPb(tempest.id, `${tempest.id}-v1`, `${tempest.id}-v1-full`, 'rx');
  assert.equal(pb?.completionMs, 600000);

  const driftVersions = await getDb().select().from(schema.workoutVersions).where(eq(schema.workoutVersions.workoutId, drift.id));
  const current = driftVersions.find((v) => v.isCurrent)!;
  assert.equal(current.version, 2, 'intervals are now scored by reps, so they get a new version');
});

test('session lifecycle: results, PBs, rematch comparison, deletion repairs the PB', async () => {
  await freshDb();
  const first = await playForTime('w-tempest', 20_000);
  assert.equal(first.outcome.isNewPb, true);

  const slower = await playForTime('w-tempest', 25_000, first.sessionId);
  assert.equal(slower.outcome.isNewPb, false);
  const cmp = await buildRematchComparison(slower.sessionId, first.sessionId);
  if (!cmp) throw new Error('expected a comparison');
  assert.equal(cmp.won, false);
  assert.ok(cmp.checkpoints.length > 0);
  assert.ok(cmp.checkpoints.every((c) => c.deltaMs > 0));

  const faster = await playForTime('w-tempest', 15_000, first.sessionId);
  assert.equal(faster.outcome.isNewPb, true);
  assert.equal(faster.outcome.previousPb?.completionMs, first.elapsed);
  const summary = await getResultSummary(faster.sessionId);
  assert.equal(summary?.isPb, true);
  assert.equal(summary?.attempts, 3);
  assert.equal(summary?.comparison?.won, true);

  await deleteSession(faster.sessionId);
  const pb = await getPb('w-tempest', first.plan.version.id, first.plan.variant.id, 'rx');
  assert.equal(pb?.sessionId, first.sessionId, 'the next best attempt becomes the PB again');
  const history = await listHistory();
  assert.equal(history.length, 2);
  assert.equal(await getActiveSession(), null);
});

test('reps-scored workouts rank by reps and abandoned attempts never set a PB', async () => {
  await freshDb();
  const gale = WORKOUT_SEEDS.find((w) => w.format === 'amrap')!;
  const plan = (await loadWorkoutPlan(gale.id, 'quarter'))!;
  const run = async (stepMs: number, abandoned = false) => {
    const { sessionId, state } = await createSession({
      workoutId: gale.id,
      workoutVersionId: plan.version.id,
      workoutVariantId: plan.variant.id,
      scalingCategory: 'rx',
      structure: plan.structure,
      partialKey: 'quarter',
    });
    let s = startWorkout(state, 0).state;
    let t = 0;
    const cap = s.timeCapMs!;
    while (t + stepMs < cap) {
      t += stepMs;
      s = completeStep(s, t).state;
    }
    s = advanceRep(s, 2);
    if (!abandoned) s = tick(s, cap).state;
    return { sessionId, out: await finishSession(sessionId, s, abandoned ? t : cap, { abandoned }), reps: s.totalReps };
  };
  const a = await run(10_000);
  assert.equal(a.out.isNewPb, true);
  const b = await run(6_000, true);
  assert.equal(b.out.isNewPb, false, 'abandoned');
  const c = await run(8_000);
  assert.equal(c.out.isNewPb, true, 'more reps wins');
  const pb = await getPb(gale.id, plan.version.id, plan.variant.id, 'rx');
  assert.equal(pb?.scoreType, 'reps');
  assert.equal(pb?.sessionId, c.sessionId);
});

test('feedback can be saved more than once per session', async () => {
  await freshDb();
  const run = await playForTime('w-tempest', 20_000);
  await saveFeedback(run.sessionId, 'good');
  await saveFeedback(run.sessionId, 'too_hard', undefined, true);
  const rows = await getDb().select().from(schema.postWorkoutFeedback);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].intensity, 'too_hard');
  assert.equal(rows[0].painReported, true);
});

test('starting a new session abandons a dangling one', async () => {
  await freshDb();
  const plan = (await loadWorkoutPlan('w-tempest'))!;
  const base = { workoutId: 'w-tempest', workoutVersionId: plan.version.id, workoutVariantId: plan.variant.id, scalingCategory: 'rx' as const, structure: plan.structure, partialKey: 'full' as const };
  const one = await createSession(base);
  const two = await createSession(base);
  const active = await getActiveSession();
  assert.equal(active?.id, two.sessionId);
  assert.notEqual(active?.id, one.sessionId);
});

test('a late autosave cannot revive a finished session', async () => {
  await freshDb();
  const { sessionId } = await playForTime('w-tempest', 20_000);
  const { saveSessionState, getSession } = await import('../services/sessionService');
  const session = await getSession(sessionId);
  await saveSessionState(sessionId, JSON.parse(session!.currentStateJson), { elapsedActiveMs: 1, pausedAccumulatedMs: 0, lastPausedAt: null, status: 'active', startedAt: 0 });
  assert.equal((await getSession(sessionId))?.status, 'completed');
  assert.equal(await getActiveSession(), null);
});

test('finishing an already-recorded session repairs a stale live status', async () => {
  await freshDb();
  const { sessionId } = await playForTime('w-tempest', 20_000);
  await getDb().update(schema.workoutSessions).set({ status: 'active' }).where(eq(schema.workoutSessions.id, sessionId));
  const { getSession } = await import('../services/sessionService');
  const state = JSON.parse((await getSession(sessionId))!.currentStateJson);
  await finishSession(sessionId, state, 1000);
  assert.equal((await getSession(sessionId))?.status, 'completed');
});
