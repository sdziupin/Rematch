/**
 * Stick-figure skeleton used for REMATCH's exercise animations.
 *
 * A pose is a set of absolute segment angles in degrees:
 *   0 = pointing down, 90 = pointing right (forward in side view), 180 = up, -90 = left.
 * The solver turns angles into joint positions and then grounds the figure:
 * the lowest visible point rests on the floor (raised by `lift` for jumps), or,
 * for hanging/supported movements, the hands are pinned to `anchorY`.
 */

export const VIEWBOX = 100;
export const GROUND_Y = 92;

export const SEGMENT = {
  torso: 25,
  neck: 4,
  headR: 6,
  upperArm: 12,
  forearm: 11,
  thigh: 16,
  shin: 15,
  foot: 5,
  shoulderHalf: 6,
  hipHalf: 3.5,
} as const;

export const STROKE = { torso: 7, limb: 5, foot: 4 } as const;

export type View = 'side' | 'front';
export type Limb = [number, number];

export interface Pose {
  /** Horizontal hip position (viewBox units). Whole motions are re-centred. */
  x?: number;
  /** Height of the lowest point above the floor (jumps). */
  lift?: number;
  /** Pin the hands (average of both wrists) to this y instead of grounding. */
  anchorY?: number;
  torso: number;
  head?: number;
  /**
   * Spine curve in degrees (bend between the lower and upper back). Positive rounds the back
   * (flexion: the middle of the spine moves toward torso+90°, the back of a right-facing figure),
   * negative arches it (extension). The hip and neck stay where `torso` puts them.
   */
  spine?: number;
  /** [upper arm, forearm]. Side view: L is the far arm. */
  armL: Limb;
  armR: Limb;
  /** [thigh, shin]. Side view: L is the far leg. */
  legL: Limb;
  legR: Limb;
  /** Optional foot angles; defaults keep feet flat when standing. */
  footL?: number;
  footR?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Joints {
  hip: Point;
  /** Middle of the (possibly curved) spine. */
  spine: Point;
  neck: Point;
  head: Point;
  shoulderL: Point;
  shoulderR: Point;
  elbowL: Point;
  elbowR: Point;
  wristL: Point;
  wristR: Point;
  hipL: Point;
  hipR: Point;
  kneeL: Point;
  kneeR: Point;
  ankleL: Point;
  ankleR: Point;
  toeL: Point;
  toeR: Point;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): Point => ({ x: Math.sin(rad(deg)), y: Math.cos(rad(deg)) });
const add = (p: Point, deg: number, len: number): Point => {
  const d = dir(deg);
  return { x: p.x + d.x * len, y: p.y + d.y * len };
};

function defaultFoot(shin: number): number {
  // Standing or kneeling-ish: keep the foot flat and pointing forward.
  const normalized = ((shin % 360) + 540) % 360 - 180;
  if (Math.abs(normalized) <= 60) return 90;
  return shin + 90;
}

/** Joint positions before grounding, with the hip at (x, 0). */
export function solveRaw(pose: Pose, view: View = 'side'): Joints {
  const hip: Point = { x: pose.x ?? 50, y: 0 };
  const neck = add(hip, pose.torso, SEGMENT.torso);
  const head = add(neck, pose.head ?? pose.torso, SEGMENT.neck + SEGMENT.headR);
  const bend = Math.max(-120, Math.min(120, pose.spine ?? 0));
  const spine = add({ x: (hip.x + neck.x) / 2, y: (hip.y + neck.y) / 2 }, pose.torso + 90, (SEGMENT.torso / 2) * Math.tan(rad(bend / 2)));

  let shoulderL = neck;
  let shoulderR = neck;
  let hipL = hip;
  let hipR = hip;
  if (view === 'front') {
    // Unit vector toward screen-right for an upright torso, so L is screen-left.
    const across = pose.torso - 90;
    shoulderL = add(neck, across, -SEGMENT.shoulderHalf);
    shoulderR = add(neck, across, SEGMENT.shoulderHalf);
    hipL = add(hip, across, -SEGMENT.hipHalf);
    hipR = add(hip, across, SEGMENT.hipHalf);
  }

  const elbowL = add(shoulderL, pose.armL[0], SEGMENT.upperArm);
  const elbowR = add(shoulderR, pose.armR[0], SEGMENT.upperArm);
  const wristL = add(elbowL, pose.armL[1], SEGMENT.forearm);
  const wristR = add(elbowR, pose.armR[1], SEGMENT.forearm);
  const kneeL = add(hipL, pose.legL[0], SEGMENT.thigh);
  const kneeR = add(hipR, pose.legR[0], SEGMENT.thigh);
  const ankleL = add(kneeL, pose.legL[1], SEGMENT.shin);
  const ankleR = add(kneeR, pose.legR[1], SEGMENT.shin);
  const footLen = view === 'front' ? SEGMENT.foot * 0.6 : SEGMENT.foot;
  const toeL = add(ankleL, view === 'front' ? -90 : pose.footL ?? defaultFoot(pose.legL[1]), footLen);
  const toeR = add(ankleR, view === 'front' ? 90 : pose.footR ?? defaultFoot(pose.legR[1]), footLen);

  return { hip, spine, neck, head, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, hipL, hipR, kneeL, kneeR, ankleL, ankleR, toeL, toeR };
}

/** Lowest visible point (largest y), including stroke thickness. */
export function lowestPoint(j: Joints): number {
  const limbR = STROKE.limb / 2;
  const candidates = [
    j.hip.y + STROKE.torso / 2,
    j.spine.y + STROKE.torso / 2,
    j.neck.y + STROKE.torso / 2,
    j.head.y + SEGMENT.headR,
    j.elbowL.y + limbR,
    j.elbowR.y + limbR,
    j.wristL.y + limbR,
    j.wristR.y + limbR,
    j.kneeL.y + limbR,
    j.kneeR.y + limbR,
    j.ankleL.y + limbR,
    j.ankleR.y + limbR,
    j.toeL.y + STROKE.foot / 2,
    j.toeR.y + STROKE.foot / 2,
  ];
  return Math.max(...candidates);
}

function shift(j: Joints, dx: number, dy: number): Joints {
  const out = {} as Joints;
  for (const key of Object.keys(j) as (keyof Joints)[]) out[key] = { x: j[key].x + dx, y: j[key].y + dy };
  return out;
}

/** Solves and grounds a pose. */
export function solvePose(pose: Pose, view: View = 'side', groundY = GROUND_Y): Joints {
  const raw = solveRaw(pose, view);
  if (pose.anchorY !== undefined) {
    const handsY = (raw.wristL.y + raw.wristR.y) / 2;
    return shift(raw, 0, pose.anchorY - handsY);
  }
  return shift(raw, 0, groundY - (pose.lift ?? 0) - lowestPoint(raw));
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

export type Ease = 'inOut' | 'linear' | 'in' | 'out';

export function ease(kind: Ease, k: number): number {
  const t = Math.max(0, Math.min(1, k));
  switch (kind) {
    case 'linear':
      return t;
    case 'in':
      return t * t;
    case 'out':
      return 1 - (1 - t) * (1 - t);
    default:
      return 0.5 - Math.cos(Math.PI * t) / 2;
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Angles rotate the short way round (170° → -170° passes through 180°, not 0°). */
export const lerpAngle = (a: number, b: number, k: number) => {
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * k;
};
const lerpLimb = (a: Limb, b: Limb, k: number): Limb => [lerpAngle(a[0], b[0], k), lerpAngle(a[1], b[1], k)];
const lerpOpt = (a: number | undefined, b: number | undefined, k: number, fallback: number) =>
  a === undefined && b === undefined ? undefined : lerpAngle(a ?? fallback, b ?? fallback, k);

export function interpolatePose(a: Pose, b: Pose, k: number): Pose {
  return {
    x: lerp(a.x ?? 50, b.x ?? 50, k),
    lift: lerp(a.lift ?? 0, b.lift ?? 0, k),
    anchorY: a.anchorY === undefined && b.anchorY === undefined ? undefined : lerp(a.anchorY ?? b.anchorY!, b.anchorY ?? a.anchorY!, k),
    torso: lerpAngle(a.torso, b.torso, k),
    head: lerpAngle(a.head ?? a.torso, b.head ?? b.torso, k),
    spine: a.spine === undefined && b.spine === undefined ? undefined : lerp(a.spine ?? 0, b.spine ?? 0, k),
    armL: lerpLimb(a.armL, b.armL, k),
    armR: lerpLimb(a.armR, b.armR, k),
    legL: lerpLimb(a.legL, b.legL, k),
    legR: lerpLimb(a.legR, b.legR, k),
    footL: lerpOpt(a.footL, b.footL, k, defaultFoot(lerp(a.legL[1], b.legL[1], k))),
    footR: lerpOpt(a.footR, b.footR, k, defaultFoot(lerp(a.legR[1], b.legR[1], k))),
  };
}

// ---------------------------------------------------------------------------
// Motions
// ---------------------------------------------------------------------------

export type Prop =
  | { kind: 'bar'; y: number; x1?: number; x2?: number }
  | { kind: 'bench'; x: number; width: number; height: number }
  | { kind: 'box'; x: number; width: number; height: number }
  | { kind: 'wall'; x: number }
  | { kind: 'mat' }
  | { kind: 'dumbbell'; hands: 'L' | 'R' | 'both' }
  | { kind: 'kettlebell'; hands: 'both' | 'R' }
  | { kind: 'rope' }
  | { kind: 'band'; hands: 'both' };

export interface Keyframe {
  /** Position in the cycle, 0–1. */
  t: number;
  pose: Pose;
  /** Easing into this keyframe from the previous one. */
  ease?: Ease;
}

export interface Motion {
  view: View;
  /** Length of one repetition, ms. */
  durationMs: number;
  keyframes: Keyframe[];
  props?: Prop[];
  /** Cycle position used for still thumbnails (default 0.5). */
  thumbT?: number;
  /** Keep the authored x instead of re-centring the motion. */
  fixedX?: boolean;
}

/** Pose at cycle position t (0–1, wraps). */
export function samplePose(motion: Motion, t: number): Pose {
  const frames = motion.keyframes;
  if (frames.length === 1) return frames[0].pose;
  const k = ((t % 1) + 1) % 1;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (k >= a.t && k <= b.t) {
      const span = b.t - a.t || 1;
      return interpolatePose(a.pose, b.pose, ease(b.ease ?? 'inOut', (k - a.t) / span));
    }
  }
  // Between the last keyframe and the end of the cycle, blend back to the first.
  const last = frames[frames.length - 1];
  const first = frames[0];
  const span = 1 - last.t + first.t || 1;
  return interpolatePose(last.pose, first.pose, ease(first.ease ?? 'inOut', (k - last.t) / span));
}

function propBounds(motion: Motion): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const p of motion.props ?? []) {
    if (p.kind === 'bench' || p.kind === 'box') {
      min = Math.min(min, p.x);
      max = Math.max(max, p.x + p.width);
    } else if (p.kind === 'wall') {
      min = Math.min(min, p.x);
      max = Math.max(max, p.x);
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Horizontal offset that centres the motion (figure + props) in the view box. */
export function centreOffset(motion: Motion): number {
  if (motion.fixedX) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= 12; i++) {
    const j = solvePose(samplePose(motion, i / 12), motion.view);
    for (const p of Object.values(j)) {
      min = Math.min(min, p.x);
      max = Math.max(max, p.x);
    }
    min = Math.min(min, j.head.x - SEGMENT.headR);
    max = Math.max(max, j.head.x + SEGMENT.headR);
  }
  const props = propBounds(motion);
  if (props) {
    min = Math.min(min, props.min);
    max = Math.max(max, props.max);
  }
  return VIEWBOX / 2 - (min + max) / 2;
}

// ---------------------------------------------------------------------------
// Drawing primitives shared by the React Native renderer and the SVG exporter
// ---------------------------------------------------------------------------

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  /** 0 = far side (drawn dimmer, behind), 1 = body, 2 = near side. */
  layer: 0 | 1 | 2;
}

export interface FigureFrame {
  lines: Line[];
  head: { cx: number; cy: number; r: number };
  props: PropShape[];
}

export type PropShape =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'path'; d: string; width: number };

const seg = (a: Point, b: Point, width: number, layer: Line['layer']): Line => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, width, layer });

