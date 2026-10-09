import {
  GROUND_Y,
  SEGMENT,
  STROKE,
  ease as easeAt,
  interpolatePose,
  lerpAngle,
  lowestPoint,
  solveRaw,
  type Ease,
  type Keyframe,
  type Limb,
  type Motion,
  type Point,
  type Pose,
  type Prop,
  type View,
} from './skeleton';

/**
 * Reusable poses and the authoring kit for exercise motions.
 * Side view faces right. Angles: 0 down, 90 forward, 180 up, -90 back.
 */

export const STAND: Pose = { torso: 180, armL: [6, 10], armR: [-6, -2], legL: [0, 0], legR: [0, 0] };
export const STAND_FRONT: Pose = { torso: 180, armL: [-12, -8], armR: [12, 8], legL: [-4, -2], legR: [4, 2] };

export const SQUAT_BOTTOM: Pose = { torso: 145, head: 160, armL: [95, 92], armR: [100, 96], legL: [80, -28], legR: [84, -24] };
export const HALF_SQUAT: Pose = { torso: 158, head: 168, armL: [70, 80], armR: [74, 84], legL: [45, -20], legR: [48, -18] };

/** High plank, head to the right. */
export const PLANK_HIGH: Pose = { torso: 100, head: 105, armL: [2, 2], armR: [-2, -2], legL: [-80, -80], legR: [-78, -78] };
export const PLANK_LOW: Pose = { torso: 95, head: 100, armL: [-145, 25], armR: [-140, 22], legL: [-85, -85], legR: [-84, -84] };
export const FOREARM_PLANK: Pose = { torso: 98, head: 103, armL: [8, 90], armR: [4, 90], legL: [-82, -82], legR: [-81, -81] };

/** Lying on the back, head to the right. */
export const SUPINE: Pose = { torso: 90, head: 92, armL: [-90, -90], armR: [-88, -88], legL: [-90, -90], legR: [-89, -89] };
/** Lying face down, head to the right. */
export const PRONE: Pose = { torso: 90, head: 95, armL: [100, 100], armR: [98, 98], legL: [-90, -90], legR: [-89, -89] };

export const HANG: Pose = { torso: 180, head: 180, armL: [180, 180], armR: [178, 178], legL: [2, -2], legR: [-2, 2] };

export function pose(base: Pose, overrides: Partial<Pose>): Pose {
  return { ...base, ...overrides };
}

export function limb(a: number, b: number): Limb {
  return [a, b];
}

/** Mirrors a front-view pose's limbs (left becomes right). */
export function mirror(p: Pose): Pose {
  return {
    ...p,
    armL: [-p.armR[0], -p.armR[1]],
    armR: [-p.armL[0], -p.armL[1]],
    legL: [-p.legR[0], -p.legR[1]],
    legR: [-p.legL[0], -p.legL[1]],
  };
}

/** Builds a looping motion from evenly spaced poses (the first pose closes the loop). */
export function cycle(view: View, durationMs: number, poses: Pose[], extra: { props?: Prop[]; thumbT?: number; fixedX?: boolean; ease?: Keyframe['ease'] } = {}): Motion {
  const keyframes: Keyframe[] = poses.map((p, i) => ({ t: i / poses.length, pose: p, ease: extra.ease }));
  return { view, durationMs, keyframes, props: extra.props, thumbT: extra.thumbT, fixedX: extra.fixedX };
}

/** A hold: a tiny breathing sway so the figure never looks frozen. */
export function hold(view: View, p: Pose, sway: Partial<Pose> = {}, props?: Prop[]): Motion {
  return cycle(view, 3200, [p, { ...p, ...sway }], { props, thumbT: 0 });
}

// ---------------------------------------------------------------------------
// World-space authoring kit
// ---------------------------------------------------------------------------

/** y of a wrist/ankle/knee/elbow centre resting on the floor. */
export const FLOOR = GROUND_Y - STROKE.limb / 2;
/** y of the hip (or shoulders) resting on the floor. */
export const SEAT = GROUND_Y - STROKE.torso / 2;
/** Hip height when standing tall on flat feet. */
export const STAND_Y = FLOOR - SEGMENT.thigh - SEGMENT.shin;
/** y of a hand/foot resting on top of a bench or box of the given height. */
export const onTop = (height: number) => GROUND_Y - height - STROKE.limb / 2;

