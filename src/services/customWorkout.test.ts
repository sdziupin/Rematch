import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStructure, validateStructure } from './customWorkoutService';

test('builder ladders multiply the rung-1 reps; pyramids climb and come back down', () => {
  const steps = [{ exerciseId: 'burpee', reps: 2 }, { exerciseId: 'plank-hold', durationSec: 20 }];
  const ladder = buildStructure('ladder', steps, { rounds: 4 });
  assert.deepEqual(ladder.rounds.map((r) => r.steps[0].reps), [2, 4, 6, 8]);
  assert.ok(ladder.rounds.every((r) => r.steps[1].durationSec === 20 && r.steps[1].reps === undefined));
  const pyramid = buildStructure('ladder', steps, { rounds: 3, pyramid: true });
  assert.deepEqual(pyramid.rounds.map((r) => r.steps[0].reps), [2, 4, 6, 4, 2]);
  assert.deepEqual(pyramid.rounds.map((r) => r.roundNumber), [1, 2, 3, 4, 5]);
  assert.deepEqual(validateStructure(pyramid, 'PEAK'), []);
  assert.ok(validateStructure(buildStructure('ladder', steps, { rounds: 1 }), 'X').length === 0, 'rungs are clamped to at least 2');
});

test('builder tabata and death by come out ready to race', () => {
  const tabata = buildStructure('tabata', [{ exerciseId: 'air-squat', reps: 10 }], {});
  assert.deepEqual({ ...tabata, rounds: undefined }, { format: 'tabata', intervalWorkSec: 20, intervalRestSec: 10, intervalRounds: 8, restBetweenRoundsSec: 60, rounds: undefined });
  assert.deepEqual(tabata.rounds[0].steps, [{ exerciseId: 'air-squat' }]);
  assert.deepEqual(validateStructure(tabata, 'T'), []);

  const death = buildStructure('death_by', [{ exerciseId: 'burpee', reps: 1 }], {});
  assert.equal(death.intervalRounds, 20);
  assert.equal(death.intervalWorkSec, 60);
  assert.deepEqual(validateStructure(death, 'D'), []);
  assert.deepEqual(validateStructure({ ...death, rounds: [{ roundNumber: 1, steps: [{ exerciseId: 'burpee', durationSec: 30 }] }] }, 'D'), ['Every movement needs a starting number of reps.']);
});