function dumbbellAt(p: Point, angle: number): PropShape[] {
  const d = dir(angle + 90);
  const half = 4;
  const a = { x: p.x - d.x * half, y: p.y - d.y * half };
  const b = { x: p.x + d.x * half, y: p.y + d.y * half };
  return [
    { type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: 1.6 },
    { type: 'circle', cx: a.x, cy: a.y, r: 2.2 },
    { type: 'circle', cx: b.x, cy: b.y, r: 2.2 },
  ];
}

function propShapes(motion: Motion, j: Joints, t: number, dx: number): PropShape[] {
  const out: PropShape[] = [];
  for (const p of motion.props ?? []) {
    switch (p.kind) {
      case 'bar':
        out.push({ type: 'line', x1: (p.x1 ?? 18) + (p.x1 !== undefined ? dx : 0), y1: p.y, x2: (p.x2 ?? 82) + (p.x2 !== undefined ? dx : 0), y2: p.y, width: 2 });
        break;
      case 'bench':
      case 'box':
        out.push({ type: 'rect', x: p.x + dx, y: GROUND_Y - p.height, width: p.width, height: p.height, rx: 1.5 });
        break;
      case 'wall':
        out.push({ type: 'line', x1: p.x + dx, y1: 6, x2: p.x + dx, y2: GROUND_Y, width: 2 });
        break;
      case 'mat':
        out.push({ type: 'rect', x: 8, y: GROUND_Y - 1, width: 84, height: 2, rx: 1 });
        break;
      case 'dumbbell': {
        const forearmL = Math.atan2(j.wristL.x - j.elbowL.x, j.wristL.y - j.elbowL.y) * (180 / Math.PI);
        const forearmR = Math.atan2(j.wristR.x - j.elbowR.x, j.wristR.y - j.elbowR.y) * (180 / Math.PI);
        if (p.hands !== 'R') out.push(...dumbbellAt(j.wristL, forearmL));
        if (p.hands !== 'L') out.push(...dumbbellAt(j.wristR, forearmR));
        break;
      }
      case 'kettlebell': {
        // The bell hangs in line with the forearms: below the hands when the arms hang,
        // in front at the top of a swing, above the hands when held bottom-up (halo).
        const unit = (a: Point, b: Point): Point => {
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
        };
        const fR = unit(j.elbowR, j.wristR);
        let hand = j.wristR;
        let along = fR;
        if (p.hands !== 'R') {
          const fL = unit(j.elbowL, j.wristL);
          hand = { x: (j.wristL.x + j.wristR.x) / 2, y: (j.wristL.y + j.wristR.y) / 2 };
          const sum = { x: fL.x + fR.x, y: fL.y + fR.y };
          const len = Math.hypot(sum.x, sum.y);
          along = len > 0.2 ? { x: sum.x / len, y: sum.y / len } : { x: 0, y: 1 };
        }
        const perp = { x: -along.y, y: along.x };
        const at = (a: number, b: number) => `${(hand.x + along.x * a + perp.x * b).toFixed(2)} ${(hand.y + along.y * a + perp.y * b).toFixed(2)}`;
        out.push({ type: 'circle', cx: hand.x + along.x * 4.6, cy: hand.y + along.y * 4.6, r: 3.6 });
        out.push({ type: 'path', d: `M ${at(2, 2.2)} Q ${at(-1.5, 0)} ${at(2, -2.2)}`, width: 1.4 });
        break;
      }
      case 'rope': {
        // One full turn of the rope per cycle: under the feet at t=0, over the head at t=0.5.
        const mid = { x: (j.wristL.x + j.wristR.x) / 2, y: (j.wristL.y + j.wristR.y) / 2 };
        const top = j.head.y - SEGMENT.headR - 4;
        const bottom = Math.max(j.toeL.y, j.toeR.y) + 2;
        const theta = 2 * Math.PI * t;
        const apexY = (top + bottom) / 2 + ((bottom - top) / 2) * Math.cos(theta);
        if (motion.view === 'front') {
          // Cubic through the apex whose handles bow outward, so the rope arcs around the body.
          const d = (apexY - mid.y) * (4 / 3);
          const bow = 5;
          const f = (n: number) => n.toFixed(2);
          out.push({
            type: 'path',
            d: `M ${f(j.wristL.x)} ${f(j.wristL.y)} C ${f(j.wristL.x - bow)} ${f(j.wristL.y + d)} ${f(j.wristR.x + bow)} ${f(j.wristR.y + d)} ${f(j.wristR.x)} ${f(j.wristR.y)}`,
            width: 1.6,
          });
        } else {
          const apexX = mid.x + 12 * Math.sin(theta);
          const spread = 5;
          out.push({
            type: 'path',
            d: `M ${j.wristL.x} ${j.wristL.y} Q ${apexX + spread} ${(mid.y + apexY) / 2} ${apexX} ${apexY} Q ${apexX - spread} ${(mid.y + apexY) / 2} ${j.wristR.x} ${j.wristR.y}`,
            width: 1.6,
          });
        }
        break;
      }
      case 'band':
        out.push({ type: 'line', x1: j.wristL.x, y1: j.wristL.y, x2: j.wristR.x, y2: j.wristR.y, width: 1.4 });
        break;
    }
  }
  return out;
}


