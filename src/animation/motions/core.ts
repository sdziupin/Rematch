import type { Motion, Prop } from '../skeleton';
import { FLOOR, SEAT, animate, armRel, holdBody, key, lineFrom, loop, type Body, type Target } from '../poses';
import { PLANK } from './push';

const MAT: Prop[] = [{ kind: 'mat' }];
const ankle = (x: number, y = FLOOR): Target => ({ x, y });

// --- Supine (head to the left) ------------------------------------------------

const HIP = { x: 56, y: SEAT };
/** Lying on the back; torso -90 is flat with the head to the left. */
const supine = (extra: Partial<Body>): Body => ({
  x: HIP.x,
  y: HIP.y,
  torso: -90,
  head: -104,
  armL: [92, 92],
  armR: [90, 90],
  legL: ankle(HIP.x + 20),
  legR: ankle(HIP.x + 19),
  ...extra,
});

const sitUp = animate(
  'side',
  2400,
  [
    key(0, supine({ armL: [91, 91], armR: [90, 90] })),
    key(0.25, supine({ torso: -128, head: -146, spine: 26, armL: armRel(-128, 60), armR: armRel(-128, 58) })),
    key(0.5, supine({ torso: 166, head: 160, spine: 12, armL: armRel(166, 84), armR: armRel(166, 82) })),
    key(0.62, supine({ torso: 166, head: 160, spine: 12, armL: armRel(166, 84), armR: armRel(166, 82) })),
  ],
  { props: MAT, thumbT: 0.5 },
);

// Hands behind the head, elbows pointing at the knees.
const crunchArms = (torso: number, near: number) => ({ armL: armRel(torso, 70 - near, 160), armR: armRel(torso, 70 + near, 160) });
const kneeIn: [number, number] = [158, 72];
const legOut: [number, number] = [101, 101];
const bicycleCrunch = loop(
  'side',
  1600,
  [
    { x: HIP.x, torso: -114, head: -130, spine: 18, ...crunchArms(-114, 12), legL: legOut, legR: kneeIn, footL: 100, footR: 100 },
    { x: HIP.x, torso: -114, head: -130, spine: 18, ...crunchArms(-114, -12), legL: kneeIn, legR: legOut, footL: 100, footR: 100 },
  ],
  { props: MAT, thumbT: 0 },
);

const armsOnFloor = { armL: [91, 91] as [number, number], armR: [90, 90] as [number, number] };
const legRaise = animate(
  'side',
  2400,
  [
    key(0, supine({ ...armsOnFloor, legL: [97, 97], legR: [96, 96], footL: 100, footR: 100 })),
    key(0.45, supine({ ...armsOnFloor, legL: [176, 176], legR: [175, 175], footL: 180, footR: 180 })),
    key(0.55, supine({ ...armsOnFloor, legL: [176, 176], legR: [175, 175], footL: 180, footR: 180 })),
  ],
  { props: MAT, thumbT: 0.5 },
);

const vUp = animate(
  'side',
  1900,
  [
    key(0, { x: HIP.x, torso: -90, head: -100, armL: [-94, -94], armR: [-92, -92], legL: [93, 93], legR: [92, 92], footL: 96, footR: 96 }),
    key(0.45, { x: HIP.x, torso: -157, head: -150, spine: 14, armL: [100, 100], armR: [98, 98], legL: [148, 148], legR: [147, 147], footL: 155, footR: 155 }),
    key(0.55, { x: HIP.x, torso: -157, head: -150, spine: 14, armL: [100, 100], armR: [98, 98], legL: [148, 148], legR: [147, 147], footL: 155, footR: 155 }),
  ],
  { props: MAT, thumbT: 0.5 },
);

/** Hollow body, rotated by `rock` (positive rocks back onto the shoulders). */
const hollow = (rock = 0, lift = 0): Body => ({
  x: HIP.x,
  torso: -101 + rock - lift,
  head: -118 + rock - lift,
  spine: 20,
  armL: [-97 + rock - lift, -97 + rock - lift],
  armR: [-95 + rock - lift, -95 + rock - lift],
  legL: [101 + rock + lift, 101 + rock + lift],
  legR: [100 + rock + lift, 100 + rock + lift],
  footL: 104 + rock + lift,
  footR: 103 + rock + lift,
});
const hollowHold = holdBody('side', hollow(), hollow(0, 2.5), { props: MAT });
const hollowRock = loop('side', 1300, [hollow(10), hollow(-10)], { props: MAT, thumbT: 0.25 });

const flutterKick = loop(
  'side',
  900,
  [
    { x: HIP.x, torso: -99, head: -116, spine: 10, armL: [94, 94], armR: [93, 93], legL: [101, 101], legR: [113, 113], footL: 104, footR: 116 },
    { x: HIP.x, torso: -99, head: -116, spine: 10, armL: [94, 94], armR: [93, 93], legL: [113, 113], legR: [101, 101], footL: 116, footR: 104 },
  ],
  { props: MAT, thumbT: 0 },
);

