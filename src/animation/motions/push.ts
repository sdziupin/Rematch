import type { Motion } from '../skeleton';
import { FLOOR, angleTo, animate, key, lineFrom, offset, onTop, reach, spanFrom, type Body, type Target } from '../poses';

/** Planted hand on the floor. */
const hand = (x: number, y = FLOOR): Target => ({ x, y });

/** Straight plank from a planted ankle at `angle`, hands on targets. */
function plankAt(ankle: { x: number; y: number }, angle: number, hands: { L: Target; R: Target }, head?: number, spread = 1.5): Body {
  const l = lineFrom(ankle, angle);
  return {
    x: l.x,
    y: l.y,
    pivot: l.pivot,
    torso: l.torso,
    head: head ?? l.torso - 4,
    armL: hands.L,
    armR: hands.R,
    legL: [l.legAngle + spread, l.legAngle + spread],
    legR: [l.legAngle, l.legAngle],
  };
}

// Standard push-up geometry: toes planted, straight line to the neck.
const ANKLE = { x: 20, y: 85.2 };
const UP = 109.5; // neck ~ y 66.5 with straight arms
const DOWN = 93.4; // chest a few units off the floor
const upNeck = lineFrom(ANKLE, UP).neck;
const HAND_X = upNeck.x - 3;

const pushUp: Motion = animate(
  'side',
  1900,
  [
    key(0, plankAt(ANKLE, UP, { L: hand(HAND_X + 1), R: hand(HAND_X) }, 104)),
    key(0.5, plankAt(ANKLE, DOWN, { L: hand(HAND_X + 1), R: hand(HAND_X) }, 92)),
  ],
  { thumbT: 0.5 },
);

const diamondHand = upNeck.x - 7.5;
const diamondPushUp: Motion = animate(
  'side',
  2000,
  [
    key(0, plankAt(ANKLE, UP - 1, { L: hand(diamondHand + 0.5), R: hand(diamondHand) }, 104)),
    key(0.5, plankAt(ANKLE, DOWN + 1, { L: hand(diamondHand + 0.5), R: hand(diamondHand) }, 93)),
  ],
  { thumbT: 0.5 },
);

// Knee push-up: the line pivots on the knees; shins raised behind.
const KNEE = { x: 28, y: FLOOR };
function kneePlank(angle: number, handX: number, head: number): Body {
  const l = lineFrom(KNEE, angle, 16);
  return {
    x: l.x,
    y: l.y,
    pivot: l.pivot,
    torso: l.torso,
    head,
    armL: hand(handX + 1),
    armR: hand(handX),
    legL: [l.legAngle + 1, -112],
    legR: [l.legAngle, -118],
    footL: -150,
    footR: -155,
  };
}
const kneeTop = lineFrom(KNEE, 124, 16).neck;
const kneePushUp: Motion = animate('side', 1800, [key(0, kneePlank(124, kneeTop.x - 3, 118)), key(0.5, kneePlank(101, kneeTop.x - 3, 95))], {
  thumbT: 0.5,
});

// Wall push-up: standing lean into a wall.
const WALL = 78;
const wallAnkle = { x: WALL - 40, y: FLOOR };
function wallLean(angle: number, head: number): Body {
  const l = lineFrom(wallAnkle, angle);
  const handWall: Target = { x: WALL - 2.5, y: 41 };
  return { x: l.x, y: l.y, pivot: l.pivot, torso: l.torso, head, armL: { ...handWall, x: handWall.x - 0.5 }, armR: handWall, legL: [l.legAngle + 1, l.legAngle + 1], legR: [l.legAngle, l.legAngle] };
}
const wallPushUp: Motion = animate('side', 1800, [key(0, wallLean(165, 168)), key(0.5, wallLean(148, 158))], {
  props: [{ kind: 'wall', x: WALL }],
  thumbT: 0.5,
});

// Decline push-up: toes on a bench.
const BENCH_H = 14;
const declineAnkle = { x: 24, y: onTop(BENCH_H) + 2.5 - 4.9 - 0.4 };
const declineTop = lineFrom(declineAnkle, 95).neck;
const declinePushUp: Motion = animate(
  'side',
  2000,
  [
    key(0, plankAt(declineAnkle, 95, { L: hand(declineTop.x - 2), R: hand(declineTop.x - 3) }, 92)),
    key(0.5, plankAt(declineAnkle, 80, { L: hand(declineTop.x - 2), R: hand(declineTop.x - 3) }, 82)),
  ],
  { props: [{ kind: 'bench', x: 8, width: 22, height: BENCH_H }], thumbT: 0.5 },
);

