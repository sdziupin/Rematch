import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimerSnapshot, getElapsedActiveMs, pauseTimer, resumeTimer, startTimer } from '../domain/timer';
import { compareCheckpoints } from '../domain/rematch';
import { areCompatible, formatCountdown, formatDuration } from '../domain/utils';
import { nextStep, createActiveState } from '../engine/workoutEngine';
import { recommendWorkout } from '../services/recommendationService';
import { WORKOUT_SEEDS } from '../content/seed';
import { createId } from './id';
import { dayStreak, heatmap, muscleLoad, startOfWeek, weeklyCounts, weeklyGoalStreak } from './stats';
import { programProgress } from './programs';
import type { WorkoutStructure } from '../domain/types';
import type { ProgramSeed } from '../content/types';

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

test('recommendations respect equipment, pain and recent history', () => {
  const base = { minutes: 15, level: 'elite', goal: 'conditioning', recentWorkoutIds: [], painRecent: false, daySeed: 1 };
  for (let seed = 0; seed < 6; seed++) {
    const rec = recommendWorkout({ ...base, equipment: ['bodyweight'], daySeed: seed });
    const w = WORKOUT_SEEDS.find((x) => x.id === rec.workoutId)!;
    assert.ok(w.equipment.every((e) => e === 'bodyweight' || e === 'mat'), `${w.id} needs ${w.equipment}`);
    assert.notEqual(w.kind ?? 'benchmark', 'warmup');
  }
  const pain = recommendWorkout({ ...base, equipment: ['bodyweight', 'mat'], painRecent: true });
  const pw = WORKOUT_SEEDS.find((x) => x.id === pain.workoutId)!;
  assert.ok(['low_impact', 'core', 'mobility'].includes(pw.focus));
  const first = recommendWorkout({ ...base, equipment: ['bodyweight', 'mat'] });
  const again = recommendWorkout({ ...base, equipment: ['bodyweight', 'mat'], recentWorkoutIds: [first.workoutId] });
  assert.notEqual(again.workoutId, first.workoutId);
});

test('ids are unique without crypto', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => createId()));
  assert.equal(ids.size, 2000);
});

test('formatting', () => {
  assert.equal(formatDuration(65_000), '1:05');
  assert.equal(formatDuration(3_725_000), '1:02:05');
  assert.equal(formatCountdown(2_100), '3');
  assert.equal(formatCountdown(0), '0');
});

test('weekly stats, streaks and heatmap', () => {
  const now = new Date(2026, 9, 9, 18, 0).getTime(); // Friday
  const day = (offset: number) => new Date(2026, 9, 9 + offset, 9, 0).getTime();
  const sessions = [day(0), day(-1), day(-2), day(-7), day(-8), day(-9), day(-14), day(-15), day(-30)];
  const weeks = weeklyCounts(sessions, 4, now, 1);
  assert.equal(weeks.length, 4);
  assert.equal(weeks[3].count, 3);
  assert.equal(weeklyGoalStreak(sessions, 2, now, 1), 3);
  assert.equal(weeklyGoalStreak(sessions, 3, now, 1), 2);
  assert.equal(dayStreak(sessions, now), 3);
  assert.equal(dayStreak([day(-1), day(-2)], now), 2, 'today still open');
  const grid = heatmap(sessions, 6, now, 1);
  assert.equal(grid.length, 6);
  assert.ok(grid.every((col) => col.length === 7));
  assert.equal(grid[5].find((c) => c.day === new Date(2026, 9, 9).getTime())?.count, 1);
  assert.equal(new Date(startOfWeek(now, 1)).getDay(), 1);
  assert.equal(new Date(startOfWeek(now, 0)).getDay(), 0);
});

test('muscle load credits primary fully and secondary by half', () => {
  const load = muscleLoad(
    [{ exerciseId: 'push-up', reps: 20, seconds: 0 }],
    new Map([['push-up', { primary: ['chest'], secondary: ['triceps'] }]]),
  );
  assert.equal(load.chest, 1);
  assert.equal(load.triceps, 0.5);
});

test('program progress finds the next session in order', () => {
  const program = {
    id: 'p',
    sessions: [
      { week: 2, day: 1, workoutId: 'c' },
      { week: 1, day: 2, workoutId: 'b' },
      { week: 1, day: 1, workoutId: 'a' },
    ],
  } as unknown as ProgramSeed;
  const p = programProgress(program, new Set(['w1d1']));
  assert.equal(p.next?.workoutId, 'b');
  assert.equal(p.done, 1);
  assert.equal(p.weeks.length, 2);
  assert.equal(programProgress(program, new Set(['w1d1', 'w1d2', 'w2d1'])).complete, true);
});
