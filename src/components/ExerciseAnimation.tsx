import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { getMotion } from '../animation/motions';
import { centreOffset, frameAt, GROUND_Y } from '../animation/skeleton';
import { colors, withAlpha } from '../theme';

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

const FPS = 30;

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduceMotion = v;
  })
  .catch(() => undefined);

/** Original stick-figure demonstration of an exercise, drawn with SVG. */
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
  const animate = playing && !reduceMotion;
  const [t, setT] = useState(motion.thumbT ?? 0.5);

  useEffect(() => {
    if (!animate) {
      setT(motion.thumbT ?? 0.5);
      return;
    }
    let raf = 0;
    let last = 0;
    const start = Date.now();
    const loop = () => {
      const now = Date.now();
      if (now - last >= 1000 / FPS) {
        last = now;
        setT((((now - start) * speed) / motion.durationMs) % 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, motion, speed]);

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
