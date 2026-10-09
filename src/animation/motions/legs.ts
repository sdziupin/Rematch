import { GROUND_Y, STROKE, type Motion } from '../skeleton';
import { FLOOR, SEAT, STAND_Y, animate, holdBody, key, legRel, offset, onTop, type Body, type Target } from '../poses';

/** Planted foot: (x, y) is the toe; `foot` 90 = flat, smaller = heel raised. */
export const toe = (x: number, foot = 90, y = foot >= 85 ? FLOOR : 90): Target => ({ x, y, foot });
/** Planted ankle with a flat foot. */
export const ankle = (x: number, y = FLOOR): Target => ({ x, y });

/** Standing tall on both feet (side view), feet under the hip. */
export const standSide = (x = 50, extra: Partial<Body> = {}): Body => ({
  x,
  y: STAND_Y,
  torso: 180,
  head: 180,
  armL: [5, 9],
  armR: [-4, 0],
  legL: ankle(x + 1),
  legR: ankle(x),
  ...extra,
});

// --- Squats -----------------------------------------------------------------

const squatBottom = (extra: Partial<Body> = {}): Body => ({
  x: 36,
  y: 73,
  torso: 136,
  head: 160,
  armL: [96, 98],
  armR: [92, 94],
  legL: ankle(51),
  legR: ankle(50),
  ...extra,
});

const airSquat = animate('side', 2000, [key(0, standSide(50, { armL: [8, 12], armR: [2, 6] })), key(0.5, squatBottom())], { thumbT: 0.5 });

const halfSquat = animate(
  'side',
  1600,
  [key(0, standSide(50, { armL: [10, 14], armR: [4, 8] })), key(0.5, { x: 42, y: 66, torso: 154, head: 170, armL: [80, 84], armR: [76, 80], legL: ankle(51), legR: ankle(50) })],
  { thumbT: 0.5 },
);

const squatHold = holdBody('side', squatBottom(), squatBottom({ y: 73.8, torso: 134, armL: [92, 96], armR: [88, 92] }), { durationMs: 4000 });

const jumpSquat = animate(
  'side',
  1500,
  [
    key(0, squatBottom({ armL: [-38, -22], armR: [-42, -26], torso: 132 })),
    key(0.2, { x: 47, torso: 170, head: 176, armL: [100, 115], armR: [95, 110], legL: [4, 2], legR: [2, 0], footL: 30, footR: 30 }, 'in'),
    key(0.36, { x: 48, y: STAND_Y - 11, torso: 174, head: 178, armL: [128, 140], armR: [122, 134], legL: [16, -14], legR: [12, -18], footL: 30, footR: 30 }, 'out'),
    key(0.52, { x: 47, torso: 174, head: 176, armL: [110, 120], armR: [105, 115], legL: [4, 2], legR: [2, 0], footL: 35, footR: 35 }, 'in'),
    key(0.7, { x: 41, y: 67, torso: 148, head: 166, armL: [70, 80], armR: [66, 76], legL: ankle(51), legR: ankle(50) }, 'out'),
  ],
  { thumbT: 0.36 },
);

// Pistol squat: near leg works, far leg reaches forward.
const pistolSquat = animate(
  'side',
  2800,
  [
    key(0, { x: 50, y: STAND_Y, torso: 176, head: 178, armL: [84, 88], armR: [80, 84], legL: [55, 55], legR: ankle(50), footL: 150 }),
    key(0.5, { x: 41.5, y: 81.5, torso: 124, head: 150, armL: [96, 98], armR: [92, 94], legL: [86, 86], legR: ankle(50), footL: 165 }),
  ],
  { thumbT: 0.5 },
);

const wallSit = holdBody(
  'side',
  { x: 50, y: 74.5, torso: 180, head: 182, armL: { x: 61, y: 71 }, armR: { x: 60, y: 71.5 }, legL: ankle(67), legR: ankle(66) },
  { x: 50, y: 75, torso: 180, head: 178, armL: { x: 61.5, y: 71.5 }, armR: { x: 60.5, y: 72 }, legL: ankle(67), legR: ankle(66) },
  { props: [{ kind: 'wall', x: 44 }] },
);

