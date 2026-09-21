import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimerSnapshot, getElapsedActiveMs, pauseTimer, resumeTimer, startTimer } from '../domain/timer';
import { compareCheckpoints } from '../domain/rematch';
import { areCompatible } from '../domain/utils';
import { advanceRep, nextStep, createActiveState } from '../engine/workoutEngine';
import { recommendWorkout } from '../services/recommendationService';
import type { WorkoutStructure } from '../domain/types';

test('timer tracks pause without drift', () => {
  let now = 1_000_000;
  let snap = startTimer(createTimerSnapshot(), now);
  now += 5000;
  assert.equal(getElapsedActiveMs(snap, now), 5000);
  snap = pauseTimer(snap, now);
  now += 60_000;
  assert.equal(getElapsedActiveMs(snap, now), 5000);
  snap = resumeTimer(snap, now);
  now += 2000;
  assert.equal(getElapsedActiveMs(snap, now), 7000);
});

test('rematch uses checkpoint telemetry not linear guess', () => {
  const result = compareCheckpoints(
    [
      { checkpointKey: 'round-1', label: 'Round 1', elapsedActiveMs: 120_000 },
      { checkpointKey: 'round-2', label: 'Round 2', elapsedActiveMs: 250_000 },
    ],
    [
      { checkpointKey: 'round-1', label: 'Round 1', elapsedActiveMs: 125_000 },
      { checkpointKey: 'round-2', label: 'Round 2', elapsedActiveMs: 260_000 },
    ],
    500_000,
    510_000,
  );
  assert.equal(result.won, true);
  assert.equal(result.checkpoints[0].deltaMs, -5000);
});

test('pb compatibility rejects scaled vs rx', () => {
  const rx = { workoutId: 'w1', workoutVersionId: 'v1', workoutVariantId: 'full', scalingCategory: 'rx' as const };
  const scaled = { ...rx, scalingCategory: 'scaled' as const };
  assert.equal(areCompatible(rx, scaled), false);
});

test('workout engine completes rounds', () => {
  const structure: WorkoutStructure = {
    format: 'fixed_rounds',
    rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'push-up', reps: 5 }] }],
  };
  let state = createActiveState('w', 'v', 'var', 'full', 'rx', structure);
  state = { ...state, phase: 'active' };
  const step = nextStep(state);
  assert.equal(step.state.phase, 'completed');
});

test('recommendation picks duration match', () => {
  const rec = recommendWorkout({
    minutes: 8,
    level: 'beginner',
    goal: 'conditioning',
    equipment: ['bodyweight', 'mat'],
    recentWorkoutIds: [],
    painRecent: false,
  });
  assert.ok(rec.workoutId);
});
