import test from 'node:test';
import assert from 'node:assert/strict';
import type { ActiveWorkoutState, WorkoutStructure } from '../domain/types';
import {
  advanceRep,
  buildRounds,
  completeStep,
  createActiveState,
  extendRest,
  getCheckpointKey,
  liveReps,
  normalizeState,
  pauseState,
  restRemainingMs,
  resumeState,
  skipRest,
  startWorkout,
  stepRemainingMs,
  swapExercise,
  tick,
  type EngineEvent,
} from './workoutEngine';

const make = (structure: WorkoutStructure, swaps?: Record<string, string>) =>
  createActiveState('w', 'w-v1', 'w-v1-full', 'full', 'rx', structure, { swaps });

const checkpoints = (events: EngineEvent[]) =>
  events.filter((e): e is Extract<EngineEvent, { type: 'Checkpoint' }> => e.type === 'Checkpoint');

test('for-time: steps and rounds emit ordered checkpoints, then completes', () => {
  let s = make({
    format: 'fixed_rounds',
    rounds: [
      { roundNumber: 1, steps: [{ exerciseId: 'push-up', reps: 10 }, { exerciseId: 'air-squat', reps: 15 }] },
      { roundNumber: 2, steps: [{ exerciseId: 'push-up', reps: 10 }, { exerciseId: 'air-squat', reps: 15 }] },
    ],
  });
  assert.equal(s.scoring, 'time');
  s = startWorkout(s, 0).state;
  const all: EngineEvent[] = [];
  for (const at of [10_000, 25_000, 40_000, 55_000]) {
    const r = completeStep(s, at);
    s = r.state;
    all.push(...r.events);
  }
  assert.equal(s.phase, 'completed');
  assert.equal(s.endedBy, 'finished');
  assert.deepEqual(
    checkpoints(all).map((c) => `${c.key}@${c.atMs}`),
    ['r1-e1@10000', 'r1-e2@25000', 'round-1@25000', 'r2-e1@40000', 'r2-e2@55000', 'round-2@55000'],
  );
  assert.equal(s.totalReps, 50);
});

test('rest between rounds lands exactly on its boundary, even with a late tick', () => {
  let s = make({
    format: 'fixed_rounds',
    restBetweenRoundsSec: 30,
    rounds: [
      { roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 5 }] },
      { roundNumber: 2, steps: [{ exerciseId: 'burpee', reps: 5 }] },
    ],
  });
  s = startWorkout(s, 0).state;
  s = completeStep(s, 20_000).state;
  assert.equal(s.phase, 'rest');
  assert.equal(restRemainingMs(s, 25_000), 25_000);
  const r = tick(s, 61_000); // tick arrives 11s late
  assert.equal(r.state.phase, 'active');
  assert.equal(r.state.currentRoundIndex, 1);
  assert.equal(r.state.stepStartedAtMs, 50_000);
});

test('rest can be skipped or extended', () => {
  let s = make({
    format: 'fixed_rounds',
    restBetweenRoundsSec: 60,
    rounds: [
      { roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 5 }] },
      { roundNumber: 2, steps: [{ exerciseId: 'burpee', reps: 5 }] },
    ],
  });
  s = completeStep(startWorkout(s, 0).state, 10_000).state;
  const extended = extendRest(s, 15);
  assert.equal(extended.restEndsAtMs, 85_000);
  const skipped = skipRest(s, 12_000);
  assert.equal(skipped.state.phase, 'active');
  assert.equal(skipped.state.stepStartedAtMs, 12_000);
});

test('timed holds run their own clock and cannot be shortened by tapping', () => {
  let s = make({
    format: 'fixed_rounds',
    rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'sit-up', reps: 10 }, { exerciseId: 'plank-hold', durationSec: 30 }] }],
  });
  s = startWorkout(s, 0).state;
  s = completeStep(s, 15_000).state;
  assert.equal(stepRemainingMs(s, 20_000), 25_000);
  assert.equal(tick(s, 44_000).state.phase, 'active');
  const done = tick(s, 45_000);
  assert.equal(done.state.phase, 'completed');
  assert.equal(checkpoints(done.events)[0].atMs, 45_000);
});

