import type { Motion, Prop } from '../skeleton';
import { SEAT, STAND_Y, animate, jointsOf, key, loop, neckAt, solveBody, type Body, type Target } from '../poses';
import { CARDIO_SHAPES } from './cardio';
import { LEG_SHAPES } from './legs';
import { PLANK } from './push';

const { standSide, ankle, toe, lungeR } = LEG_SHAPES;
const DB_BOTH: Prop[] = [{ kind: 'dumbbell', hands: 'both' }];
const DB_ONE: Prop[] = [{ kind: 'dumbbell', hands: 'R' }];
const KB: Prop[] = [{ kind: 'kettlebell', hands: 'both' }];

/** Hands at an offset from the neck (both arms, far hand slightly ahead). */
const handsAt = (x: number, y: number, torso: number, dx: number, dy: number) => {
  const n = neckAt(x, y, torso);
  return { armL: { x: n.x + dx + 0.6, y: n.y + dy } as Target, armR: { x: n.x + dx, y: n.y + dy } as Target };
};

/** Side-view squat body with the hands held relative to the neck. */
const squatWith = (x: number, y: number, torso: number, head: number, dx: number, dy: number): Body => ({
  x,
  y,
  torso,
  head,
  ...handsAt(x, y, torso, dx, dy),
  legL: ankle(51),
  legR: ankle(50),
});

const gobletSquat = animate('side', 2400, [key(0, squatWith(50, STAND_Y, 180, 180, 6.5, 6)), key(0.5, squatWith(39, 76, 148, 166, 6.5, 6))], {
  props: DB_ONE,
  thumbT: 0.5,
});

// Thruster: front squat with dumbbells racked, drive up into an overhead press.
const thruster = animate(
  'side',
  2600,
  [
    key(0, squatWith(50, STAND_Y, 180, 180, 6, 1)),
    key(0.3, squatWith(40, 75, 150, 166, 6, 1)),
    key(0.55, { ...squatWith(49, STAND_Y + 1, 176, 178, 4, -12) }),
    key(0.7, { ...standSide(50), armL: [177, 179], armR: [175, 177] }),
    key(0.86, squatWith(50, STAND_Y, 180, 180, 6, 1)),
  ],
  { props: DB_BOTH, thumbT: 0.7 },
);

const press = animate(
  'side',
  2200,
  [
    key(0, { ...standSide(50), ...handsAt(50, STAND_Y, 180, 5.5, 1) }),
    key(0.42, { ...standSide(50), armL: [177, 179], armR: [175, 177] }),
    key(0.56, { ...standSide(50), armL: [177, 179], armR: [175, 177] }),
  ],
  { props: DB_BOTH, thumbT: 0.42 },
);

const curl = animate(
  'side',
  2000,
  [
    key(0, { ...standSide(50), armL: [4, 6], armR: [2, 4] }),
    key(0.42, { ...standSide(50), armL: [8, 150], armR: [6, 148] }),
    key(0.54, { ...standSide(50), armL: [8, 150], armR: [6, 148] }),
  ],
  { props: DB_BOTH, thumbT: 0.42 },
);

// Single-arm snatch: dumbbell between the feet, one fast arc to overhead.
const snatchBottom: Body = { x: 38, y: 72, torso: 122, head: 140, armL: [40, 60], armR: { x: 51, y: 84.5 }, legL: ankle(52), legR: ankle(51) };
const snatch = animate(
  'side',
  2300,
  [
    key(0, snatchBottom),
    key(0.17, { x: 50, torso: 176, head: 178, armL: [-20, 0], armR: [70, 86], legL: [2, 0], legR: [0, -2], footL: 40, footR: 40 }, 'in'),
    key(0.31, { x: 50, torso: 178, head: 178, armL: [-15, 5], armR: [142, 168], legL: [2, 0], legR: [0, -2], footL: 50, footR: 50 }, 'out'),
    key(0.43, { x: 47, y: 63, torso: 172, head: 176, armL: [40, 60], armR: [176, 178], legL: ankle(52), legR: ankle(51) }),
    key(0.58, { ...standSide(51), armL: [10, 20], armR: [177, 178] }),
    key(0.78, { ...standSide(51), armL: [10, 20], armR: [24, 168] }),
  ],
  { props: DB_ONE, thumbT: 0.43 },
);

// Bent-over row with two dumbbells: hinged ~45°, soft knees, elbows drive past the ribs.
const rowBody = (arms: { armL: [number, number]; armR: [number, number] }): Body => ({
  x: 43,
  y: 62,
  torso: 130,
  head: 118,
  ...arms,
  legL: ankle(51),
  legR: ankle(50),
});
const dumbbellRow = animate(
  'side',
  2000,
  [key(0, rowBody({ armL: [2, 2], armR: [0, 0] })), key(0.42, rowBody({ armL: [-72, 2], armR: [-75, 0] })), key(0.54, rowBody({ armL: [-72, 2], armR: [-75, 0] }))],
  { props: DB_BOTH, thumbT: 0.45 },
);