const tabletop = { legL: [178, 92] as [number, number], legR: [177, 90] as [number, number], footL: 92, footR: 90 };
const deadBugBase: Body = { x: HIP.x, y: SEAT, torso: -90, head: -104, armL: [178, 178], armR: [176, 176], ...tabletop };
const deadBug = animate(
  'side',
  3400,
  [
    key(0, deadBugBase),
    key(0.25, { ...deadBugBase, armR: [-100, -100], legL: [98, 98], footL: 100 }),
    key(0.5, deadBugBase),
    key(0.75, { ...deadBugBase, armL: [-100, -100], legR: [98, 98], footR: 100 }),
  ],
  { props: MAT, thumbT: 0.25 },
);

// --- Prone ----------------------------------------------------------------------

const superman = (lift: number): Body => ({
  x: 50,
  torso: 96 + lift,
  head: 108 + lift,
  spine: -22 - lift,
  armL: [106 + lift, 106 + lift],
  armR: [104 + lift, 104 + lift],
  legL: [-97 - lift, -97 - lift],
  legR: [-96 - lift, -96 - lift],
  footL: -92,
  footR: -92,
});
const supermanHold = holdBody('side', superman(0), superman(3), { props: MAT });

// --- Quadruped ------------------------------------------------------------------

const QUAD_HIP = { x: 40, y: FLOOR - 16 };
const quad = (extra: Partial<Body> = {}): Body => ({
  x: QUAD_HIP.x,
  y: QUAD_HIP.y,
  torso: 106.3,
  head: 100,
  armL: [1, 1],
  armR: [0, 0],
  legL: [1, -90],
  legR: [0, -90],
  footL: -90,
  footR: -90,
  ...extra,
});
const birdDog = animate(
  'side',
  3600,
  [
    key(0, quad()),
    key(0.2, quad({ armR: [94, 94], legL: [-80, -80], footL: -75, head: 98 })),
    key(0.32, quad({ armR: [94, 94], legL: [-80, -80], footL: -75, head: 98 })),
    key(0.5, quad()),
    key(0.7, quad({ armL: [94, 94], legR: [-80, -80], footR: -75, head: 98 })),
    key(0.82, quad({ armL: [94, 94], legR: [-80, -80], footR: -75, head: 98 })),
  ],
  { props: MAT, thumbT: 0.26 },
);

// --- Planks -----------------------------------------------------------------------

const A = PLANK.ankle;
const forearmPlank = (angle: number, head: number): Body => {
  const l = lineFrom(A, angle);
  return {
    x: l.x,
    y: l.y,
    pivot: l.pivot,
    torso: l.torso,
    head,
    armL: { x: l.neck.x + 11.5, y: FLOOR },
    armR: { x: l.neck.x + 11, y: FLOOR },
    legL: [l.legAngle + 1.5, l.legAngle + 1.5],
    legR: [l.legAngle, l.legAngle],
  };
};
const FOREARM_ANGLE = 97.9;
const plankHold = holdBody('side', forearmPlank(FOREARM_ANGLE, 96), forearmPlank(FOREARM_ANGLE + 0.6, 100));

const highHands = lineFrom(A, PLANK.up).neck.x;
const highPlank = (extra: Partial<Body> = {}, spread = 1.5): Body => ({
  ...PLANK.plankAt(A, PLANK.up, { L: PLANK.hand(highHands + 0.5), R: PLANK.hand(highHands - 0.5) }, 102, spread),
  ...extra,
});

const shoulderTap = animate(
  'side',
  1800,
  [
    key(0, highPlank()),
    key(0.22, highPlank({ armR: { x: highHands - 1, y: 69 } })),
    key(0.5, highPlank()),
    key(0.72, highPlank({ armL: { x: highHands - 1, y: 69 } })),
  ],
  { thumbT: 0.22 },
);

const jackLegs = (lift: number, spread: number): Partial<Body> => ({
  pivot: undefined,
  legL: [mcLeg() - lift - spread, mcLeg() - lift - spread],
  legR: [mcLeg() - lift, mcLeg() - lift],
});
function mcLeg() {
  return lineFrom(A, PLANK.up).legAngle;
}
const plankJack = loop('side', 900, [highPlank(jackLegs(0, 1.5)), highPlank({ ...jackLegs(4, 6), y: lineFrom(A, PLANK.up).y - 1.5 }), highPlank(jackLegs(0, 12)), highPlank({ ...jackLegs(4, 6), y: lineFrom(A, PLANK.up).y - 1.5 })], { thumbT: 0.5 });

