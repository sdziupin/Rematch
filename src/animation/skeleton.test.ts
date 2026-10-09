import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_Y, frameAt, interpolatePose, lerpAngle, lowestPoint, solvePose, type Motion, type Pose } from './skeleton';
import { STAND, STAND_FRONT, reach } from './poses';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('lerpAngle takes the short way round', () => {
  assert.ok(close(lerpAngle(170, -170, 0.5), 180) || close(lerpAngle(170, -170, 0.5), -180));
  assert.ok(close(lerpAngle(-170, 170, 0.5) % 360, -180));
  assert.ok(close(lerpAngle(10, 350, 0.5), 0));
  assert.ok(close(lerpAngle(0, 90, 0.25), 22.5));
  assert.ok(close(lerpAngle(45, 45, 0.7), 45));
});

test('grounding puts the lowest point on the floor (and lift raises it)', () => {
  const crouch: Pose = { torso: 140, armL: [90, 90], armR: [90, 90], legL: [80, -30], legR: [82, -28] };
  for (const p of [STAND, crouch]) assert.ok(close(lowestPoint(solvePose(p)), GROUND_Y));
  assert.ok(close(lowestPoint(solvePose({ ...STAND, lift: 7 })), GROUND_Y - 7));
});

test('anchorY pins the hands', () => {
  const hang: Pose = { torso: 180, armL: [180, 180], armR: [178, 178], legL: [5, -20], legR: [0, -25], anchorY: 12 };
  const j = solvePose(hang);
  assert.ok(close((j.wristL.y + j.wristR.y) / 2, 12));
  assert.ok(j.hip.y > 12);
});

test('front view: L limbs are on screen-left', () => {
  const j = solvePose(STAND_FRONT, 'front');
  assert.ok(j.shoulderL.x < j.shoulderR.x);
  assert.ok(j.hipL.x < j.hipR.x);
  assert.ok(j.toeL.x < j.ankleL.x && j.toeR.x > j.ankleR.x);
});

test('spine curve moves the mid-back without moving hip or neck', () => {
  const flat = solvePose({ ...STAND, x: 50 });
  const round = solvePose({ ...STAND, x: 50, spine: 40 });
  assert.ok(close(flat.spine.x, flat.hip.x));
  assert.ok(round.spine.x < flat.spine.x, 'positive spine rounds toward the back of a right-facing figure');
  assert.ok(close(round.neck.x, flat.neck.x) && close(round.neck.y - round.hip.y, flat.neck.y - flat.hip.y));
  const mid = interpolatePose({ ...STAND }, { ...STAND, spine: 40 }, 0.5);
  assert.ok(close(mid.spine ?? 0, 20));
});

test('two-bone reach lands on reachable targets and bends the chosen way', () => {
  const root = { x: 0, y: 0 };
  const target = { x: 6, y: 14 };
  for (const bend of [1, -1] as const) {
    const [a, b] = reach(root, target, 16, 15, bend);
    const rad = Math.PI / 180;
    const end = { x: 16 * Math.sin(a * rad) + 15 * Math.sin(b * rad), y: 16 * Math.cos(a * rad) + 15 * Math.cos(b * rad) };
    assert.ok(close(end.x, target.x, 1e-6) && close(end.y, target.y, 1e-6));
  }
  const [knee] = reach(root, target, 16, 15, 1);
  assert.ok(knee > Math.atan2(6, 14) / (Math.PI / 180), 'bend +1 rotates the first segment to larger angles');
});

test('frames have a stable line count and props follow the hands', () => {
  const motion: Motion = {
    view: 'side',
    durationMs: 1000,
    keyframes: [
      { t: 0, pose: { ...STAND, armR: [0, 0], armL: [0, 0] } },
      { t: 0.5, pose: { ...STAND, armR: [90, 90], armL: [90, 90], spine: 20 } },
    ],
    props: [{ kind: 'kettlebell', hands: 'both' }],
  };
  const down = frameAt(motion, 0, 0);
  const up = frameAt(motion, 0.5, 0);
  assert.equal(down.lines.length, up.lines.length);
  const bellDown = down.props.find((p) => p.type === 'circle');
  const bellUp = up.props.find((p) => p.type === 'circle');
  assert.ok(bellDown && bellDown.type === 'circle' && bellUp && bellUp.type === 'circle');
  // Hanging arms: bell below the hands. Arms forward: bell out in front of them.
  const jDown = solvePose(motion.keyframes[0].pose);
  const jUp = solvePose(motion.keyframes[1].pose);
  assert.ok(bellDown.cy > jDown.wristR.y + 3);
  assert.ok(bellUp.cx > jUp.wristR.x + 3 && Math.abs(bellUp.cy - jUp.wristR.y) < 2);
});