/**
 * Where a hand or foot should be, in world coordinates (viewBox units, floor at GROUND_Y).
 * `bend` picks the elbow/knee side (+1 rotates the first segment toward larger angles).
 * Defaults: side view knees forward and elbows flexing naturally; front view elbows/knees out.
 * With `foot` (side view legs), (x, y) is the toe and `foot` the foot angle.
 */
export interface Target {
  x: number;
  y: number;
  bend?: 1 | -1;
  foot?: number;
}

export type LimbSpec = Limb | Target;

/** A pose described in world space; any limb may be a target solved with two-bone IK. */
export interface Body {
  /** Hip x. */
  x: number;
  /** Hip y. Omit to let the solver ground the figure (only when no limb is a target). */
  y?: number;
  /** With no hip y: height of the lowest point above the floor (jumps). */
  air?: number;
  torso: number;
  head?: number;
  spine?: number;
  armL: LimbSpec;
  armR: LimbSpec;
  legL: LimbSpec;
  legR: LimbSpec;
  footL?: number;
  footR?: number;
  /** Hanging: pin the hands at exactly this y instead of grounding (blends linearly). */
  anchorY?: number;
  /**
   * A planted point the hip swings around (e.g. the ankle of a straight-legged plank).
   * When both blended bodies have one, the hip travels on an arc instead of a straight line.
   */
  pivot?: Point;
}

const RAD = Math.PI / 180;
const dirOf = (deg: number): Point => ({ x: Math.sin(deg * RAD), y: Math.cos(deg * RAD) });
const along = (p: Point, deg: number, len: number): Point => {
  const d = dirOf(deg);
  return { x: p.x + d.x * len, y: p.y + d.y * len };
};
const angleTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.y - from.y) / RAD;
const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const isTarget = (s: LimbSpec): s is Target => !Array.isArray(s);