/** Everything needed to draw one frame of a motion. */
export function frameAt(motion: Motion, t: number, offsetX = centreOffset(motion)): FigureFrame {
  const pose = samplePose(motion, t);
  const raw = solvePose(pose, motion.view);
  const j = shift(raw, offsetX, 0);
  const far: Line['layer'] = motion.view === 'side' ? 0 : 2;
  const lines: Line[] = [
    seg(j.hipL, j.kneeL, STROKE.limb, far),
    seg(j.kneeL, j.ankleL, STROKE.limb, far),
    seg(j.ankleL, j.toeL, STROKE.foot, far),
    seg(j.shoulderL, j.elbowL, STROKE.limb, far),
    seg(j.elbowL, j.wristL, STROKE.limb, far),
    // The torso is always two segments (straight when the spine is neutral) so the line count is stable.
    seg(j.hip, j.spine, STROKE.torso, 1),
    seg(j.spine, j.neck, STROKE.torso, 1),
    seg(j.hipR, j.kneeR, STROKE.limb, 2),
    seg(j.kneeR, j.ankleR, STROKE.limb, 2),
    seg(j.ankleR, j.toeR, STROKE.foot, 2),
    seg(j.shoulderR, j.elbowR, STROKE.limb, 2),
    seg(j.elbowR, j.wristR, STROKE.limb, 2),
  ];
  if (motion.view === 'front') {
    lines.push(seg(j.shoulderL, j.shoulderR, STROKE.limb, 1));
    lines.push(seg(j.hipL, j.hipR, STROKE.limb, 1));
  }
  return {
    lines: lines.sort((a, b) => a.layer - b.layer),
    head: { cx: j.head.x, cy: j.head.y, r: SEGMENT.headR },
    props: propShapes(motion, j, t, offsetX),
  };
}

