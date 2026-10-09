import type { Motion } from './skeleton';
import { CORE_MOTIONS } from './motions/core';
import { LEG_MOTIONS } from './motions/legs';
import { PUSH_MOTIONS } from './motions/push';
import { FOREARM_PLANK, HALF_SQUAT, HANG, PLANK_HIGH, PLANK_LOW, SQUAT_BOTTOM, STAND, STAND_FRONT, SUPINE, cycle, hold, pose } from './poses';

/**
 * Exercise id -> motion. Every exercise in the content seed must resolve to a
 * motion (directly or through `CATEGORY_FALLBACK`); a test enforces it.
 */
export const MOTIONS: Record<string, Motion> = {
  'air-squat': cycle('side', 2000, [STAND, pose(SQUAT_BOTTOM, {})], { thumbT: 0.5 }),

  'push-up': cycle('side', 1800, [PLANK_HIGH, PLANK_LOW], { thumbT: 0.5 }),

  'plank-hold': hold('side', FOREARM_PLANK, { torso: 97 }),

  'jumping-jack': cycle(
    'front',
    900,
    [
      STAND_FRONT,
      pose(STAND_FRONT, { lift: 4, armL: [-120, -150], armR: [120, 150], legL: [-14, -12], legR: [14, 12] }),
      pose(STAND_FRONT, { armL: [-160, -175], armR: [160, 175], legL: [-16, -14], legR: [16, 14] }),
      pose(STAND_FRONT, { lift: 4, armL: [-120, -150], armR: [120, 150], legL: [-14, -12], legR: [14, 12] }),
    ],
    { thumbT: 0.5 },
  ),

  'sit-up': cycle('side', 2200, [
    pose(SUPINE, { armL: [-160, -170], armR: [-155, -165], legL: [-60, -125], legR: [-58, -122] }),
    pose(SUPINE, { torso: 150, head: 160, armL: [80, 95], armR: [85, 100], legL: [-60, -125], legR: [-58, -122] }),
  ]),

  'reverse-lunge': cycle('side', 2200, [
    STAND,
    pose(STAND, { torso: 178, armL: [10, 20], armR: [-10, 0], legL: [-30, 0], legR: [70, 0] }),
  ]),

  'mountain-climber': cycle('side', 700, [
    pose(PLANK_HIGH, { legL: [-80, -80], legR: [25, -65] }),
    pose(PLANK_HIGH, { legL: [25, -65], legR: [-80, -80] }),
  ]),

  burpee: cycle(
    'side',
    2600,
    [
      STAND,
      pose(SQUAT_BOTTOM, { torso: 120, armL: [10, 10], armR: [5, 5] }),
      PLANK_HIGH,
      PLANK_LOW,
      pose(SQUAT_BOTTOM, { torso: 120, armL: [10, 10], armR: [5, 5] }),
      pose(STAND, { lift: 8, armL: [175, 178], armR: [172, 176] }),
    ],
    { thumbT: 0.42 },
  ),

  'pull-up': cycle(
    'side',
    2400,
    [
      pose(HANG, { anchorY: 14 }),
      pose(HANG, { anchorY: 14, armL: [-150, 160], armR: [-145, 162], legL: [10, -10], legR: [5, -12] }),
    ],
    { props: [{ kind: 'bar', y: 12 }], thumbT: 0.5 },
  ),

  'jump-rope': cycle(
    'front',
    700,
    [
      pose(STAND_FRONT, { armL: [-14, -75], armR: [14, 75], legL: [-3, -1], legR: [3, 1] }),
      pose(STAND_FRONT, { lift: 5, armL: [-14, -75], armR: [14, 75], legL: [-3, 2], legR: [3, -2] }),
    ],
    { props: [{ kind: 'rope' }], thumbT: 0.5 },
  ),

  'half-squat': cycle('side', 1600, [STAND, HALF_SQUAT]),
  ...PUSH_MOTIONS,
  ...LEG_MOTIONS,
  ...CORE_MOTIONS,
};

/** Used when an exercise has no dedicated motion yet. */
export const CATEGORY_FALLBACK: Record<string, string> = {
  push: 'push-up',
  squat: 'air-squat',
  lunge: 'reverse-lunge',
  core: 'plank-hold',
  hinge: 'air-squat',
  cardio: 'jumping-jack',
  conditioning: 'burpee',
  pull: 'pull-up',
  accessory: 'air-squat',
  recovery: 'plank-hold',
  mobility: 'plank-hold',
};

export function getMotion(exerciseId: string, category?: string): Motion {
  return MOTIONS[exerciseId] ?? MOTIONS[CATEGORY_FALLBACK[category ?? ''] ?? 'air-squat'] ?? MOTIONS['air-squat'];
}

export function hasDedicatedMotion(exerciseId: string): boolean {
  return exerciseId in MOTIONS;
}
