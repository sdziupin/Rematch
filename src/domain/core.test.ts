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