const deadliftBottom: Body = { x: 37, y: 69, torso: 118, head: 136, armL: { x: 54.5, y: 82 }, armR: { x: 54, y: 82 }, legL: ankle(51), legR: ankle(50) };
const dumbbellDeadlift = animate('side', 2400, [key(0, { ...standSide(50), armL: [4, 4], armR: [2, 2] }), key(0.5, deadliftBottom)], {
  props: DB_BOTH,
  thumbT: 0.5,
});

const dumbbellLunge = animate(
  'side',
  2600,
  [
    key(0, { ...standSide(50, { legR: toe(55), legL: toe(56) }), armL: [4, 4], armR: [2, 2] }),
    key(0.5, lungeR(37, { legR: toe(55, 90), legL: toe(18, 38), armL: [6, 6], armR: [4, 4] })),
  ],
  { props: DB_BOTH, thumbT: 0.5 },
);

// Renegade row: plank on dumbbells, alternate rows.
const rp = (extra: Partial<Body> = {}): Body => ({ ...PLANK.plankAt(PLANK.ankle, PLANK.up, { L: PLANK.hand(PLANK.handX + 3.5), R: PLANK.hand(PLANK.handX + 3) }, 102, 4), ...extra });
const rpNeck = jointsOf('side', rp()).neck;
const rowHand = (dx = 0): Target => ({ x: rpNeck.x - 9 + dx, y: rpNeck.y + 6.5 });
const renegadeRow = animate('side', 2600, [key(0, rp()), key(0.22, rp({ armR: rowHand() })), key(0.5, rp()), key(0.72, rp({ armL: rowHand(0.5) }))], {
  props: DB_BOTH,
  thumbT: 0.22,
});

// Devil press: burpee onto the dumbbells, then swing them from the floor to overhead.
const { squatHands, plankUp, plankDown } = CARDIO_SHAPES;
const devilPress = animate(
  'side',
  3600,
  [
    key(0, { ...standSide(46), armL: [4, 4], armR: [2, 2] }),
    key(0.12, squatHands()),
    key(0.23, plankUp()),
    key(0.33, plankDown()),
    key(0.43, plankUp()),
    key(0.53, squatHands()),
    key(0.63, { x: 38, y: 68, torso: 122, head: 140, armL: [-24, -24], armR: [-26, -26], legL: ankle(48), legR: ankle(47) }),
    key(0.71, { x: 45, y: 61, torso: 165, head: 172, armL: [84, 96], armR: [80, 92], legL: ankle(48), legR: ankle(47) }, 'in'),
    key(0.8, { ...standSide(47), armL: [177, 179], armR: [175, 177] }, 'out'),
    key(0.9, { ...standSide(47), armL: [60, 70], armR: [56, 66] }),
  ],
  { props: DB_BOTH, thumbT: 0.76 },
);

// Floor press: lying on the back, elbows touch the floor at the bottom.
const FP_HIP = { x: 56, y: SEAT };
const floorPressBody = (arms: { armL: [number, number]; armR: [number, number] }): Body => ({
  x: FP_HIP.x,
  y: FP_HIP.y,
  torso: -90,
  head: -104,
  ...arms,
  legL: ankle(FP_HIP.x + 20),
  legR: ankle(FP_HIP.x + 19),
});
const floorPress = animate(
  'side',
  2000,
  [key(0, floorPressBody({ armL: [95, 180], armR: [94, 178] })), key(0.45, floorPressBody({ armL: [180, 180], armR: [178, 178] })), key(0.55, floorPressBody({ armL: [180, 180], armR: [178, 178] }))],
  { props: [{ kind: 'mat' }, ...DB_BOTH], thumbT: 0.5 },
);

const lateralRaise = animate(
  'front',
  2200,
  [
    key(0, { x: 50, torso: 180, head: 180, armL: [-12, -8], armR: [12, 8], legL: [-3, -3], legR: [3, 3] }),
    key(0.45, { x: 50, torso: 180, head: 180, armL: [-86, -96], armR: [86, 96], legL: [-3, -3], legR: [3, 3] }),
    key(0.55, { x: 50, torso: 180, head: 180, armL: [-86, -96], armR: [86, 96], legL: [-3, -3], legR: [3, 3] }),
  ],
  { props: DB_BOTH, thumbT: 0.5 },
);

