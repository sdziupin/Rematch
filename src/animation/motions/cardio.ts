import type { Limb, Motion } from '../skeleton';
import { FLOOR, STAND_Y, animate, key, lineFrom, loop, spanFrom, type Body, type Target } from '../poses';
import { LEG_SHAPES } from './legs';
import { PLANK } from './push';

const { standSide, ankle, toe } = LEG_SHAPES;

// --- Front-view jumps ------------------------------------------------------------

/** Symmetric front-view body: R limb angles given, L mirrored. Grounded unless `air`. */
const sym = (arm: Limb, leg: number, o: { air?: number; bend?: number; x?: number; torso?: number } = {}): Body => {
  const b = o.bend ?? 0;
  return {
    x: o.x ?? 50,
    air: o.air,
    torso: o.torso ?? 180,
    head: o.torso ?? 180,
    armL: [-arm[0], -arm[1]],
    armR: arm,
    legL: [-leg - b, -leg + b],
    legR: [leg + b, leg - b],
  };
};

const jumpingJack = animate(
  'front',
  900,
  [
    key(0, sym([9, 5], 3), 'in'),
    key(0.25, sym([95, 108], 11, { air: 5 }), 'out'),
    key(0.5, sym([148, 162], 18, { bend: 2 }), 'in'),
    key(0.75, sym([95, 108], 11, { air: 5 }), 'out'),
  ],
  { thumbT: 0.5 },
);

/** Hip y for straight front-view legs at an angle. */
const hipY = (leg: number) => FLOOR - 31 * Math.cos((leg * Math.PI) / 180);
const clap = (x: number, y: number) => ({ armL: { x: x - 0.7, y } as Target, armR: { x: x + 0.7, y } as Target });
const sealJack = animate(
  'front',
  950,
  [
    key(0, { x: 50, y: hipY(3), torso: 180, head: 180, ...clap(50, hipY(3) - 17), legL: [-3, -3], legR: [3, 3] }),
    key(0.25, { x: 50, y: hipY(10) - 5, torso: 180, head: 180, armL: [-62, -78], armR: [62, 78], legL: [-10, -10], legR: [10, 10] }, 'out'),
    key(0.5, { x: 50, y: hipY(15), torso: 180, head: 180, armL: [-91, -91], armR: [91, 91], legL: [-15, -15], legR: [15, 15] }, 'in'),
    key(0.75, { x: 50, y: hipY(10) - 5, torso: 180, head: 180, armL: [-62, -78], armR: [62, 78], legL: [-10, -10], legR: [10, 10] }, 'out'),
  ],
  { thumbT: 0.5 },
);

const crouchFront = (y: number, extra: Partial<Body> = {}): Body => ({
  x: 50,
  y,
  torso: 180,
  head: 180,
  armL: { x: 47, y: y + 7 },
  armR: { x: 53, y: y + 7 },
  legL: ankle(43),
  legR: ankle(57),
  ...extra,
});
const starJump = animate(
  'front',
  1400,
  [
    key(0, crouchFront(73)),
    key(0.38, sym([132, 140], 27, { air: 11 }), 'out'),
    key(0.62, crouchFront(64, { armL: [-60, -70], armR: [60, 70] }), 'in'),
  ],
  { thumbT: 0.38 },
);

// --- Side-view jumps and running --------------------------------------------------

const halfSquatSide = (arms: { armL: Limb; armR: Limb }): Body => ({ x: 44, y: 67, torso: 150, head: 168, ...arms, legL: ankle(51), legR: ankle(50) });
const tuckJump = animate(
  'side',
  1300,
  [
    key(0, halfSquatSide({ armL: [-40, -28], armR: [-45, -32] })),
    key(0.2, { x: 48, torso: 172, head: 176, armL: [150, 160], armR: [145, 155], legL: [3, 0], legR: [1, -2], footL: 30, footR: 30 }, 'in'),
    key(0.42, { x: 48, air: 13, torso: 166, head: 172, armL: [72, 100], armR: [68, 96], legL: [106, 10], legR: [102, 6] }, 'out'),
    key(0.6, { x: 48, air: 3, torso: 176, head: 178, armL: [60, 80], armR: [55, 75], legL: [4, 0], legR: [2, -2], footL: 35, footR: 35 }, 'in'),
    key(0.78, halfSquatSide({ armL: [60, 75], armR: [55, 70] }), 'out'),
  ],
  { thumbT: 0.42 },
);

