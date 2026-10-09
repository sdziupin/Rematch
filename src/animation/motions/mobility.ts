import type { Motion, Prop } from '../skeleton';
import { FLOOR, SEAT, STAND_Y, animate, holdBody, key, loop, type Body, type Target } from '../poses';
import { CORE_SHAPES } from './core';
import { LEG_SHAPES } from './legs';
import { PLANK } from './push';

const MAT: Prop[] = [{ kind: 'mat' }];
const { ankle, toe } = LEG_SHAPES;

const catCow = animate(
  'side',
  4400,
  [
    key(0, CORE_SHAPES.quad({ spine: 44, head: 30 })),
    key(0.12, CORE_SHAPES.quad({ spine: 44, head: 30 })),
    key(0.5, CORE_SHAPES.quad({ spine: -40, head: 150 })),
    key(0.62, CORE_SHAPES.quad({ spine: -40, head: 150 })),
  ],
  { props: MAT, thumbT: 0.06 },
);

const downwardDog = holdBody('side', PLANK.downDog(), { ...PLANK.downDog(), head: PLANK.downDog().torso - 10, footL: 80, footR: 80 }, { props: MAT });

// Child's pose: hips on heels, rounded back, forehead and arms on the floor.
const childBody = (breath: number): Body => ({
  x: 37,
  y: 80 - breath * 0.6,
  torso: 84,
  head: 75,
  spine: 26 + breath * 6,
  armL: [74, 74],
  armR: [73, 73],
  legL: [54, -90],
  legR: [53, -90],
  footL: -90,
  footR: -90,
});
const childPose = holdBody('side', childBody(0), childBody(1), { props: MAT, durationMs: 4400 });

// Cobra: from prone, press the chest up with the hips on the floor.
const COBRA_HIP = { x: 40, y: SEAT };
const cobraHands = { armL: { x: 63.5, y: FLOOR } as Target, armR: { x: 63, y: FLOOR } as Target };
const prone: Body = { ...COBRA_HIP, torso: 90, head: 96, ...cobraHands, legL: [-90, -90], legR: [-89, -89], footL: -88, footR: -88 };
const cobra: Body = { ...COBRA_HIP, torso: 124, head: 150, spine: -38, ...cobraHands, legL: [-90, -90], legR: [-89, -89], footL: -88, footR: -88 };
const cobraStretch = animate('side', 4400, [key(0, prone), key(0.38, cobra), key(0.68, cobra)], { props: MAT, thumbT: 0.5 });

// Half-kneeling hip flexor stretch: near knee down, hips drift forward, arm reaches up.
const hipFlexor = (push: number): Body => ({
  x: 50 + push,
  y: 74.5,
  torso: 180 - push * 1.2,
  head: 180 - push,
  armL: { x: 64, y: 73 },
  armR: [178 - push * 2, 184 - push * 2],
  legL: ankle(67),
  legR: [-20 - push * 3, -90],
  footR: -90,
});
const hipFlexorStretch = holdBody('side', hipFlexor(0), hipFlexor(2), { props: MAT, durationMs: 4400 });

// World's greatest stretch: deep lunge with hands down, near elbow drops to the instep,
// then the near arm rotates up to the ceiling.
const wgsBody = (phase: 'down' | 'elbow' | 'reach'): Body => ({
  x: 44,
  y: phase === 'elbow' ? 77.5 : 76,
  torso: phase === 'elbow' ? 99 : 106,
  head: phase === 'reach' ? 150 : phase === 'elbow' ? 96 : 104,
  armL: { x: 63.5, y: FLOOR },
  armR: phase === 'reach' ? [178, 180] : phase === 'elbow' ? [-22, 62] : { x: 62.5, y: FLOOR },
  legR: ankle(62),
  legL: toe(19, 30),
});
const worldsGreatest = animate(
  'side',
  5600,
  [key(0, wgsBody('down')), key(0.18, wgsBody('elbow')), key(0.3, wgsBody('elbow')), key(0.5, wgsBody('reach')), key(0.68, wgsBody('reach')), key(0.86, wgsBody('down'))],
  { props: MAT, thumbT: 0.58 },
);

// Arm circles (front view): straight arms out at shoulder height, wrists tracing small circles.
const circle = (deg: number): Body => {
  const up = 13 * Math.sin((deg * Math.PI) / 180);
  const wrist = 7 * Math.cos((deg * Math.PI) / 180);
  return {
    x: 50,
    torso: 180,
    head: 180,
    armL: [-(90 + up), -(96 + up + wrist)],
    armR: [90 + up, 96 + up + wrist],
    legL: [-3, -3],
    legR: [3, 3],
  };
};
const armCircles = loop('front', 1400, [0, 45, 90, 135, 180, 225, 270, 315].map(circle), { ease: 'linear', thumbT: 0.25 });

// Leg swings: balance on the far leg, near leg swings like a pendulum.
const legSwing = (fwd: boolean): Body => ({
  x: 50,
  y: STAND_Y,
  torso: fwd ? 184 : 176,
  head: 180,
  armL: [82, 90],
  armR: fwd ? [-30, -10] : [35, 55],
  legL: ankle(50),
  legR: fwd ? [72, 72] : [-38, -38],
  footR: fwd ? 140 : 40,
});
const legSwings = animate('side', 1500, [key(0, legSwing(true)), key(0.5, legSwing(false))], { thumbT: 0 });

// Open book (front view of a side-lying body, head to the right): the top arm sweeps
// from resting on the bottom arm, up and over to the floor behind, the head following.
const book = (open: number): Body => ({
  x: 45,
  y: 83.5,
  torso: 90,
  head: 90 + open * 70,
  spine: -open * 8,
  armR: [90, 90],
  armL: [100 + open * 135, 100 + open * 138],
  legL: [-86, -92],
  legR: [-89, -90],
});
const openBook = animate('front', 4800, [key(0, book(0)), key(0.4, book(1)), key(0.6, book(1)), key(0.95, book(0))], { props: MAT, thumbT: 0.5 });

export const MOBILITY_MOTIONS: Record<string, Motion> = {
  'cat-cow': catCow,
  'downward-dog': downwardDog,
  'child-pose': childPose,
  'cobra-stretch': cobraStretch,
  'hip-flexor-stretch': hipFlexorStretch,
  'worlds-greatest-stretch': worldsGreatest,
  'arm-circles': armCircles,
  'leg-swings': legSwings,
  'open-book': openBook,
};
