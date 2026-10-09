import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkpointOrder,
  compareCheckpoints,
  compareScores,
  getLiveDelta,
  getOpponentProgress,
  getPaceRace,
  getVolumeRace,
  isBetterScore,
  isPbEligible,
  opponentRepsAt,
} from './rematch';
import type { ScoreLike } from './types';

const cp = (checkpointKey: string, elapsedActiveMs: number, reps?: number) => ({ checkpointKey, label: checkpointKey, elapsedActiveMs, reps });

test('checkpoint keys sort by workout position, not alphabetically', () => {
  const keys = ['round-10', 'r2-e1', 'round-2', 'r10-e1', 'r1-e2', 'round-1'];
  keys.sort((a, b) => checkpointOrder(a) - checkpointOrder(b));
  assert.deepEqual(keys, ['r1-e2', 'round-1', 'r2-e1', 'round-2', 'r10-e1', 'round-10']);
});

test('pace race: delta at the last shared checkpoint', () => {
  const opp = [cp('r1-e1', 30_000), cp('r1-e2', 70_000)];
  const you = [cp('r1-e1', 25_000)];
  const race = getPaceRace(40_000, you, opp, 'r1-e2');
  assert.equal(race.delta, -5_000);
  assert.equal(race.status, 'ahead');
});

test('pace race: falls behind once past-you reaches your next checkpoint first', () => {
  const opp = [cp('r1-e1', 30_000), cp('r1-e2', 70_000)];
  const you = [cp('r1-e1', 25_000)];
  const race = getPaceRace(78_000, you, opp, 'r1-e2');
  assert.equal(race.delta, 8_000);
  assert.equal(race.status, 'behind');
});

test('pace race: nothing to compare before the first checkpoint', () => {
  assert.equal(getPaceRace(5_000, [], [cp('r1-e1', 30_000)], 'r1-e1').status, 'none');
  assert.equal(getPaceRace(35_000, [], [cp('r1-e1', 30_000)], 'r1-e1').delta, 5_000);
});

test('legacy live delta no longer compares mismatched key formats as strings', () => {
  const opp = [cp('round-1', 60_000), cp('round-2', 130_000)];
  assert.equal(getLiveDelta(140_000, opp, 'r3-e1'), 10_000);
  assert.equal(getLiveDelta(50_000, opp, 'r1-e1'), null);
});

test('volume race compares banked reps at the same checkpoint', () => {
  const opp = [cp('round-1', 60_000, 12), cp('round-2', 120_000, 25)];
  const you = [cp('round-1', 60_000, 15), cp('round-2', 120_000, 24)];
  const race = getVolumeRace(you, opp);
  assert.equal(race.unit, 'reps');
  assert.equal(race.delta, -1);
  assert.equal(race.status, 'behind');
  assert.equal(opponentRepsAt(opp, 90_000), 12);
});

test('final comparison uses round splits, or movement splits for one-round chippers', () => {
  const rounds = compareCheckpoints(
    [cp('r1-e1', 10), cp('round-1', 20), cp('round-2', 40)],
    [cp('r1-e1', 12), cp('round-1', 25), cp('round-2', 45)],
    40,
    45,
  );
  assert.deepEqual(rounds.checkpoints.map((c) => c.checkpointKey), ['round-1', 'round-2']);
  const chipper = compareCheckpoints(
    [cp('r1-e1', 10), cp('r1-e2', 30), cp('round-1', 30)],
    [cp('r1-e1', 12), cp('r1-e2', 28), cp('round-1', 28)],
    30,
    28,
  );
  assert.deepEqual(chipper.checkpoints.map((c) => c.checkpointKey), ['r1-e1', 'r1-e2']);
  assert.equal(chipper.won, false);
});

test('reps-scored comparisons are won on reps, not time', () => {
  const r = compareCheckpoints([], [], 600_000, 600_000, { scoreType: 'reps', yourReps: 120, opponentReps: 110 });
  assert.equal(r.won, true);
  assert.equal(r.tied, false);
});

test('PB eligibility and ordering', () => {
  const time = (ms: number, extra: Partial<ScoreLike> = {}): ScoreLike => ({ completionMs: ms, scoreType: 'time', scoreReps: null, isComplete: true, isAbandoned: false, ...extra });
  const reps = (n: number): ScoreLike => ({ completionMs: 600_000, scoreType: 'reps', scoreReps: n, isComplete: true, isAbandoned: false });
  assert.equal(isPbEligible(time(1000, { timeCapped: true })), false);
  assert.equal(isPbEligible(time(1000, { isAbandoned: true })), false);
  assert.equal(isPbEligible(reps(0)), false);
  assert.ok(compareScores(time(100), time(200)) > 0);
  assert.ok(compareScores(reps(30), reps(20)) > 0);
  assert.equal(isBetterScore(time(100), null), true);
  assert.equal(isBetterScore(time(100), time(100)), false);
  assert.equal(isBetterScore(reps(31), reps(30)), true);
});

test('opponent progress prefers movement checkpoints, falls back to rounds', () => {
  const steps = [cp('r1-e1', 10), cp('r1-e2', 20), cp('round-1', 20), cp('r2-e1', 30)];
  assert.equal(getOpponentProgress(steps, 40, 25, 4, 2), 0.5);
  const legacy = [cp('round-1', 60), cp('round-2', 120)];
  assert.equal(getOpponentProgress(legacy, 120, 61, 6, 2), 0.5);
});