const pump = (front: 'L' | 'R', big: boolean) => {
  const fwd: Limb = big ? [50, 135] : [35, 120];
  const back: Limb = big ? [-45, 45] : [-35, 50];
  return front === 'L' ? { armL: fwd, armR: back } : { armL: back, armR: fwd };
};
const highKnees = loop(
  'side',
  700,
  [
    { x: 50, torso: 176, head: 178, ...pump('L', true), legR: [96, 2], footR: 45, legL: [1, 0], footL: 42 },
    { x: 50, air: 3, torso: 176, head: 178, ...pump('L', false), legR: [30, -15], footR: 45, legL: [20, -20], footL: 45 },
    { x: 50, torso: 176, head: 178, ...pump('R', true), legL: [96, 2], footL: 45, legR: [1, 0], footR: 42 },
    { x: 50, air: 3, torso: 176, head: 178, ...pump('R', false), legL: [30, -15], footL: 45, legR: [20, -20], footR: 45 },
  ],
  { thumbT: 0 },
);

const buttKicks = loop(
  'side',
  700,
  [
    { x: 50, torso: 172, head: 176, ...pump('L', false), legR: [6, -152], footR: -165, legL: [2, 0], footL: 42 },
    { x: 50, air: 3, torso: 172, head: 176, ...pump('L', false), legR: [10, -60], footR: 10, legL: [6, -70], footL: 20 },
    { x: 50, torso: 172, head: 176, ...pump('R', false), legL: [6, -152], footL: -165, legR: [2, 0], footR: 42 },
    { x: 50, air: 3, torso: 172, head: 176, ...pump('R', false), legL: [10, -60], footL: 10, legR: [6, -70], footR: 20 },
  ],
  { thumbT: 0 },
);

// --- Lateral (front view) ----------------------------------------------------------

const skateLand = (dir: 1 | -1): Body => {
  const x = 50 + dir * 11;
  const stance = x + dir * 3.5;
  return {
    x,
    y: 71,
    torso: 180 - dir * 8,
    head: 180 - dir * 4,
    armL: dir > 0 ? [-95, -115] : [-38, -70],
    armR: dir > 0 ? [38, 70] : [95, 115],
    legL: dir > 0 ? { x: stance + 8, y: 83, bend: 1 } : ankle(stance + 1),
    legR: dir > 0 ? ankle(stance - 1) : { x: stance - 8, y: 83, bend: -1 },
  };
};
const skaterHop = animate(
  'front',
  1500,
  [
    key(0, skateLand(1), 'in'),
    key(0.25, { x: 50, air: 7, torso: 180, head: 180, armL: [-30, -40], armR: [30, 40], legL: [-6, -14], legR: [12, 4] }, 'out'),
    key(0.5, skateLand(-1), 'in'),
    key(0.75, { x: 50, air: 7, torso: 180, head: 180, armL: [-30, -40], armR: [30, 40], legL: [-12, -4], legR: [6, 14] }, 'out'),
  ],
  { thumbT: 0 },
);

const guard = { armL: [-26, 25] as Limb, armR: [26, -25] as Limb };
const wide = (x: number): Body => ({ x, y: 67, torso: 180, head: 180, ...guard, legL: ankle(x - 12), legR: ankle(x + 12) });
const narrow = (x: number): Body => ({ x, y: 64, torso: 180, head: 180, ...guard, legL: ankle(x - 5, 87.5), legR: ankle(x + 5, 87.5) });
const sideShuffle = loop('front', 2000, [wide(38), narrow(43), wide(48), narrow(53), wide(58), narrow(53), wide(48), narrow(43)], { thumbT: 0.25 });

const jumpRope = loop(
  'front',
  620,
  [
    { x: 50, air: 4, torso: 180, head: 180, armL: [-13, -58], armR: [13, 58], legL: [-2, 2], legR: [2, -2] },
    { x: 50, torso: 180, head: 180, armL: [-15, -50], armR: [15, 50], legL: [-1, 5], legR: [1, -5] },
  ],
  { props: [{ kind: 'rope' }], thumbT: 0.5 },
);

// --- Burpee family (side view) --------------------------------------------------------

const HAND = 58;
const BA = { x: HAND + 3 - 52.8, y: PLANK.ankle.y };
const floorHands = { L: PLANK.hand(HAND + 0.5), R: PLANK.hand(HAND) };
const plankUp = () => PLANK.plankAt(BA, PLANK.up, floorHands, 104);
const plankDown = () => PLANK.plankAt(BA, PLANK.down, floorHands, 92);
const squatHands = (footX = 46): Body => ({
  x: 42,
  y: 77,
  torso: 108,
  head: 118,
  armL: floorHands.L,
  armR: floorHands.R,
  legL: ankle(footX + 1),
  legR: ankle(footX),
});
const jumpUp: Body = { x: 46, air: 5, torso: 178, head: 180, armL: [146, 156], armR: [140, 150], legL: [3, 0], legR: [1, -2], footL: 32, footR: 32 };
const landSoft: Body = { x: 43, y: 64, torso: 160, head: 172, armL: [40, 60], armR: [36, 56], legL: ankle(47), legR: ankle(46) };