// Calf raise beside a wall: far hand on the wall for balance, heels rise high.
const CALF_WALL = 64;
const calf = (x: number, foot: number): Body => ({
  x,
  torso: 180,
  head: 180,
  armL: [60, 150],
  armR: [-4, 0],
  legL: [0, 0],
  legR: [0, 0],
  footL: foot,
  footR: foot,
});
const calfRaise = animate('side', 1600, [key(0, calf(50, 90)), key(0.4, calf(52.4, 28)), key(0.58, calf(52.4, 28))], {
  props: [{ kind: 'wall', x: CALF_WALL }],
  thumbT: 0.5,
});

// Step-up onto a box.
const BOX_H = 16;
const boxTop = onTop(BOX_H);
const stepUp = animate(
  'side',
  2600,
  [
    key(0, standSide(40)),
    key(0.2, { x: 44, y: 60.5, torso: 168, head: 174, armL: [25, 45], armR: [-25, 10], legL: ankle(41), legR: ankle(61, boxTop) }),
    key(0.35, { x: 55, y: 49, torso: 174, head: 178, armL: [-10, 10], armR: [20, 40], legL: [-10, -50], legR: ankle(61, boxTop) }),
    key(0.5, { x: 61, y: boxTop - 31, torso: 180, head: 180, armL: [5, 9], armR: [-4, 0], legL: ankle(62, boxTop), legR: ankle(61, boxTop) }),
    key(0.65, { x: 55, y: 49, torso: 176, head: 178, armL: [-10, 10], armR: [20, 40], legL: [-25, -35], legR: ankle(61, boxTop) }),
    key(0.8, { x: 46, y: 60.5, torso: 170, head: 174, armL: [20, 40], armR: [-20, 10], legL: ankle(41), legR: ankle(61, boxTop) }),
  ],
  { props: [{ kind: 'box', x: 55, width: 26, height: BOX_H }], thumbT: 0.2 },
);

// --- Lunges -----------------------------------------------------------------

/** Lunge bottom with the hip at x: front (near) ankle ahead, back toe behind with heel up. */
const lungeR = (x: number, extra: Partial<Body> = {}): Body => ({
  x,
  y: 72,
  torso: 176,
  head: 178,
  armL: [12, 20],
  armR: [-12, 0],
  legR: toe(x + 18, 90),
  legL: toe(x - 19, 38),
  ...extra,
});
const lungeL = (x: number, extra: Partial<Body> = {}): Body => ({ ...lungeR(x), legL: toe(x + 18, 90), legR: toe(x - 19, 38), armL: [-12, 0], armR: [12, 20], ...extra });

const reverseLunge = animate(
  'side',
  2400,
  [
    key(0, standSide(50, { legR: toe(55), legL: toe(56) })),
    key(0.5, lungeR(37, { legR: toe(55, 90), legL: toe(18, 38) })),
  ],
  { thumbT: 0.5 },
);

// Walking lunge, in place: the stance foot glides back like on a treadmill.
const walkingLunge = animate(
  'side',
  3600,
  [
    key(0, lungeR(44)),
    key(0.25, { x: 44, y: STAND_Y, torso: 178, head: 180, armL: [-10, 0], armR: [10, 20], legR: toe(49, 90), legL: [50, -15], footL: 70 }),
    key(0.5, lungeL(44)),
    key(0.75, { x: 44, y: STAND_Y, torso: 178, head: 180, armL: [10, 20], armR: [-10, 0], legL: toe(49, 90), legR: [50, -15], footR: 70 }),
  ],
  { thumbT: 0 },
);

