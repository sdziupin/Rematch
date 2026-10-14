import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthWorkout, estimateActiveKcal, healthActivityFor, pauseIntervals } from './health';

const base = {
  sessionId: 's1',
  pausedAccumulatedMs: 0,
  workout: { name: 'TEMPEST', focus: 'conditioning', kind: 'benchmark' },
  events: [],
};

test('health activity follows the workout focus', () => {
  assert.equal(healthActivityFor({ focus: 'conditioning' }), 'hiit');
  assert.equal(healthActivityFor({ focus: 'core' }), 'coreTraining');
  assert.equal(healthActivityFor({ focus: 'upper' }), 'functionalStrength');
  assert.equal(healthActivityFor({ focus: 'cardio' }), 'mixedCardio');
  assert.equal(healthActivityFor({ focus: 'mobility' }), 'flexibility');
  assert.equal(healthActivityFor({ focus: 'full_body', kind: 'warmup' }), 'flexibility');
  assert.equal(healthActivityFor(null), 'hiit');
});

test('energy needs a plausible body mass', () => {
  assert.equal(estimateActiveKcal('hiit', 30 * 60_000, null), null);
  assert.equal(estimateActiveKcal('hiit', 30 * 60_000, 10), null);
  // (8 − 1) × 80 kg × 0.5 h
  assert.equal(estimateActiveKcal('hiit', 30 * 60_000, 80), 280);
});

test('a finished session keeps its real start and pauses', () => {
  const start = 1_000_000;
  const w = buildHealthWorkout({
    ...base,
    startedAt: start,
    pausedAccumulatedMs: 60_000,
    result: { completionMs: 600_000, isAbandoned: false, createdAt: start + 660_000 },
    events: [
      { type: 'WorkoutPaused', createdAt: start + 100_000 },
      { type: 'WorkoutResumed', createdAt: start + 160_000 },
    ],
    bodyMassKg: 70,
  });
  assert.ok(w);
  assert.equal(w.start, start);
  assert.equal(w.end, start + 660_000);
  assert.deepEqual(w.pauses, [[start + 100_000, start + 160_000]]);
  assert.equal(w.activity, 'hiit');
  assert.equal(w.externalId, 's1');
  assert.equal(w.title, 'TEMPEST');
  assert.ok(w.energyKcal && w.energyKcal > 0);
});

test('an implausible start falls back to the active time before the result', () => {
  const end = 50_000_000;
  const w = buildHealthWorkout({
    ...base,
    startedAt: end - 10 * 3_600_000,
    result: { completionMs: 300_000, isAbandoned: false, createdAt: end },
    events: [{ type: 'WorkoutPaused', createdAt: end - 200_000 }],
  });
  assert.ok(w);
  assert.equal(w.start, end - 300_000);
  assert.deepEqual(w.pauses, []);
  assert.equal(w.energyKcal, null);
});

test('short abandoned attempts are not logged', () => {
  assert.equal(buildHealthWorkout({ ...base, startedAt: 0, result: { completionMs: 30_000, isAbandoned: true, createdAt: 30_000 } }), null);
  assert.ok(buildHealthWorkout({ ...base, startedAt: 0, result: { completionMs: 90_000, isAbandoned: true, createdAt: 90_000 } }));
});

test('pause intervals pair up, clip, and leave a trailing pause open', () => {
  const events = [
    { type: 'WorkoutResumed', createdAt: 5 },
    { type: 'WorkoutPaused', createdAt: 10 },
    { type: 'WorkoutPaused', createdAt: 12 },
    { type: 'WorkoutResumed', createdAt: 20 },
    { type: 'WorkoutPaused', createdAt: 90 },
  ];
  assert.deepEqual(pauseIntervals(events, 0, 100), [[10, 20], [90]]);
  assert.deepEqual(pauseIntervals([{ type: 'WorkoutPaused', createdAt: 150 }], 0, 100), []);
});