const fp = forearmPlank(FOREARM_ANGLE, 96);
const midLine = lineFrom(A, 104);
const halfUp = (handArm: 'L' | 'R'): Body => {
  const fore: Target = { x: lineFrom(A, FOREARM_ANGLE).neck.x + 11, y: FLOOR };
  const palm: Target = { x: highHands, y: FLOOR };
  return {
    x: midLine.x,
    y: midLine.y,
    pivot: midLine.pivot,
    torso: midLine.torso,
    head: 100,
    armL: handArm === 'L' ? palm : { ...fore, x: fore.x + 0.5 },
    armR: handArm === 'R' ? palm : fore,
    legL: [midLine.legAngle + 1.5, midLine.legAngle + 1.5],
    legR: [midLine.legAngle, midLine.legAngle],
  };
};
const plankToPushUp = animate(
  'side',
  3000,
  [key(0, fp), key(0.17, halfUp('R')), key(0.34, highPlank()), key(0.5, highPlank()), key(0.67, halfUp('L')), key(0.84, fp)],
  { thumbT: 0.17 },
);

const mcHip = lineFrom(A, PLANK.up);
const climber = (front: 'L' | 'R'): Body => ({
  ...highPlank(),
  pivot: undefined,
  x: mcHip.x,
  y: mcHip.y,
  legL: front === 'L' ? [62, -72] : [mcHip.legAngle + 1, mcHip.legAngle + 1],
  legR: front === 'R' ? [62, -72] : [mcHip.legAngle, mcHip.legAngle],
  footL: front === 'L' ? 20 : undefined,
  footR: front === 'R' ? 20 : undefined,
});
const mountainClimber = loop('side', 760, [climber('R'), climber('L')], { thumbT: 0 });

// Side plank (front view, lying on the near-floor R side): forearm down, top arm up.
const SIDE_T = 105;
const sidePlankBody = (dip: number): Body => ({
  x: 48,
  y: 78.1 + dip,
  torso: SIDE_T - dip * 0.6,
  head: SIDE_T - 8,
  armR: [0, 90],
  armL: [176, 178],
  legR: [-75 - dip * 0.6, -75 - dip * 0.6],
  legL: [-72.5 - dip * 0.6, -72.5 - dip * 0.6],
});
const sidePlank = holdBody('front', sidePlankBody(0), sidePlankBody(1.2), { props: MAT });

// Reverse plank: face up, hands under shoulders, heels down, straight line.
const RP_ANKLE = { x: 75, y: FLOOR };
const reversePlankBody = (angle: number, head: number): Body => {
  const l = lineFrom(RP_ANKLE, angle);
  return {
    x: l.x,
    y: l.y,
    torso: l.torso,
    head,
    armL: { x: l.neck.x - 0.5, y: FLOOR },
    armR: { x: l.neck.x + 0.5, y: FLOOR },
    legL: [l.legAngle - 1, l.legAngle - 1],
    legR: [l.legAngle, l.legAngle],
    footL: 160,
    footR: 160,
  };
};
const reversePlank = holdBody('side', reversePlankBody(-114.3, -140), reversePlankBody(-112.5, -136), { props: MAT });

// Russian twist (side view): seated V with feet up; clasped hands sweep from hip to hip.
const twist = (hands: { x: number; y: number }, torso: number, head: number): Body => ({
  x: 50,
  y: SEAT,
  torso,
  head,
  spine: 12,
  armL: { x: hands.x + 0.8, y: hands.y },
  armR: hands,
  legL: [131, 76],
  legR: [129, 74],
  footL: 120,
  footR: 120,
});
const russianTwist = animate(
  'side',
  2000,
  [
    key(0, twist({ x: 51, y: 84.5 }, -136, -120)),
    key(0.25, twist({ x: 44, y: 70 }, -142, -150)),
    key(0.5, twist({ x: 41, y: 84 }, -146, -165)),
    key(0.75, twist({ x: 44, y: 70 }, -142, -150)),
  ],
  { props: MAT, thumbT: 0 },
);

export const CORE_MOTIONS: Record<string, Motion> = {
  'sit-up': sitUp,
  'bicycle-crunch': bicycleCrunch,
  'leg-raise': legRaise,
  'v-up': vUp,
  'hollow-hold': hollowHold,
  'hollow-rock': hollowRock,
  'flutter-kick': flutterKick,
  'dead-bug': deadBug,
  'superman-hold': supermanHold,
  'bird-dog': birdDog,
  'plank-hold': plankHold,
  'shoulder-tap': shoulderTap,
  'plank-jack': plankJack,
  'plank-to-push-up': plankToPushUp,
  'mountain-climber': mountainClimber,
  'side-plank': sidePlank,
  'reverse-plank': reversePlank,
  'russian-twist': russianTwist,
};

export const CORE_SHAPES = { quad, highPlank, forearmPlank, supine };