// Pike push-up: hips high (inverted V), head lowers toward the floor ahead of the hands.
const pikeAnkle = { x: 26, y: 86 };
const pikeHand = { x: 70, y: FLOOR };
function pikeTop(): Body {
  const [toHip] = reach(pikeAnkle, pikeHand, 31, 48, 1);
  const hip = offset(pikeAnkle, toHip, 31);
  const torso = angleTo(hip, pikeHand);
  return { x: hip.x, y: hip.y, pivot: pikeAnkle, torso, head: torso - 8, armL: { ...pikeHand, x: pikeHand.x + 1 }, armR: pikeHand, legL: [toHip + 181, toHip + 181], legR: [toHip + 180, toHip + 180], footL: 40, footR: 40 };
}
function pikeBottom(): Body {
  const s = spanFrom(pikeAnkle, { x: 66.5, y: 78.5 });
  return { x: s.x, y: s.y, pivot: s.pivot, torso: s.torso, head: 52, armL: { ...pikeHand, x: pikeHand.x + 1 }, armR: pikeHand, legL: [s.legAngle + 1, s.legAngle + 1], legR: [s.legAngle, s.legAngle], footL: 40, footR: 40 };
}
const pikePushUp: Motion = animate('side', 2000, [key(0, pikeTop()), key(0.5, pikeBottom())], { thumbT: 0.5 });

// Archer push-up (side view): one arm bends while the other reaches long and straight; alternate.
const archerTopL = hand(HAND_X + 1);
const archerTopR = hand(HAND_X);
const downNeck = lineFrom(ANKLE, DOWN + 3).neck;
const archerReach = hand(downNeck.x + 20.5);
const archerPushUp: Motion = animate(
  'side',
  3600,
  [
    key(0, plankAt(ANKLE, UP, { L: archerTopL, R: archerTopR }, 104)),
    key(0.25, plankAt(ANKLE, DOWN + 3, { L: archerReach, R: archerTopR }, 94)),
    key(0.5, plankAt(ANKLE, UP, { L: archerTopL, R: archerTopR }, 104)),
    key(0.75, plankAt(ANKLE, DOWN + 3, { L: archerTopL, R: { ...archerReach, x: archerReach.x - 1 } }, 94)),
  ],
  { thumbT: 0.25 },
);

// Hindu push-up: down dog -> dive low between the hands -> up dog -> push back. Legs stay straight.
const hinduHand = { x: 76, y: FLOOR };
const hinduAnkle = { x: 24, y: FLOOR };
const hinduArms = { armL: { ...hinduHand, x: hinduHand.x + 1 }, armR: hinduHand };
function downDog(head?: number): Body {
  const [toHip] = reach(hinduAnkle, hinduHand, 31, 48, 1);
  const hip = offset(hinduAnkle, toHip, 31);
  const torso = angleTo(hip, hinduHand);
  const legs: [number, number] = [toHip + 180, toHip + 180];
  return { x: hip.x, y: hip.y, pivot: hinduAnkle, torso, head: head ?? torso, ...hinduArms, legL: [legs[0] + 1, legs[1] + 1], legR: legs, footL: 90, footR: 90 };
}
function hinduSpan(neck: { x: number; y: number }, bend: 1 | -1, extra: Partial<Body>): Body {
  const s = spanFrom(hinduAnkle, neck, 31, bend);
  return { x: s.x, y: s.y, pivot: s.pivot, torso: s.torso, ...hinduArms, legL: [s.legAngle + 1, s.legAngle + 1], legR: [s.legAngle, s.legAngle], ...extra };
}
const dive = hinduSpan({ x: hinduHand.x - 5, y: 80.5 }, 1, { head: 84, spine: -8, footL: 40, footR: 40 });
const upDog = hinduSpan({ x: hinduHand.x - 2.5, y: 67 }, -1, { head: 150, spine: -34, footL: -95, footR: -95 });
const hinduPushUp: Motion = animate('side', 2800, [key(0, downDog()), key(0.3, dive), key(0.55, upDog), key(0.72, upDog)], { thumbT: 0.3 });

export const PUSH_MOTIONS: Record<string, Motion> = {
  'push-up': pushUp,
  'diamond-push-up': diamondPushUp,
  'knee-push-up': kneePushUp,
  'wall-push-up': wallPushUp,
  'decline-push-up': declinePushUp,
  'pike-push-up': pikePushUp,
  'archer-push-up': archerPushUp,
  'hindu-push-up': hinduPushUp,
};

/** Shared plank geometry for other files (burpees, planks, crawls). */
export const PLANK = { ankle: ANKLE, up: UP, down: DOWN, handX: HAND_X, plankAt, hand, downDog: (h?: number) => downDog(h) };