const airSplit = (front: 'L' | 'R', y: number, arms: 1 | -1): Body => {
  const fwd: [number, number] = [42, -8];
  const back: [number, number] = [-30, -75];
  return {
    x: 46,
    y,
    torso: 176,
    head: 178,
    armL: arms > 0 ? [40, 70] : [-35, -10],
    armR: arms > 0 ? [-35, -10] : [40, 70],
    legL: front === 'L' ? fwd : back,
    legR: front === 'R' ? fwd : back,
    footL: front === 'L' ? 80 : 30,
    footR: front === 'R' ? 80 : 30,
  };
};
const jumpingLunge = animate(
  'side',
  1800,
  [
    key(0, lungeR(46, { armL: [35, 60], armR: [-35, -10] })),
    key(0.17, airSplit('R', STAND_Y - 4, 1), 'out'),
    key(0.33, airSplit('L', STAND_Y - 4, -1)),
    key(0.5, lungeL(46, { armL: [-35, -10], armR: [35, 60] }), 'in'),
    key(0.67, airSplit('L', STAND_Y - 4, -1), 'out'),
    key(0.83, airSplit('R', STAND_Y - 4, 1)),
  ],
  { thumbT: 0.17 },
);

// Bulgarian split squat: rear instep on a bench behind.
const BENCH_H = 15;
const rearFoot: Target = { x: 27, y: onTop(BENCH_H) + 1.4, foot: -100 };
const bulgarianSplitSquat = animate(
  'side',
  2600,
  [
    key(0, { x: 53.5, y: 61.5, torso: 174, head: 178, armL: [6, 12], armR: [-2, 4], legR: ankle(66), legL: rearFoot }),
    key(0.5, { x: 50, y: 74.5, torso: 168, head: 174, armL: [12, 18], armR: [4, 10], legR: ankle(66), legL: rearFoot }),
  ],
  { props: [{ kind: 'bench', x: 14, width: 22, height: BENCH_H }], thumbT: 0.5 },
);

// --- Hinges and bridges -------------------------------------------------------

const singleLegDeadlift = animate(
  'side',
  2600,
  [
    key(0, { x: 50, y: STAND_Y, torso: 180, head: 180, armL: [4, 8], armR: [-2, 2], legL: ankle(51), legR: [-6, -22], footR: 40 }),
    key(0.5, { x: 47, y: 60.5, torso: 96, head: 92, armL: [6, 6], armR: [2, 2], legL: ankle(51), legR: [-84, -84], footR: 4 }),
  ],
  { thumbT: 0.5 },
);

// Supine, head to the left: neck on the floor, hips bridge up around it.
const NECK = { x: 32, y: SEAT };
const bridgeBody = (hipY: number, extra: Partial<Body> = {}): Body => {
  const dy = hipY - NECK.y;
  const hip = { x: NECK.x + Math.sqrt(25 * 25 - dy * dy), y: hipY };
  return {
    x: hip.x,
    y: hip.y,
    pivot: NECK,
    torso: Math.atan2(NECK.x - hip.x, NECK.y - hip.y) * (180 / Math.PI),
    head: -106,
    armL: { x: NECK.x + 22.5, y: FLOOR },
    armR: { x: NECK.x + 21.5, y: FLOOR },
    legL: ankle(NECK.x + 43),
    legR: ankle(NECK.x + 42),
    ...extra,
  };
};
const gluteBridge = animate('side', 2200, [key(0, bridgeBody(SEAT)), key(0.45, bridgeBody(77)), key(0.6, bridgeBody(77))], {
  props: [{ kind: 'mat' }],
  thumbT: 0.5,
});

const slbTorso = (hipY: number) => bridgeBody(hipY).torso;
const singleLegBridge = animate(
  'side',
  2400,
  [
    key(0, bridgeBody(SEAT, { legR: legRel(slbTorso(SEAT), 42), footR: 150 })),
    key(0.45, bridgeBody(77, { legR: legRel(slbTorso(77), 4), footR: 175 })),
    key(0.6, bridgeBody(77, { legR: legRel(slbTorso(77), 4), footR: 175 })),
  ],
  { props: [{ kind: 'mat' }], thumbT: 0.5 },
);

// Hip thrust: upper back on a bench, hips drive up to a straight line.
const THRUST_BENCH = 15;
const thrustNeck = { x: 38, y: GROUND_Y - THRUST_BENCH - STROKE.torso / 2 };
const thrustBody = (hipY: number): Body => {
  const dy = hipY - thrustNeck.y;
  const hip = { x: thrustNeck.x + Math.sqrt(25 * 25 - dy * dy), y: hipY };
  return {
    x: hip.x,
    y: hip.y,
    pivot: thrustNeck,
    torso: Math.atan2(thrustNeck.x - hip.x, thrustNeck.y - hip.y) * (180 / Math.PI),
    head: -128,
    armL: [-96, -84],
    armR: [-92, -80],
    legL: ankle(79),
    legR: ankle(78),
  };
};
const hipThrust = animate('side', 2200, [key(0, thrustBody(84)), key(0.45, thrustBody(thrustNeck.y)), key(0.6, thrustBody(thrustNeck.y))], {
  props: [{ kind: 'bench', x: 16, width: 24, height: THRUST_BENCH }],
  thumbT: 0.5,
});