/** Two-bone IK: angles of [first, second] segment reaching from root toward target. */
export function reach(root: Point, target: Point, l1: number, l2: number, bend: 1 | -1): Limb {
  const dist = clamp(Math.hypot(target.x - root.x, target.y - root.y), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const phi = angleTo(root, target);
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const a1 = phi + bend * (Math.acos(clamp(cosA, -1, 1)) / RAD);
  const joint = along(root, a1, l1);
  const end = along(root, phi, dist);
  return [norm(a1), norm(angleTo(joint, end))];
}

type Kind = 'arm' | 'leg';
type Side = 'L' | 'R';

function solveLimb(spec: LimbSpec, root: Point, kind: Kind, side: Side, view: View): Limb {
  if (!isTarget(spec)) return spec;
  const l1 = kind === 'arm' ? SEGMENT.upperArm : SEGMENT.thigh;
  const l2 = kind === 'arm' ? SEGMENT.forearm : SEGMENT.shin;
  let end: Point = spec;
  if (kind === 'leg' && spec.foot !== undefined && view === 'side') end = along(spec, spec.foot, -SEGMENT.foot);
  if (spec.bend) return reach(root, end, l1, l2, spec.bend);
  if (view === 'side') return reach(root, end, l1, l2, kind === 'arm' ? -1 : 1);
  // Front view: elbows and knees point outward.
  const a = reach(root, end, l1, l2, 1);
  const b = reach(root, end, l1, l2, -1);
  const xa = along(root, a[0], l1).x;
  const xb = along(root, b[0], l1).x;
  return (side === 'L') === (xa < xb) ? a : b;
}

const footOf = (spec: LimbSpec, explicit: number | undefined, view: View) =>
  explicit ?? (isTarget(spec) && view === 'side' ? spec.foot : undefined);

/** Pose angles for a body placed at hip y (no grounding information). */
function anglesOf(view: View, b: Body, y: number): Pose {
  const hip = { x: b.x, y };
  const neck = along(hip, b.torso, SEGMENT.torso);
  let sL = neck;
  let sR = neck;
  let hL = hip;
  let hR = hip;
  if (view === 'front') {
    const across = b.torso - 90;
    sL = along(neck, across, -SEGMENT.shoulderHalf);
    sR = along(neck, across, SEGMENT.shoulderHalf);
    hL = along(hip, across, -SEGMENT.hipHalf);
    hR = along(hip, across, SEGMENT.hipHalf);
  }
  const p: Pose = {
    x: b.x,
    torso: b.torso,
    armL: solveLimb(b.armL, sL, 'arm', 'L', view),
    armR: solveLimb(b.armR, sR, 'arm', 'R', view),
    legL: solveLimb(b.legL, hL, 'leg', 'L', view),
    legR: solveLimb(b.legR, hR, 'leg', 'R', view),
  };
  if (b.head !== undefined) p.head = b.head;
  if (b.spine) p.spine = b.spine;
  const fL = footOf(b.legL, b.footL, view);
  const fR = footOf(b.legR, b.footR, view);
  if (fL !== undefined) p.footL = fL;
  if (fR !== undefined) p.footR = fR;
  return p;
}

/** Hip height of a body: its own y, or where the solver would ground it. */
function worldY(view: View, b: Body): number {
  if (b.y !== undefined) return b.y;
  if ([b.armL, b.armR, b.legL, b.legR].some(isTarget)) throw new Error('A body with IK targets needs a hip y');
  return GROUND_Y - (b.air ?? 0) - lowestPoint(solveRaw(anglesOf(view, b, 0), view));
}

/** Converts a world-space body into a Pose that reproduces it (via lift, or anchorY when hanging). */
export function solveBody(view: View, b: Body): Pose {
  const p = anglesOf(view, b, b.y ?? 0);
  if (b.anchorY !== undefined) {
    p.anchorY = b.anchorY;
    return p;
  }
  if (b.y === undefined) {
    worldY(view, b); // validates: a grounded body can't have IK targets
    if (b.air) p.lift = b.air;
    return p;
  }
  const raw = solveRaw(p, view);
  const lift = GROUND_Y - (b.y + lowestPoint(raw));
  if (lift > 0.3) p.lift = Math.round(lift * 100) / 100;
  return p;
}

/** World positions of a body's joints (to place props or line things up while authoring). */
export function jointsOf(view: View, b: Body): Record<string, Point> {
  const y = worldY(view, b);
  const raw = solveRaw(anglesOf(view, b, y), view);
  const out: Record<string, Point> = {};
  for (const [name, pt] of Object.entries(raw)) out[name] = { x: pt.x, y: pt.y + y };
  return out;
}

function mixLimb(a: LimbSpec, b: LimbSpec, k: number, angles: Limb): LimbSpec {
  if (!isTarget(a) || !isTarget(b) || (a.foot === undefined) !== (b.foot === undefined)) return angles;
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    bend: b.bend ?? a.bend,
    foot: a.foot === undefined || b.foot === undefined ? undefined : lerpAngle(a.foot, b.foot, k),
  };
}

interface Resolved {
  body: Body;
  y: number;
  angles: Pose;
}
const resolve = (view: View, body: Body): Resolved => {
  const y = worldY(view, body);
  return { body, y, angles: anglesOf(view, body, y) };
};