const burpee = animate(
  'side',
  3000,
  [
    key(0, standSide(46)),
    key(0.12, squatHands()),
    key(0.24, plankUp()),
    key(0.36, plankDown()),
    key(0.48, plankUp()),
    key(0.6, squatHands()),
    key(0.76, jumpUp, 'out'),
    key(0.88, landSoft, 'in'),
  ],
  { thumbT: 0.76 },
);

const halfBurpee = animate(
  'side',
  2300,
  [key(0, standSide(46)), key(0.2, squatHands()), key(0.42, plankUp()), key(0.55, plankUp()), key(0.76, squatHands())],
  { thumbT: 0.42 },
);

const squatThrust = animate('side', 1400, [key(0, squatHands()), key(0.45, plankUp()), key(0.55, plankUp())], { thumbT: 0.5 });

const sprawlBottom: Body = (() => {
  const ankleBack = { x: 10, y: FLOOR };
  const s = spanFrom(ankleBack, { x: HAND - 1.5, y: 67.5 }, 31, -1);
  return {
    x: s.x,
    y: s.y,
    pivot: s.pivot,
    torso: s.torso,
    head: 140,
    spine: -26,
    armL: floorHands.L,
    armR: floorHands.R,
    legL: [s.legAngle + 1, s.legAngle + 1],
    legR: [s.legAngle, s.legAngle],
    footL: -95,
    footR: -95,
  };
})();
const sprawl = animate(
  'side',
  1900,
  [
    key(0, { ...standSide(46), y: STAND_Y + 3, torso: 168, head: 176, armL: [35, 70], armR: [30, 65] }),
    key(0.16, squatHands()),
    key(0.36, sprawlBottom),
    key(0.46, sprawlBottom),
    key(0.64, squatHands()),
  ],
  { thumbT: 0.4 },
);

// --- Broad jump: jump forward, then backpedal to the start ------------------------------

const broadJump = animate(
  'side',
  2900,
  [
    key(0, standSide(34)),
    key(0.1, { x: 30, y: 67, torso: 128, head: 150, armL: [-58, -42], armR: [-62, -46], legL: ankle(35), legR: ankle(34) }),
    key(0.2, { x: 48, torso: 142, head: 155, armL: [142, 152], armR: [138, 148], legL: [-24, -24], legR: [-26, -26], footL: 22, footR: 22 }, 'in'),
    key(0.31, { x: 57, air: 11, torso: 150, head: 160, armL: [96, 104], armR: [92, 100], legL: [72, -6], legR: [68, -10] }, 'out'),
    key(0.42, { x: 61, y: 72, torso: 136, head: 156, armL: [80, 88], armR: [76, 84], legL: ankle(71), legR: ankle(70) }, 'in'),
    key(0.52, standSide(70)),
    key(0.58, { x: 67, y: 59, torso: 180, head: 180, armL: [10, 20], armR: [-10, 0], legL: ankle(64.5, 86), legR: ankle(70) }),
    key(0.64, { x: 64, y: 60, torso: 180, head: 180, armL: [12, 22], armR: [-12, 0], legL: ankle(58), legR: ankle(70) }),
    key(0.7, { x: 58, y: 59, torso: 180, head: 180, armL: [-10, 0], armR: [10, 20], legL: ankle(58), legR: ankle(52, 86) }),
    key(0.76, { x: 52, y: 60, torso: 180, head: 180, armL: [-12, 0], armR: [12, 22], legL: ankle(58), legR: ankle(46) }),
    key(0.82, { x: 46, y: 59, torso: 180, head: 180, armL: [10, 20], armR: [-10, 0], legL: ankle(40, 86), legR: ankle(46) }),
    key(0.88, { x: 40, y: 60, torso: 180, head: 180, armL: [12, 22], armR: [-12, 0], legL: ankle(34), legR: ankle(46) }),
    key(0.94, { x: 36, y: 59, torso: 180, head: 180, armL: [-6, 4], armR: [6, 14], legL: ankle(35), legR: ankle(40, 86) }),
  ],
  { thumbT: 0.31 },
);

// --- Crawls (in place, planted limbs glide back like on a treadmill) ------------------------

