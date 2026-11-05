/**
 * Motion primitives. Everything here is short, quiet and interruptible, runs on the UI
 * thread (Reanimated), and collapses to an instant change when the OS asks for reduced
 * motion. Screens never animate layout for its own sake: motion confirms a touch,
 * shows where something came from, or marks a moment (a split, a personal best).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, type GestureResponderEvent, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  ReduceMotion,
  type EntryOrExitLayoutType,
  type SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

let reduceMotionNow = false;
const listeners = new Set<(v: boolean) => void>();
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduceMotionNow = v;
    listeners.forEach((l) => l(v));
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
  reduceMotionNow = v;
  listeners.forEach((l) => l(v));
});

/** Live "Reduce Motion" setting (iOS, Android "Remove animations", prefers-reduced-motion on the web). */
export function useReducedMotionSetting(): boolean {
  const [value, setValue] = useState(reduceMotionNow);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduceMotionNow);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

// ---------------------------------------------------------------------------
// Springs and curves
// ---------------------------------------------------------------------------

/** A firm, nearly critically damped spring: settles fast, never wobbles. */
export const SPRING = { damping: 22, stiffness: 340, mass: 0.7, reduceMotion: ReduceMotion.System } as const;
/** A little give, for things that should feel caught (a counter, a trophy). */
export const SPRING_SOFT = { damping: 14, stiffness: 220, mass: 0.8, reduceMotion: ReduceMotion.System } as const;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

// ---------------------------------------------------------------------------
// Pressable with a spring
// ---------------------------------------------------------------------------

type InteractionState = PressableStateCallbackType & { hovered?: boolean };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle> | ((state: InteractionState) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: InteractionState) => React.ReactNode);
  /** Scale while held. 1 disables the spring (opacity feedback only). */
  scaleTo?: number;
}

/**
 * Pressable that sinks slightly under the finger and springs back. Style and children
 * may be functions of `{ pressed, hovered }`, as with Pressable.
 */