test('intervals expand to every work interval with rest in between', () => {
  const structure: WorkoutStructure = {
    format: 'intervals',
    intervalWorkSec: 45,
    intervalRestSec: 15,
    intervalRounds: 8,
    rounds: [{ roundNumber: 1, steps: ['high-knees', 'jumping-jack', 'butt-kicks', 'mountain-climber'].map((id) => ({ exerciseId: id, durationSec: 45 })) }],
  };
  const rounds = buildRounds(structure);
  assert.equal(rounds.length, 8);
  assert.equal(rounds[4].exercises[0].exerciseId, 'high-knees');
  assert.equal(rounds[7].restAfterSec, 0);

  let s = startWorkout(make(structure), 0).state;
  assert.equal(s.scoring, 'reps');
  assert.equal(s.raceMode, 'volume');
  s = advanceRep(s, 20);
  // Background the app for the whole workout: one tick catches up exactly.
  const r = tick(s, 10 * 60_000);
  assert.equal(r.state.phase, 'completed');
  const done = r.events.find((e) => e.type === 'WorkoutCompleted');
  assert.equal(done?.atMs, 8 * 45_000 + 7 * 15_000);
  assert.equal(r.state.totalReps, 20);
});

test('AMRAP loops rounds until the cap and keeps partial reps', () => {
  let s = make({
    format: 'amrap',
    timeCapSec: 120,
    rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 5 }, { exerciseId: 'air-squat', reps: 10 }] }],
  });
  s = startWorkout(s, 0).state;
  let t = 0;
  const all: EngineEvent[] = [];
  for (let i = 0; i < 6; i++) {
    t += 15_000;
    const r = completeStep(s, t);
    s = r.state;
    all.push(...r.events);
  }
  assert.equal(s.loop, 3);
  assert.equal(s.roundsCompleted, 3);
  assert.equal(s.totalReps, 45);
  s = advanceRep(s, 3);
  assert.equal(liveReps(s), 48);
  const end = tick(s, 120_000);
  assert.equal(end.state.phase, 'completed');
  assert.equal(end.state.endedBy, 'time_cap');
  assert.equal(end.state.totalReps, 48);
  assert.ok(checkpoints(all).some((c) => c.key === 'round-3'));
  assert.ok(checkpoints(all).some((c) => c.key === 'r3-e2'));
});

test('EMOM rests until the minute boundary and expires unfinished minutes', () => {
  let s = make({
    format: 'emom',
    intervalRounds: 3,
    rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 10 }] }],
  });
  s = startWorkout(s, 0).state;
  s = completeStep(s, 40_000).state;
  assert.equal(s.phase, 'rest');
  assert.equal(skipRest(s, 45_000).state.phase, 'rest', 'EMOM rest cannot be skipped');
  s = tick(s, 61_000).state;
  assert.equal(s.currentRoundIndex, 1);
  assert.equal(s.roundStartedAtMs, 60_000);
  s = advanceRep(s, 7); // only 7 of 10 before the minute ends
  const r = tick(s, 125_000);
  assert.equal(r.state.currentRoundIndex, 2);
  assert.equal(r.state.totalReps, 17);
  s = completeStep(r.state, 170_000).state;
  assert.equal(s.phase, 'completed');
  assert.equal(s.totalReps, 27);
});

test('pause and resume return to the phase that was interrupted', () => {
  let s = make({
    format: 'fixed_rounds',
    restBetweenRoundsSec: 30,
    rounds: [
      { roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 5 }] },
      { roundNumber: 2, steps: [{ exerciseId: 'burpee', reps: 5 }] },
    ],
  });
  s = completeStep(startWorkout(s, 0).state, 10_000).state;
  const paused = pauseState(s);
  assert.equal(paused.phase, 'paused');
  assert.equal(tick(paused, 100_000).state.phase, 'paused', 'nothing advances while paused');
  assert.equal(resumeState(paused).phase, 'rest');
});

test('rep counter respects targets for rep steps and counts freely in timed steps', () => {
  let s = startWorkout(make({ format: 'fixed_rounds', rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'push-up', reps: 5 }] }] }), 0).state;
  s = advanceRep(s, 50);
  assert.equal(s.rounds[0].exercises[0].completedReps, 5);
  s = advanceRep(s, -9);
  assert.equal(s.rounds[0].exercises[0].completedReps, 0);
});