function gait(base: Omit<Body, 'armL' | 'armR' | 'legL' | 'legR'>, hand: [number, number], foot: [number, number], footAngle: number, liftHand: number, liftFoot: number, ms: number) {
  const [hf, hb] = hand;
  const [ff, fb] = foot;
  const mid = (a: number, b: number) => (a + b) / 2;
  const h = (x: number, up = false): Target => ({ x, y: FLOOR - (up ? liftHand : 0) });
  const f = (x: number, up = false): Target => ({ x, y: (footAngle === 90 ? FLOOR : 90) - (up ? liftFoot : 0), foot: footAngle });
  const bodies: Body[] = [
    { ...base, armR: h(hf), armL: h(hb), legL: f(ff), legR: f(fb) },
    { ...base, armR: h(mid(hf, hb)), armL: h(mid(hf, hb), true), legL: f(mid(ff, fb)), legR: f(mid(ff, fb), true) },
    { ...base, armR: h(hb), armL: h(hf), legL: f(fb), legR: f(ff) },
    { ...base, armR: h(mid(hf, hb), true), armL: h(mid(hf, hb)), legL: f(mid(ff, fb), true), legR: f(mid(ff, fb)) },
  ];
  return loop('side', ms, bodies, { ease: 'linear', thumbT: 0 });
}
const bearCrawl = gait({ x: 40, y: 70, torso: 95, head: 104 }, [70, 59], [34, 23], 20, 4, 4, 1100);
const crabWalk = gait({ x: 52, y: 75, torso: -108, head: -152 }, [24, 33], [76, 64], 90, 4, 5, 1200);

// --- Inchworm --------------------------------------------------------------------------------

const IW_TOE = 36;
const iwAnkle = (foot: number) => ({ x: IW_TOE - 5 * Math.sin((foot * Math.PI) / 180), y: 90 - 5 * Math.cos((foot * Math.PI) / 180) });
const walkOut = (handX: number, foot: number, neckDx: number, lead: 'L' | 'R' = 'L', look = 25): Body => {
  const a = foot >= 85 ? { x: IW_TOE - 5, y: FLOOR } : iwAnkle(foot);
  const neck = { x: handX + neckDx, y: 0 };
  neck.y = FLOOR - Math.sqrt(Math.max(0, 22.6 * 22.6 - neckDx * neckDx));
  const s = spanFrom(a, neck);
  const off = lead === 'L' ? 3 : -3;
  return {
    x: s.x,
    y: s.y,
    pivot: s.pivot,
    torso: s.torso,
    head: s.torso + look,
    armL: { x: handX + off, y: FLOOR },
    armR: { x: handX, y: FLOOR },
    legL: [s.legAngle + 1, s.legAngle + 1],
    legR: [s.legAngle, s.legAngle],
    footL: foot,
    footR: foot,
  };
};
const iwPlank = (() => {
  const l = lineFrom(iwAnkle(20), PLANK.up);
  return walkOut(l.neck.x - 2, 20, 2);
})();
const iwStand: Body = { ...standSide(IW_TOE - 5), legL: toe(IW_TOE + 1), legR: toe(IW_TOE) };
const inchworm = animate(
  'side',
  4200,
  [
    key(0, iwStand),
    key(0.13, walkOut(58, 90, -10, 'L', -15)),
    key(0.23, walkOut(65, 70, -3, 'R')),
    key(0.33, walkOut(74, 45, -2)),
    key(0.43, iwPlank),
    key(0.52, iwPlank),
    key(0.62, walkOut(74, 45, -2, 'R')),
    key(0.72, walkOut(65, 70, -3)),
    key(0.82, walkOut(58, 90, -10, 'R', -15)),
  ],
  { thumbT: 0.33 },
);

// --- Calm breathing -----------------------------------------------------------------------

const boxBreather = animate(
  'front',
  6000,
  [
    key(0, sym([9, 5], 3)),
    key(0.33, { ...sym([158, 170], 3), head: 182 }),
    key(0.5, { ...sym([158, 170], 3), head: 182 }),
    key(0.83, sym([9, 5], 3)),
  ],
  { thumbT: 0.2 },
);

export const CARDIO_MOTIONS: Record<string, Motion> = {
  'jumping-jack': jumpingJack,
  'seal-jack': sealJack,
  'star-jump': starJump,
  'tuck-jump': tuckJump,
  'high-knees': highKnees,
  'butt-kicks': buttKicks,
  'skater-hop': skaterHop,
  'side-shuffle': sideShuffle,
  'jump-rope': jumpRope,
  burpee,
  'half-burpee': halfBurpee,
  'squat-thrust': squatThrust,
  sprawl,
  'broad-jump': broadJump,
  'bear-crawl': bearCrawl,
  'crab-walk': crabWalk,
  inchworm,
  'box-breather': boxBreather,
};

export const CARDIO_SHAPES = { sym, squatHands, plankUp, plankDown, floorHands, HAND };