// --- Front-view lateral lunges --------------------------------------------------

const prayer = (x: number, y: number) => ({ armL: { x: x - 0.5, y }, armR: { x: x + 0.5, y } });
const wideStand = (x: number, half: number, hipY: number, extra: Partial<Body> = {}): Body => {
  const neckY = hipY - 25;
  return { x, y: hipY, torso: 180, head: 180, ...prayer(x, neckY + 9), legL: ankle(x - half), legR: ankle(x + half), ...extra };
};

/** Lateral shift over one bent leg in a wide stance (front view). */
function sideShift(centre: number, half: number, dir: 1 | -1, hipY: number, lean: number): Body {
  const x = centre + dir * (half - 6.5);
  const torso = 180 - dir * lean;
  const neck = offset({ x, y: hipY }, torso, 25);
  return {
    x,
    y: hipY,
    torso,
    head: 180 - dir * lean * 0.5,
    ...prayer(neck.x, neck.y + 9),
    legL: ankle(centre - half),
    legR: ankle(centre + half),
  };
}

const lateralLunge = animate(
  'front',
  3000,
  [
    key(0, wideStand(50, 17, 63)),
    key(0.25, sideShift(50, 17, 1, 74, 8)),
    key(0.5, wideStand(50, 17, 63)),
    key(0.75, sideShift(50, 17, -1, 74, 8)),
  ],
  { thumbT: 0.25 },
);

const cossackSquat = animate(
  'front',
  3200,
  [
    key(0, wideStand(50, 20, 66)),
    key(0.25, sideShift(50, 20, 1, 80, 12)),
    key(0.5, wideStand(50, 20, 66)),
    key(0.75, sideShift(50, 20, -1, 80, 12)),
  ],
  { thumbT: 0.25 },
);

const curtsyStand: Body = { x: 50, y: STAND_Y, torso: 180, head: 180, ...prayer(50, STAND_Y - 16), legL: ankle(46.5), legR: ankle(53.5) };
const curtsyLunge = animate(
  'front',
  3400,
  [
    key(0, curtsyStand),
    key(0.25, { x: 48, y: 68, torso: 183, head: 180, ...prayer(47, 52), legL: { x: 46.5, y: FLOOR, bend: 1 }, legR: { x: 34, y: 86.5, bend: -1 } }),
    key(0.5, curtsyStand),
    key(0.75, { x: 52, y: 68, torso: 177, head: 180, ...prayer(53, 52), legR: { x: 53.5, y: FLOOR, bend: -1 }, legL: { x: 66, y: 86.5, bend: 1 } }),
  ],
  { thumbT: 0.25 },
);

export const LEG_MOTIONS: Record<string, Motion> = {
  'air-squat': airSquat,
  'half-squat': halfSquat,
  'squat-hold': squatHold,
  'jump-squat': jumpSquat,
  'pistol-squat': pistolSquat,
  'wall-sit': wallSit,
  'calf-raise': calfRaise,
  'step-up': stepUp,
  'reverse-lunge': reverseLunge,
  'walking-lunge': walkingLunge,
  'jumping-lunge': jumpingLunge,
  'bulgarian-split-squat': bulgarianSplitSquat,
  'single-leg-deadlift': singleLegDeadlift,
  'glute-bridge': gluteBridge,
  'single-leg-bridge': singleLegBridge,
  'hip-thrust': hipThrust,
  'lateral-lunge': lateralLunge,
  'cossack-squat': cossackSquat,
  'curtsy-lunge': curtsyLunge,
};

export const LEG_SHAPES = { standSide, squatBottom, lungeR, lungeL, toe, ankle };