export function PressableScale({ style, children, scaleTo = 0.97, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, ...rest }: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const state: InteractionState = { pressed, hovered };
  const resolved = typeof style === 'function' ? style(state) : style;

  const pressIn = (e: GestureResponderEvent) => {
    setPressed(true);
    if (scaleTo !== 1) scale.value = withSpring(scaleTo, SPRING);
    onPressIn?.(e);
  };
  const pressOut = (e: GestureResponderEvent) => {
    setPressed(false);
    scale.value = withSpring(1, SPRING);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onHoverIn={(e) => {
        setHovered(true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        onHoverOut?.(e);
      }}
      style={[resolved, animated]}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Entrances
// ---------------------------------------------------------------------------

/**
 * On the web, Reanimated pins elements with a *custom* entering animation (a Keyframe, or
 * a preset with `withInitialValues`) to `position: absolute` once it ends, which pulls
 * them out of the layout. The web therefore gets the stock presets; phones get the
 * tuned versions.
 */
const WEB = Platform.OS === 'web';

/** Content rising into place, staggered by `index`. Use on the first render of a screen's blocks. */
export function riseIn(index = 0) {
  const base = FadeInDown.duration(420).delay(Math.min(index, 8) * 45).reduceMotion(ReduceMotion.System);
  return WEB ? base : base.easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
}

/** A stock fade on the web, a custom keyframe on phones (see `WEB`). */
export function nativeKeyframe(keyframe: EntryOrExitLayoutType, webDuration = 240): EntryOrExitLayoutType {
  return WEB ? FadeIn.duration(webDuration).reduceMotion(ReduceMotion.System) : keyframe;
}

export function fadeIn(delay = 0, duration = 220) {
  return FadeIn.duration(duration).delay(delay).reduceMotion(ReduceMotion.System);
}

/** Wraps children in a view that rises into place on mount. */
export function Rise({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={riseIn(index)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/**
 * Gives its children a short spring "bump" whenever `trigger` changes (a rep counted,
 * a split landed). The first render never bumps.
 */
export function Bump({ trigger, children, amount = 1.12, style }: { trigger: unknown; children: React.ReactNode; amount?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    cancelAnimation(scale);
    scale.value = withSequence(withTiming(amount, { duration: 70, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), withSpring(1, SPRING_SOFT));
  }, [trigger, amount, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** A full-bleed wash that flashes and fades: a visual cue for loud gyms and muted phones. */
export function useFlash() {
  const opacity = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const flash = useCallback(
    (peak = 0.22) => {
      cancelAnimation(opacity);
      opacity.value = withSequence(withTiming(peak, { duration: 60, reduceMotion: ReduceMotion.Never }), withTiming(0, { duration: 520, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    },
    [opacity],
  );
  return { style, flash };
}

// ---------------------------------------------------------------------------
// Progress ring
// ---------------------------------------------------------------------------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress. On phones the arc glides between updates on the UI thread
 * (`glideMs`, e.g. the tick interval, keeps a countdown moving continuously); the
 * web draws each value as it comes.
 */
export function ProgressRing({
  progress,
  size = 200,
  stroke = 12,
  color = colors.accent,
  track = colors.surfaceHover,
  glideMs = 360,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** How long the arc takes to reach a new value. 0 snaps. */
  glideMs?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(p);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!native) return;
    // A jump backwards (a new rest starting) snaps; forward and draining motion glides.
    const jump = Math.abs(p - value.value) > 0.5;
    value.value = glideMs > 0 && !jump ? withTiming(p, { duration: glideMs, easing: Easing.linear, reduceMotion: ReduceMotion.System }) : p;
  }, [p, glideMs, native, value]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - value.value) }));

  const arc = native ? (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      stroke={color}
      strokeWidth={stroke}
      fill="none"
      strokeDasharray={`${c} ${c}`}
      animatedProps={animatedProps}
      strokeLinecap="round"
      rotation={-90}
      origin={`${size / 2}, ${size / 2}`}
    />
  ) : (
    <Circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      stroke={color}
      strokeWidth={stroke}
      fill="none"
      strokeDasharray={`${c} ${c}`}
      strokeDashoffset={c * (1 - p)}
      strokeLinecap="round"
      rotation={-90}
      origin={`${size / 2}, ${size / 2}`}
    />
  );

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 || native ? arc : null}
      </Svg>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Animated bar fill
// ---------------------------------------------------------------------------

/** A horizontal fill that springs to its width as a fraction of the track. */
export function useFillStyle(progress: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(60, withSpring(p, { ...SPRING, damping: 26 }));
  }, [p, width]);
  return useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
}

// ---------------------------------------------------------------------------
// Counting numbers
// ---------------------------------------------------------------------------

/** Counts from 0 to `to` over `durationMs` with an ease-out, for the big reveal moments. */
export function useCountUp(to: number, { durationMs = 900, enabled = true }: { durationMs?: number; enabled?: boolean } = {}) {
  const reduce = useReducedMotionSetting();
  const [value, setValue] = useState(enabled && !reduce ? 0 : to);
  useEffect(() => {
    if (!enabled || reduce || !Number.isFinite(to)) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, enabled, reduce]);
  return value;
}

// ---------------------------------------------------------------------------
// Celebration
// ---------------------------------------------------------------------------

function Particle({ angle, distance, size, color, delay, progress }: { angle: number; distance: number; size: number; color: string; delay: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    const travel = 1 - Math.pow(1 - t, 3);
    const x = Math.cos(angle) * distance * travel;
    // A little gravity pulls the confetti down as it fades.
    const y = Math.sin(angle) * distance * travel + 28 * t * t;
    return {
      opacity: t <= 0 ? 0 : 1 - t * t,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${angle * 57 + t * 220}deg` }, { scale: 1 - 0.4 * t }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size * 0.55, borderRadius: 1.5, backgroundColor: color }, style]} />;
}

/**
 * A single burst of confetti from the centre of its parent, for personal bests.
 * Plays once on mount; renders nothing when the OS asks for reduced motion.
 */
export function Burst({ colors: palette, count = 22, radius = 150 }: { colors: string[]; count?: number; radius?: number }) {
  const reduce = useReducedMotionSetting();
  const progress = useSharedValue(0);
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      distance: radius * (0.55 + Math.random() * 0.45),
      size: 6 + Math.random() * 5,
      delay: Math.random() * 0.12,
      color: palette[i % palette.length],
    })),
  );
  useEffect(() => {
    if (reduce) return;
    progress.value = withDelay(140, withTiming(1, { duration: 1300, easing: Easing.linear }));
  }, [reduce, progress]);
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      {pieces.map((p, i) => (
        <Particle key={i} {...p} progress={progress} />
      ))}
    </Animated.View>
  );
}

/** Scale-and-fade pop for a value that replaces the previous one (countdown numbers). */
export function popIn(duration = 320) {
  return nativeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ scale: 1.35 }] },
      100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
    })
      .duration(duration)
      .reduceMotion(ReduceMotion.System),
    200,
  );
}

/** A small dot that breathes, for things that are live (a workout in progress). */
export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const reduce = useReducedMotionSetting();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduce, pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.4 }] }));
  return (
    <Animated.View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, halo]} />
      <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </Animated.View>
  );
}
