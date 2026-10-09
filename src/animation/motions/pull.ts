import type { Motion, Prop } from '../skeleton';
import { alignX, animate, holdBody, jointsOf, key, type Body } from '../poses';

/**
 * Hanging moves. Hands are pinned to the bar (anchorY); the bar spans the frame so the
 * small horizontal drift of the hands is invisible.
 */
const GRIP = 1.2; // wrist centre just under the bar line
const BAR_X = 52;

type HangShape = Omit<Body, 'x' | 'y' | 'hang' | 'anchorY'>;

/** A hanging body with the near hand on the bar at BAR_X and both hands pinned under the bar. */
function hangAt(barY: number, b: HangShape): Body {
  const seed = alignX('side', { ...b, x: 50, y: 0 }, 'wristR', BAR_X);
  const j = jointsOf('side', seed);
  return { ...seed, y: barY + GRIP - (j.wristL.y + j.wristR.y) / 2, anchorY: barY + GRIP };
}

const bar = (y: number): Prop[] => [{ kind: 'bar', y }];

// Pull-up / chin-up: bar high enough for the chin to clear it at the top.
const PULL_BAR = 18;
const pullHang = (lean = 0): HangShape => ({
  torso: 180 + lean,
  head: 180,
  armL: [181, 181],
  armR: [180, 180],
  legL: [24, -100],
  legR: [20, -104],
  footL: -60,
  footR: -65,
});
const pullTop: HangShape = {
  torso: -170,
  head: 172,
  armL: [-18, 172],
  armR: [-20, 170],
  legL: [18, -80],
  legR: [14, -84],
  footL: -40,
  footR: -45,
};
const chinTop: HangShape = {
  torso: -172,
  head: 176,
  armL: [22, 192],
  armR: [20, 190],
  legL: [18, -80],
  legR: [14, -84],
  footL: -40,
  footR: -45,
};

const pullUp = animate('side', 2400, [key(0, hangAt(PULL_BAR, pullHang())), key(0.45, hangAt(PULL_BAR, pullTop)), key(0.55, hangAt(PULL_BAR, pullTop))], {
  props: bar(PULL_BAR),
  thumbT: 0.5,
});

const chinUp = animate('side', 2400, [key(0, hangAt(PULL_BAR, pullHang())), key(0.45, hangAt(PULL_BAR, chinTop)), key(0.55, hangAt(PULL_BAR, chinTop))], {
  props: bar(PULL_BAR),
  thumbT: 0.5,
});

// Negative: quick to the top, slow controlled lowering.
const negativePullUp = animate(
  'side',
  4400,
  [key(0, hangAt(PULL_BAR, pullTop)), key(0.1, hangAt(PULL_BAR, pullTop)), key(0.78, hangAt(PULL_BAR, pullHang())), key(0.86, hangAt(PULL_BAR, pullHang()))],
  { props: bar(PULL_BAR), thumbT: 0.35 },
);

// Straight-arm hangs use a lower bar so the feet stay well off the floor.
const LOW_BAR = 6;
const deadHangBody = (sway: number): HangShape => ({
  torso: 180 + sway,
  head: 180,
  armL: [181 + sway, 181 + sway],
  armR: [180 + sway, 180 + sway],
  legL: [12 + sway, -50],
  legR: [8 + sway, -55],
  footL: -20,
  footR: -25,
});
const deadHang = holdBody('side', hangAt(LOW_BAR, deadHangBody(0)), hangAt(LOW_BAR, deadHangBody(-2.5)), { props: bar(LOW_BAR), durationMs: 4000 });

const hangingKneeRaise = animate(
  'side',
  2200,
  [
    key(0, hangAt(LOW_BAR, deadHangBody(0))),
    key(0.45, hangAt(LOW_BAR, { torso: -172, head: 178, armL: [175, 175], armR: [174, 174], legL: [112, 8], legR: [108, 4], footL: 40, footR: 40 })),
    key(0.55, hangAt(LOW_BAR, { torso: -172, head: 178, armL: [175, 175], armR: [174, 174], legL: [112, 8], legR: [108, 4], footL: 40, footR: 40 })),
  ],
  { props: bar(LOW_BAR), thumbT: 0.5 },
);

const t2bTop: HangShape = { torso: -124, head: -150, spine: 18, armL: [161, 161], armR: [160, 160], legL: [-161, -161], legR: [-163, -163], footL: -168, footR: -170 };
const toesToBar = animate(
  'side',
  2400,
  [
    key(0, hangAt(LOW_BAR, deadHangBody(0))),
    key(0.25, hangAt(LOW_BAR, { torso: -168, head: -176, armL: [172, 172], armR: [171, 171], legL: [96, 96], legR: [94, 94], footL: 110, footR: 110 })),
    key(0.48, hangAt(LOW_BAR, t2bTop)),
    key(0.56, hangAt(LOW_BAR, t2bTop)),
    key(0.78, hangAt(LOW_BAR, { torso: -168, head: -176, armL: [172, 172], armR: [171, 171], legL: [96, 96], legR: [94, 94], footL: 110, footR: 110 })),
  ],
  { props: bar(LOW_BAR), thumbT: 0.52 },
);

export const PULL_MOTIONS: Record<string, Motion> = {
  'pull-up': pullUp,
  'chin-up': chinUp,
  'negative-pull-up': negativePullUp,
  'dead-hang': deadHang,
  'hanging-knee-raise': hangingKneeRaise,
  'toes-to-bar': toesToBar,
};
