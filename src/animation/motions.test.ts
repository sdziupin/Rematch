import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_FALLBACK, MOTIONS, getMotion, hasDedicatedMotion } from './motions';
import { GROUND_Y, VIEWBOX, centreOffset, frameAt, lowestPoint, samplePose, solvePose } from './skeleton';
import { EXERCISE_SEEDS } from '../content/exercises';

const EXISTING = [
  'wall-push-up', 'knee-push-up', 'push-up', 'decline-push-up', 'pike-push-up', 'diamond-push-up', 'air-squat', 'jump-squat',
  'walking-lunge', 'reverse-lunge', 'jumping-lunge', 'burpee', 'half-burpee', 'mountain-climber', 'plank-hold', 'side-plank',
  'sit-up', 'bicycle-crunch', 'leg-raise', 'v-up', 'hollow-hold', 'superman-hold', 'glute-bridge', 'single-leg-bridge',
  'high-knees', 'butt-kicks', 'jumping-jack', 'seal-jack', 'skater-hop', 'step-up', 'calf-raise', 'tricep-dip', 'bear-crawl',
  'crab-walk', 'inchworm', 'broad-jump', 'squat-hold', 'wall-sit', 'flutter-kick', 'russian-twist', 'dead-bug', 'bird-dog',
  'plank-jack', 'sprawl', 'squat-thrust', 'plank-to-push-up', 'side-shuffle', 'jump-rope', 'shoulder-tap', 'single-leg-deadlift',
  'cossack-squat', 'box-breather',
];

const ADDED = [
  'pull-up', 'chin-up', 'negative-pull-up', 'dead-hang', 'hanging-knee-raise', 'toes-to-bar',
  'goblet-squat', 'dumbbell-thruster', 'dumbbell-snatch', 'dumbbell-row', 'dumbbell-press', 'dumbbell-curl', 'dumbbell-lunge',
  'dumbbell-deadlift', 'renegade-row', 'devil-press', 'dumbbell-floor-press', 'lateral-raise', 'farmer-carry',
  'kettlebell-swing', 'kettlebell-deadlift', 'kettlebell-halo', 'band-pull-apart', 'bulgarian-split-squat', 'hip-thrust',
  'pistol-squat', 'lateral-lunge', 'curtsy-lunge', 'tuck-jump', 'star-jump', 'archer-push-up', 'hindu-push-up', 'hollow-rock',
  'reverse-plank', 'cat-cow', 'worlds-greatest-stretch', 'hip-flexor-stretch', 'downward-dog', 'child-pose', 'cobra-stretch',
  'arm-circles', 'leg-swings', 'open-book',
];

const SAMPLES = 24;
const MARGIN = 2;
const inView = (v: number) => v >= -MARGIN && v <= VIEWBOX + MARGIN;

test('every exercise has a dedicated motion', () => {
  const missing = [...EXISTING, ...ADDED].filter((id) => !hasDedicatedMotion(id));
  assert.deepEqual(missing, []);
});

test('every exercise in the content seed has a dedicated motion', () => {
  const missing = EXERCISE_SEEDS.map((e) => e.id).filter((id) => !hasDedicatedMotion(id));
  assert.deepEqual(missing, []);
});

test('category fallbacks point at real motions', () => {
  for (const [category, id] of Object.entries(CATEGORY_FALLBACK)) assert.ok(hasDedicatedMotion(id), `${category} -> ${id}`);
  assert.equal(getMotion('not-an-exercise', 'push'), MOTIONS['push-up']);
  assert.equal(getMotion('not-an-exercise'), MOTIONS['air-squat']);
  assert.equal(hasDedicatedMotion('toString'), false);
});

for (const [id, motion] of Object.entries(MOTIONS)) {
  test(`${id}: timing and keyframes are well formed`, () => {
    assert.ok(motion.durationMs >= 400 && motion.durationMs <= 6000, `durationMs ${motion.durationMs}`);
    assert.ok(motion.keyframes.length >= 1);
    let prev = -Infinity;
    for (const k of motion.keyframes) {
      assert.ok(k.t >= 0 && k.t < 1, `t=${k.t} outside [0, 1)`);
      assert.ok(k.t > prev, `t=${k.t} not after ${prev}`);
      prev = k.t;
    }
    const thumb = motion.thumbT ?? 0.5;
    assert.ok(thumb >= 0 && thumb < 1, `thumbT ${thumb}`);
  });

  test(`${id}: frames stay finite and inside the view box`, () => {
    const offset = centreOffset(motion);
    assert.ok(Number.isFinite(offset));
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / SAMPLES;
      const frame = frameAt(motion, t, offset);
      for (const l of frame.lines) {
        for (const v of [l.x1, l.y1, l.x2, l.y2]) {
          assert.ok(Number.isFinite(v), `NaN in a line at t=${t}`);
          assert.ok(inView(v), `line endpoint ${v.toFixed(2)} outside the view box at t=${t}`);
        }
      }
      const { cx, cy, r } = frame.head;
      assert.ok(Number.isFinite(cx) && Number.isFinite(cy), `NaN head at t=${t}`);
      for (const v of [cx - r, cx + r, cy - r, cy + r]) assert.ok(inView(v), `head edge ${v.toFixed(2)} outside the view box at t=${t}`);
      for (const p of frame.props) {
        const nums = p.type === 'path' ? (p.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number) : Object.values(p).filter((v): v is number => typeof v === 'number');
        for (const v of nums) assert.ok(Number.isFinite(v), `NaN in a ${p.type} prop at t=${t}`);
      }
    }
  });

  test(`${id}: grounded poses rest on the floor`, () => {
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / SAMPLES;
      const pose = samplePose(motion, t);
      const joints = solvePose(pose, motion.view);
      if (pose.anchorY !== undefined) {
        // Hanging: hands are pinned and nothing goes through the floor.
        assert.ok(Math.abs((joints.wristL.y + joints.wristR.y) / 2 - pose.anchorY) < 1e-6);
        assert.ok(lowestPoint(joints) <= GROUND_Y + 0.5, `${id} hangs through the floor at t=${t}`);
        continue;
      }
      const lift = pose.lift ?? 0;
      assert.ok(lift >= 0, `negative lift at t=${t}`);
      assert.ok(Math.abs(lowestPoint(joints) - (GROUND_Y - lift)) < 1e-6, `lowest point off the floor at t=${t}`);
    }
  });
}

test('every motion touches the floor at some point unless it hangs', () => {
  for (const [id, motion] of Object.entries(MOTIONS)) {
    const poses = Array.from({ length: SAMPLES }, (_, i) => samplePose(motion, i / SAMPLES));
    if (poses.every((p) => p.anchorY !== undefined)) continue;
    assert.ok(
      poses.some((p) => (p.lift ?? 0) < 0.5),
      `${id} never lands`,
    );
  }
});