test('scaling swaps change remaining movements and only ever downgrade', () => {
  let s = make(
    {
      format: 'fixed_rounds',
      rounds: [
        { roundNumber: 1, steps: [{ exerciseId: 'push-up', reps: 5 }] },
        { roundNumber: 2, steps: [{ exerciseId: 'push-up', reps: 5 }] },
      ],
    },
    { 'push-up': 'knee-push-up' },
  );
  assert.equal(s.rounds[1].exercises[0].scaledExerciseId, 'knee-push-up');
  s = completeStep(startWorkout(s, 0).state, 5_000).state;
  s = swapExercise(s, 'push-up', 'wall-push-up', 'modified');
  assert.equal(s.scalingCategory, 'modified');
  assert.equal(s.rounds[0].exercises[0].scaledExerciseId, 'knee-push-up', 'finished work keeps its movement');
  assert.equal(s.rounds[1].exercises[0].scaledExerciseId, 'wall-push-up');
  s = swapExercise(s, 'push-up', 'push-up', 'rx');
  assert.equal(s.scalingCategory, 'modified', 'cannot climb back to RX mid-session');
});

test('legacy persisted states are upgraded without losing progress', () => {
  const legacy = {
    workoutId: 'w',
    workoutVersionId: 'v',
    workoutVariantId: 'var',
    partialKey: 'full',
    scalingCategory: 'rx',
    structure: { format: 'fixed_rounds', rounds: [] },
    currentRoundIndex: 1,
    currentExerciseIndex: 0,
    rounds: [
      { roundNumber: 1, completed: true, exercises: [{ exerciseId: 'a', scaledExerciseId: 'a', targetReps: 5, completedReps: 5 }] },
      { roundNumber: 2, completed: false, exercises: [{ exerciseId: 'a', scaledExerciseId: 'a', targetReps: 5, completedReps: 2 }] },
    ],
    phase: 'active',
    countdownRemaining: 0,
  } as unknown as ActiveWorkoutState;
  const s = normalizeState(legacy);
  assert.equal(s.rounds[0].exercises[0].done, true);
  assert.equal(s.rounds[1].exercises[0].done, false);
  assert.equal(s.totalReps, 5);
  assert.equal(s.scoring, 'time');
  assert.equal(completeStep(s, 1000).state.phase, 'completed');
});

test('a structure with no rounds completes immediately instead of crashing', () => {
  const r = startWorkout(make({ format: 'fixed_rounds', rounds: [] }), 0);
  assert.equal(r.state.phase, 'completed');
});

test('a tap after a boundary has passed is dropped in favour of the boundary (EMOM)', () => {
  let s = make({ format: 'emom', intervalRounds: 3, rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 10 }] }] });
  s = startWorkout(s, 0).state;
  // The minute ended at 60 s; the tap lands 150 ms later, before the next tick.
  const r = completeStep(s, 60_150);
  assert.equal(r.state.currentRoundIndex, 1, 'the expired minute moved on');
  assert.equal(r.state.totalReps, 0, 'no credit for a minute that was over');
  assert.equal(r.state.roundStartedAtMs, 60_000, 'the next minute starts on the boundary, no drift');
});

test('a tap after the time cap cannot turn a capped attempt into a finish', () => {
  let s = make({ format: 'fixed_rounds', timeCapSec: 300, rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 100 }] }] });
  s = startWorkout(s, 0).state;
  const r = completeStep(s, 300_150);
  assert.equal(r.state.phase, 'completed');
  assert.equal(r.state.endedBy, 'time_cap');
});

test('AMRAP passes keep a mid-workout swap for repeated movements', () => {
  let s = make({
    format: 'amrap',
    timeCapSec: 600,
    rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'push-up', reps: 5 }, { exerciseId: 'air-squat', reps: 5 }, { exerciseId: 'push-up', reps: 5 }] }],
  });
  s = startWorkout(s, 0).state;
  s = completeStep(s, 10_000).state;
  s = completeStep(s, 20_000).state;
  s = swapExercise(s, 'push-up', 'knee-push-up', 'scaled');
  s = completeStep(s, 30_000).state; // pass 2 begins
  assert.equal(s.loop, 1);
  assert.deepEqual(
    s.rounds[0].exercises.map((e) => e.scaledExerciseId),
    ['knee-push-up', 'air-squat', 'knee-push-up'],
  );
});

test('during rest the race target is the next round, not the checkpoint just reached', () => {
  let s = make({
    format: 'fixed_rounds',
    restBetweenRoundsSec: 60,
    rounds: [
      { roundNumber: 1, steps: [{ exerciseId: 'burpee', reps: 5 }] },
      { roundNumber: 2, steps: [{ exerciseId: 'burpee', reps: 5 }] },
    ],
  });
  s = completeStep(startWorkout(s, 0).state, 20_000).state;
  assert.equal(s.phase, 'rest');
  assert.equal(getCheckpointKey(s), 'r2-e1');
  assert.equal(getCheckpointKey(pauseState(s)), 'r2-e1');
});