// Farmer carry: walking in place (the stance foot glides back), dumbbells at the sides.
const carryArms = { armL: [5, 5] as [number, number], armR: [3, 3] as [number, number], torso: 180, head: 180 };
const farmerCarry = loop(
  'side',
  1200,
  [
    { x: 50, y: 60, ...carryArms, legR: toe(64, 90), legL: toe(45, 52) },
    { x: 50, y: STAND_Y, ...carryArms, legR: toe(55, 90), legL: [28, -42], footL: 60 },
    { x: 50, y: 60, ...carryArms, legL: toe(64, 90), legR: toe(45, 52) },
    { x: 50, y: STAND_Y, ...carryArms, legL: toe(55, 90), legR: [28, -42], footR: 60 },
  ],
  { props: DB_BOTH, ease: 'linear', thumbT: 0 },
);

// --- Kettlebell -------------------------------------------------------------------------

const swing = animate(
  'side',
  1500,
  [
    key(0, { x: 38, y: 66, torso: 122, head: 145, armL: [-38, -38], armR: [-40, -40], legL: ankle(51), legR: ankle(50) }, 'in'),
    key(0.22, { x: 45, y: 61, torso: 160, head: 172, armL: [8, 8], armR: [6, 6], legL: ankle(51), legR: ankle(50) }, 'out'),
    key(0.45, { x: 50, y: STAND_Y, torso: 182, head: 180, armL: [90, 90], armR: [88, 88], legL: ankle(51), legR: ankle(50) }),
    key(0.7, { x: 46, y: 61, torso: 165, head: 174, armL: [12, 12], armR: [10, 10], legL: ankle(51), legR: ankle(50) }, 'in'),
  ],
  { props: KB, thumbT: 0.45 },
);

const kbDeadlift = animate(
  'side',
  2400,
  [
    key(0, { ...standSide(50), ...{ armL: { x: 52, y: 79.5 } as Target, armR: { x: 51.5, y: 79.5 } as Target } }),
    key(0.5, { x: 37, y: 72, torso: 112, head: 132, armL: { x: 54.5, y: 83.5 }, armR: { x: 54, y: 83.5 }, legL: ankle(51), legR: ankle(50) }),
  ],
  { props: KB, thumbT: 0.5 },
);

const HALO_NECK_Y = STAND_Y - 25;
const halo = (hx: number, hy: number, bend: { L: 1 | -1; R: 1 | -1 }): Body => ({
  x: 50,
  y: STAND_Y,
  torso: 180,
  head: 180,
  armL: { x: 50 + hx - 0.8, y: HALO_NECK_Y + hy, bend: bend.L },
  armR: { x: 50 + hx + 0.8, y: HALO_NECK_Y + hy, bend: bend.R },
  legL: ankle(46.5),
  legR: ankle(53.5),
});
/** Freeze IK arms into angles so the elbows swing smoothly between keys instead of flipping. */
const frozenArms = (b: Body): Body => {
  const p = solveBody('front', b);
  return { ...b, armL: p.armL, armR: p.armR };
};
const kettlebellHalo = loop(
  'front',
  2600,
  [
    halo(9, -9, { L: -1, R: -1 }),
    halo(0, -15, { L: 1, R: -1 }),
    halo(-9, -9, { L: 1, R: 1 }),
    halo(0, 2, { L: -1, R: 1 }),
  ].map(frozenArms),
  { props: KB, ease: 'linear', thumbT: 0 },
);

// --- Band ---------------------------------------------------------------------------------

const bandStart: Body = {
  x: 50,
  y: STAND_Y,
  torso: 180,
  head: 180,
  armL: { x: 43, y: HALO_NECK_Y + 13 },
  armR: { x: 57, y: HALO_NECK_Y + 13 },
  legL: ankle(46.5),
  legR: ankle(53.5),
};
const bandOpen: Body = { ...bandStart, armL: [-88, -90], armR: [88, 90] };
const bandPullApart = animate('front', 2000, [key(0, bandStart), key(0.42, bandOpen), key(0.56, bandOpen)], {
  props: [{ kind: 'band', hands: 'both' }],
  thumbT: 0.42,
});

export const WEIGHT_MOTIONS: Record<string, Motion> = {
  'goblet-squat': gobletSquat,
  'dumbbell-thruster': thruster,
  'dumbbell-snatch': snatch,
  'dumbbell-row': dumbbellRow,
  'dumbbell-press': press,
  'dumbbell-curl': curl,
  'dumbbell-lunge': dumbbellLunge,
  'dumbbell-deadlift': dumbbellDeadlift,
  'renegade-row': renegadeRow,
  'devil-press': devilPress,
  'dumbbell-floor-press': floorPress,
  'lateral-raise': lateralRaise,
  'farmer-carry': farmerCarry,
  'kettlebell-swing': swing,
  'kettlebell-deadlift': kbDeadlift,
  'kettlebell-halo': kettlebellHalo,
  'band-pull-apart': bandPullApart,
};