function blendResolved(view: View, ra: Resolved, rb: Resolved, k: number): Pose {
  const { body: a, y: ya } = ra;
  const { body: b, y: yb } = rb;
  const base = interpolatePose(ra.angles, rb.angles, k);
  let hx = lerp(a.x, b.x, k);
  let hy = lerp(ya, yb, k);
  if (a.pivot && b.pivot) {
    const pv = { x: lerp(a.pivot.x, b.pivot.x, k), y: lerp(a.pivot.y, b.pivot.y, k) };
    const da = Math.hypot(a.x - a.pivot.x, ya - a.pivot.y);
    const db = Math.hypot(b.x - b.pivot.x, yb - b.pivot.y);
    const h = along(pv, lerpAngle(angleTo(a.pivot, { x: a.x, y: ya }), angleTo(b.pivot, { x: b.x, y: yb }), k), lerp(da, db, k));
    hx = h.x;
    hy = h.y;
  }
  const grounded = a.y === undefined && b.y === undefined && !(a.pivot && b.pivot);
  const legL = mixLimb(a.legL, b.legL, k, base.legL);
  const legR = mixLimb(a.legR, b.legR, k, base.legR);
  const mixed: Body = {
    x: hx,
    y: grounded ? undefined : hy,
    air: grounded ? lerp(a.air ?? 0, b.air ?? 0, k) : undefined,
    torso: base.torso,
    head: base.head,
    spine: base.spine,
    armL: mixLimb(a.armL, b.armL, k, base.armL),
    armR: mixLimb(a.armR, b.armR, k, base.armR),
    legL,
    legR,
    footL: isTarget(legL) && legL.foot !== undefined ? undefined : base.footL,
    footR: isTarget(legR) && legR.foot !== undefined ? undefined : base.footR,
    anchorY: a.anchorY !== undefined && b.anchorY !== undefined ? lerp(a.anchorY, b.anchorY, k) : undefined,
    pivot: a.pivot && b.pivot ? { x: lerp(a.pivot.x, b.pivot.x, k), y: lerp(a.pivot.y, b.pivot.y, k) } : undefined,
  };
  return solveBody(view, mixed);
}

/** Blends two bodies in world space, re-solving IK so planted hands and feet stay put. */
export function blendBodies(view: View, a: Body, b: Body, k: number): Pose {
  return blendResolved(view, resolve(view, a), resolve(view, b), k);
}

export interface BodyKey {
  t: number;
  body: Body;
  /** Easing into this key from the previous one (default inOut). */
  ease?: Ease;
}

export const key = (t: number, body: Body, ease?: Ease): BodyKey => ({ t, body, ease });

export interface MotionExtra {
  props?: Prop[];
  thumbT?: number;
  fixedX?: boolean;
  /** Sub-keyframes per full cycle used to keep IK contacts planted (default 32). */
  density?: number;
}

/**
 * Builds a looping motion from world-space keys (first key at t=0; the last key flows back
 * into the first). Each segment is subdivided and re-solved so contacts don't slide.
 */
export function animate(view: View, durationMs: number, keys: BodyKey[], extra: MotionExtra = {}): Motion {
  if (keys.length === 0 || keys[0].t !== 0) throw new Error('animate: the first key must be at t=0');
  keys.forEach((k, i) => {
    if (i > 0 && k.t <= keys[i - 1].t) throw new Error('animate: key times must increase');
    if (k.t >= 1) throw new Error('animate: key times must be below 1');
  });
  const density = extra.density ?? 32;
  const build = (): Keyframe[] => {
    const resolved = keys.map((k) => resolve(view, k.body));
    const keyframes: Keyframe[] = [];
    keys.forEach((a, i) => {
      const j = (i + 1) % keys.length;
      const t1 = i + 1 < keys.length ? keys[j].t : 1;
      const steps = Math.max(2, Math.ceil((t1 - a.t) * density));
      for (let s = 0; s < steps; s++) {
        const k = s / steps;
        const pose = s === 0 ? solveBody(view, a.body) : blendResolved(view, resolved[i], resolved[j], easeAt(keys[j].ease ?? 'inOut', k));
        keyframes.push({ t: a.t + (t1 - a.t) * k, pose, ease: 'linear' });
      }
    });
    return keyframes;
  };
  // Keyframes are solved on first use, so importing the motion table stays cheap at app start.
  let cache: Keyframe[] | undefined;
  return {
    view,
    durationMs,
    props: extra.props,
    thumbT: extra.thumbT ?? 0.5,
    fixedX: extra.fixedX,
    get keyframes() {
      return (cache ??= build());
    },
    set keyframes(value: Keyframe[]) {
      cache = value;
    },
  };
}

/** Evenly spaced keys. */
export function loop(view: View, durationMs: number, bodies: Body[], extra: MotionExtra & { ease?: Ease } = {}): Motion {
  return animate(
    view,
    durationMs,
    bodies.map((b, i) => key(i / bodies.length, b, extra.ease)),
    extra,
  );
}

