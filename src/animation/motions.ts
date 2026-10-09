import type { Motion } from './skeleton';
import { CARDIO_MOTIONS } from './motions/cardio';
import { CORE_MOTIONS } from './motions/core';
import { LEG_MOTIONS } from './motions/legs';
import { MOBILITY_MOTIONS } from './motions/mobility';
import { PULL_MOTIONS } from './motions/pull';
import { PUSH_MOTIONS } from './motions/push';
import { WEIGHT_MOTIONS } from './motions/weights';

/**
 * Exercise id -> motion. Every exercise in the content seed resolves to a dedicated motion;
 * `CATEGORY_FALLBACK` covers ids added later until they get their own.
 * Motions are authored in ./motions/* with the world-space kit in ./poses.
 */
export const MOTIONS: Record<string, Motion> = {
  ...PUSH_MOTIONS,
  ...LEG_MOTIONS,
  ...CORE_MOTIONS,
  ...CARDIO_MOTIONS,
  ...PULL_MOTIONS,
  ...WEIGHT_MOTIONS,
  ...MOBILITY_MOTIONS,
};

/** Used when an exercise has no dedicated motion yet. */
export const CATEGORY_FALLBACK: Record<string, string> = {
  push: 'push-up',
  squat: 'air-squat',
  lunge: 'reverse-lunge',
  core: 'plank-hold',
  hinge: 'single-leg-deadlift',
  cardio: 'jumping-jack',
  conditioning: 'burpee',
  pull: 'pull-up',
  accessory: 'air-squat',
  recovery: 'child-pose',
  mobility: 'cat-cow',
};

export function getMotion(exerciseId: string, category?: string): Motion {
  return MOTIONS[exerciseId] ?? MOTIONS[CATEGORY_FALLBACK[category ?? ''] ?? 'air-squat'] ?? MOTIONS['air-squat'];
}

export function hasDedicatedMotion(exerciseId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MOTIONS, exerciseId);
}