/** Standalone SVG markup for a frame (used by the motion contact-sheet script and tests). */
export function frameToSvg(frame: FigureFrame, opts: { size?: number; color?: string; dim?: string; prop?: string; background?: string } = {}): string {
  const size = opts.size ?? 120;
  const color = opts.color ?? '#4ECDC4';
  const dim = opts.dim ?? '#2E7F79';
  const prop = opts.prop ?? '#6B7280';
  const bg = opts.background ?? '#1C2230';
  const f = (n: number) => n.toFixed(2);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">`,
    `<rect width="100" height="100" rx="10" fill="${bg}"/>`,
    `<line x1="6" y1="${GROUND_Y}" x2="94" y2="${GROUND_Y}" stroke="${prop}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`,
  ];
  for (const p of frame.props) {
    if (p.type === 'line') parts.push(`<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke="${prop}" stroke-width="${p.width}" stroke-linecap="round"/>`);
    if (p.type === 'rect') parts.push(`<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.width)}" height="${f(p.height)}" rx="${p.rx}" fill="${prop}" opacity="0.7"/>`);
    if (p.type === 'circle') parts.push(`<circle cx="${f(p.cx)}" cy="${f(p.cy)}" r="${p.r}" fill="${prop}"/>`);
    if (p.type === 'path') parts.push(`<path d="${p.d}" stroke="${prop}" stroke-width="${p.width}" fill="none" stroke-linecap="round"/>`);
  }
  for (const l of frame.lines) {
    parts.push(`<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}" stroke="${l.layer === 0 ? dim : color}" stroke-width="${l.width}" stroke-linecap="round"/>`);
  }
  parts.push(`<circle cx="${f(frame.head.cx)}" cy="${f(frame.head.cy)}" r="${frame.head.r}" fill="${color}"/>`);
  parts.push('</svg>');
  return parts.join('');
}
