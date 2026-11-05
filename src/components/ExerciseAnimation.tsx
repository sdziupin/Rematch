import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { getMotion } from '../animation/motions';
import { centreOffset, frameAt, GROUND_Y } from '../animation/skeleton';
import { colors, withAlpha } from '../theme';
import { useReducedMotionSetting } from './motion';

interface ExerciseAnimationProps {
  exerciseId: string;
  category?: string | null;
  size?: number;
  /** Animate (default) or show the representative still frame. */
  playing?: boolean;
  /** Tempo multiplier. */
  speed?: number;
  color?: string;
  background?: string | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Large demos draw at display rate; thumbnails don't need it. */
function fpsFor(size: number) {
  return size >= 120 ? 60 : 30;
}

/** True while the app is in the foreground. */
function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Original stick-figure demonstration of an exercise, drawn with SVG.
 *
 * The loop only runs while it can be seen: it stops when its screen loses focus (a
 * pushed screen or another tab), when the app goes to the background, and whenever the
 * OS asks for reduced motion, showing the representative still frame instead.
 */
export function ExerciseAnimation({
  exerciseId,
  category,
  size = 160,
  playing = true,
  speed = 1,
  color = colors.text,
  background = colors.surfaceRaised,
  style,
  accessibilityLabel,
}: ExerciseAnimationProps) {
  const motion = useMemo(() => getMotion(exerciseId, category ?? undefined), [exerciseId, category]);
  const offset = useMemo(() => centreOffset(motion), [motion]);
  const reduceMotion = useReducedMotionSetting();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const animate = playing && !reduceMotion && focused && appActive;
  const still = motion.thumbT ?? 0.5;
  const [t, setT] = useState(still);
  /** Phase carried across pauses and tempo changes, so the figure never jumps. */
  const phase = useRef(still);

  useEffect(() => {
    if (!animate) {
      // Playing was switched off on purpose: show the still. Off-screen: keep the pose.
      if (!playing || reduceMotion) {
        phase.current = still;
        setT(still);
      }
      return;
    }
    const frameMs = 1000 / fpsFor(size);
    let raf = 0;
    let lastNow: number | null = null;
    let lastFrame = 0;
    let elapsed = 0;
    let rendered = 0;
    const loop = (now: number) => {
      // Long gaps (a dropped frame burst, a debugger pause) don't fast-forward the figure.
      if (lastNow !== null) elapsed += Math.min(100, now - lastNow);
      lastNow = now;
      // Steady pacing: render on frame-index changes, not on "enough time has passed".
      const frame = Math.floor(elapsed / frameMs);
      if (frame !== lastFrame) {
        lastFrame = frame;
        // Advance by the real time since the last drawn frame, so a busy JS thread
        // drops frames instead of slowing the movement down.
        const next = (phase.current + ((elapsed - rendered) * speed) / motion.durationMs) % 1;
        rendered = elapsed;
        phase.current = next;
        setT(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, playing, reduceMotion, motion, speed, size, still]);

  // A new movement starts from its own still frame.
  useEffect(() => {
    phase.current = still;
    setT(still);
  }, [motion, still]);

  const frame = useMemo(() => frameAt(motion, t, offset), [motion, t, offset]);
  const dim = withAlpha(color, 0.32);
  const prop = colors.textMuted;

  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? `${exerciseId.replace(/-/g, ' ')} demonstration`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {background ? <Rect x="0" y="0" width="100" height="100" rx="14" fill={background} /> : null}
        <Line x1="6" y1={GROUND_Y} x2="94" y2={GROUND_Y} stroke={prop} strokeWidth={0.8} strokeLinecap="round" opacity={0.45} />
        {frame.props.map((p, i) => {
          if (p.type === 'line') return <Line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={prop} strokeWidth={p.width} strokeLinecap="round" />;
          if (p.type === 'rect') return <Rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} fill={prop} opacity={0.7} />;
          if (p.type === 'circle') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={prop} />;
          return <Path key={i} d={p.d} stroke={prop} strokeWidth={p.width} fill="none" strokeLinecap="round" />;
        })}
        {frame.lines.map((l, i) => (
          <Line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.layer === 0 ? dim : color} strokeWidth={l.width} strokeLinecap="round" />
        ))}
        <Circle cx={frame.head.cx} cy={frame.head.cy} r={frame.head.r} fill={color} />
      </Svg>
    </View>
  );
}