/** A held position with a slow breathing sway between two bodies. */
export function holdBody(view: View, a: Body, b: Body, extra: MotionExtra & { durationMs?: number } = {}): Motion {
  return animate(view, extra.durationMs ?? 4000, [key(0, a), key(0.5, b)], { thumbT: 0, ...extra });
}

/** Shifts a body horizontally so that one of its joints lands on x. */
export function alignX(view: View, b: Body, joint: string, x: number): Body {
  const j = jointsOf(view, b);
  const dx = x - j[joint].x;
  const move = (s: LimbSpec): LimbSpec => (isTarget(s) ? { ...s, x: s.x + dx } : s);
  return {
    ...b,
    x: b.x + dx,
    armL: move(b.armL),
    armR: move(b.armR),
    legL: move(b.legL),
    legR: move(b.legR),
    pivot: b.pivot ? { x: b.pivot.x + dx, y: b.pivot.y } : undefined,
  };
}

/** Overrides for a body (shallow). */
export const tweak = (b: Body, o: Partial<Body>): Body => ({ ...b, ...o });

/**
 * Side-view limb angles relative to the torso.
 * Arm: flex 0 = hanging along the body, 90 = pointing forward, 180 = overhead; elbow bends forward.
 */
export const armRel = (torso: number, flex: number, elbow = 0): Limb => [norm(torso - 180 + flex), norm(torso - 180 + flex + elbow)];
/** Leg: flex 0 = in line with the torso, 90 = thigh forward; knee bends backward. */
export const legRel = (torso: number, flex: number, knee = 0): Limb => [norm(torso - 180 + flex), norm(torso - 180 + flex - knee)];

/** Neck position for a hip and torso angle. */
export const neckAt = (x: number, y: number, torso: number): Point => along({ x, y }, torso, SEGMENT.torso);
/** Hip position that puts the neck at (x, y) with the given torso angle. */
export const hipFor = (neck: Point, torso: number): Point => along(neck, torso, -SEGMENT.torso);
/** Point at distance `len` from `p` in direction `deg`. */
export const offset = along;
export { angleTo };

/** Swaps a front-view body's sides (mirror about the hip's vertical line). */
export function mirrorBody(b: Body): Body {
  const flipLimb = (s: LimbSpec): LimbSpec =>
    isTarget(s) ? { ...s, x: 2 * b.x - s.x, bend: s.bend ? ((-s.bend) as 1 | -1) : undefined } : [-s[0], -s[1]];
  return {
    ...b,
    torso: norm(360 - b.torso),
    head: b.head === undefined ? undefined : norm(360 - b.head),
    spine: b.spine === undefined ? undefined : -b.spine,
    armL: flipLimb(b.armR),
    armR: flipLimb(b.armL),
    legL: flipLimb(b.legR),
    legR: flipLimb(b.legL),
    footL: b.footR,
    footR: b.footL,
  };
}

/**
 * A straight-legged body hinged at the hip, from a planted ankle (or knee, with `lower` = thigh)
 * up to the neck. The hip is found with IK (bend +1 piks the hips up when the span is short).
 */
export function spanFrom(root: Point, neck: Point, lower: number = SEGMENT.thigh + SEGMENT.shin, bend: 1 | -1 = 1) {
  const [toHip, torso] = reach(root, neck, lower, SEGMENT.torso, bend);
  const hip = along(root, toHip, lower);
  return { x: hip.x, y: hip.y, torso, legAngle: norm(toHip + 180), pivot: root };
}

/** A straight-legged hip placed at `angle` from a planted ankle (with the ankle as pivot). */
export function hipFrom(ankle: Point, angle: number, lower: number = SEGMENT.thigh + SEGMENT.shin) {
  const hip = along(ankle, angle, lower);
  return { x: hip.x, y: hip.y, legAngle: norm(angle + 180), pivot: ankle };
}

/** A straight line from the ankle at `angle` (plank-like); returns hip, torso and leg angle. */
export function lineFrom(ankle: Point, angle: number, lower: number = SEGMENT.thigh + SEGMENT.shin) {
  const hip = along(ankle, angle, lower);
  return { x: hip.x, y: hip.y, torso: norm(angle), legAngle: norm(angle + 180), neck: along(hip, angle, SEGMENT.torso), pivot: ankle };
}
