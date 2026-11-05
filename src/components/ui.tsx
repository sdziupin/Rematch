import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout';
import { colors, elevation, fonts, layout, radius, readable, spacing, typography, withAlpha, makeStyles } from '../theme';
import { Icon, type IconName } from './Icon';
import { PressableScale, SPRING, useFillStyle } from './motion';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Narrow reading width on large screens. */
  narrow?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
}

/** Safe-area screen with centred, max-width content and responsive gutters. */
export function Screen({ children, scroll = true, narrow, edges = ['top', 'left', 'right'], contentStyle, footer }: ScreenProps) {
  const styles = useStyles();
  const { gutter, isWide } = useLayout();
  const inner = [
    styles.inner,
    { paddingHorizontal: gutter, maxWidth: narrow ? layout.maxReading : layout.maxContent, paddingTop: isWide ? spacing.xl + spacing.sm : spacing.md },
    contentStyle,
  ];
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.center]}>
          <View style={[inner, styles.fill]}>{children}</View>
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** Round back button used in screen headers. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      scaleTo={0.9}
      style={(s) => [styles.back, s.hovered && styles.backHover]}
    >
      <Icon name="back" size={20} color={colors.text} />
    </PressableScale>
  );
}

export function ScreenHeader({ title, subtitle, eyebrow, onBack, right }: { title: string; subtitle?: string; eyebrow?: string; onBack?: () => void; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.headerWrap}>
      {(onBack || right) && (
        <View style={styles.headerBar}>
          {onBack ? <BackButton onPress={onBack} /> : <View />}
          {right}
        </View>
      )}
      {title ? (
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children, right, style }: { children: React.ReactNode; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.section} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accent?: string;
}) {
  const styles = useStyles();
  const base = [styles.card, accent ? { borderColor: withAlpha(accent, colors.scheme === 'light' ? 0.4 : 0.32) } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.985}
      style={(state) => [...base, state.hovered && styles.cardHover, state.pressed && styles.cardPressed]}
    >
      {children}
    </PressableScale>
  );
}

/**
 * Filter / option chip. Selected chips invert to the text colour, which keeps
 * the signal colour free for actions and race state.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const tinted = selected && color;
  const fg = tinted ? color : selected ? colors.background : colors.textSecondary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.94}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      style={(state) => [
        styles.chip,
        state.hovered && !selected && styles.chipHover,
        selected && (tinted ? { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.5) } : styles.chipSelected),
        style,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
  format,
  scroll,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  scroll?: boolean;
}) {
  const styles = useStyles();
  const chips = options.map((o) => <Chip key={String(o)} label={format ? format(o) : String(o)} selected={o === value} onPress={() => onChange(o)} />);
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={[styles.chipRow, styles.wrap]}>{chips}</View>;
}

/** iOS-style segmented control; the selection slides between segments. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill,
  style,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Stretch to the full width, segments sharing it equally. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const [frames, setFrames] = useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useSharedValue(0);
  const frame = frames[value];

  useEffect(() => {
    if (!frame) return;
    if (placed.value === 0) {
      // First placement: no slide in from the left edge.
      x.value = frame.x;
      width.value = frame.width;
      placed.value = 1;
      return;
    }
    x.value = withSpring(frame.x, SPRING);
    width.value = withSpring(frame.width, SPRING);
  }, [frame, x, width, placed]);

  const thumb = useAnimatedStyle(() => ({ opacity: placed.value, width: width.value, transform: [{ translateX: x.value }] }));
  const onLayout = (key: T) => (e: LayoutChangeEvent) => {
    const { x: fx, width: fw } = e.nativeEvent.layout;
    setFrames((f) => (f[key]?.x === fx && f[key]?.width === fw ? f : { ...f, [key]: { x: fx, width: fw } }));
  };

  return (
    <View style={[styles.segmented, fill && styles.segmentedFill, style]} accessibilityRole="tablist">
      <Animated.View pointerEvents="none" style={[styles.segmentThumb, thumb]} />
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            onLayout={onLayout(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={(s) => [styles.segment, fill && styles.segmentFill, !active && (s as { hovered?: boolean }).hovered && styles.segmentHover]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ label, value, color, style, small }: { label: string; value: string; color?: string; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[small ? styles.statValueSmall : styles.statValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = 'info', title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/** Small status tag. Neutral unless given a colour. */
export function Pill({ label, color, style, textStyle }: { label: string; color?: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.pill, { backgroundColor: color ? withAlpha(color, 0.13) : colors.surfaceRaised }, style]}>
      <Text style={[styles.pillText, { color: color ?? colors.textSecondary }, textStyle]}>{label}</Text>
    </View>
  );
}

/**
 * A workout's mark: its initial set in its identity colour. Replaces emoji
 * symbols, which render differently on every platform.
 */
export function WorkoutMark({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const styles = useStyles();
  const c = readable(color);
  const letter = (name.trim()[0] ?? '•').toUpperCase();
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: withAlpha(c, 0.12), borderColor: withAlpha(c, 0.22) }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.markText, { color: c, fontSize: Math.round(size * 0.46), lineHeight: Math.round(size * 0.56) }]}>{letter}</Text>
    </View>
  );
}

/** Thin progress bar. */
export function ProgressBar({ progress, color = colors.accent, height = 4, style }: { progress: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const fillStyle = useFillStyle(progress);
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

/** Rounded search field. */
export function SearchField({ value, onChange, placeholder = 'Search', label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.search}>
      <Icon name="search" size={17} color={colors.textMuted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        style={styles.searchInput}
        accessibilityLabel={label}
        returnKeyType="search"
        keyboardAppearance={colors.scheme}
        selectionColor={colors.accent}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Round toggle that opens a filter panel; shows how many filters are on. */
export function FilterButton({ open, count, onPress }: { open: boolean; count: number; onPress: () => void }) {
  const styles = useStyles();
  const on = open || count > 0;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Filters${count ? `, ${count} active` : ''}`}
      style={[styles.filterButton, on && styles.filterButtonOn]}
    >
      <Icon name="list" size={17} color={on ? colors.background : colors.text} />
      {count > 0 && <Text style={styles.filterCount}>{count}</Text>}
    </PressableScale>
  );
}

/** Labelled group inside a filter panel. */
export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.statLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Responsive grid: lays children out in `columns` equal columns. */
export function Grid({ columns, gap = spacing.sm + 4, children }: { columns: number; gap?: number; children: React.ReactNode }) {
  const styles = useStyles();
  const items = React.Children.toArray(children);
  if (columns <= 1) return <View style={{ gap }}>{items}</View>;
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: columns }, (_, ci) => (
            <View key={ci} style={styles.fill}>
              {row[ci] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.divider, style]} />;
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  center: { alignItems: 'center' },
  pressed: { opacity: 0.72 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: spacing.xxl + spacing.lg },
  inner: { width: '100%', alignSelf: 'center' },
  headerWrap: { marginBottom: spacing.lg, gap: spacing.md },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 40 },
  headerText: { gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  backHover: { backgroundColor: colors.surfaceHover },
  eyebrow: { ...typography.overline, color: colors.textMuted },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, maxWidth: 560 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm + 4, minHeight: 28 },
  section: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.3, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...elevation(1),
  },
  cardHover: { backgroundColor: colors.scheme === 'light' ? colors.surface : colors.surfaceRaised, borderColor: colors.borderStrong },
  cardPressed: { backgroundColor: colors.scheme === 'light' ? colors.surfaceRaised : colors.surfaceRaised },
  chipRow: { flexDirection: 'row', gap: 6 },
  wrap: { flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipHover: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...typography.callout },
  segmented: { flexDirection: 'row', backgroundColor: colors.scheme === 'light' ? colors.surfaceRaised : colors.surface, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  segmentThumb: { position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: radius.sm + 1, backgroundColor: colors.scheme === 'light' ? colors.surface : colors.surfaceHover, ...elevation(1) },
  segmentedFill: { alignSelf: 'stretch' },
  segmentFill: { flexGrow: 1, paddingHorizontal: 10 },
  segment: { minHeight: 32, paddingHorizontal: 14, borderRadius: radius.sm + 1, alignItems: 'center', justifyContent: 'center' },
  segmentHover: { opacity: 0.8 },
  segmentText: { ...typography.callout, color: colors.textMuted },
  segmentTextActive: { color: colors.text },
  stat: { gap: 4 },
  statLabel: { ...typography.overline, color: colors.textMuted },
  statValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: colors.text, fontVariant: ['tabular-nums'] },
  statValueSmall: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.3, color: colors.text, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { ...typography.subheading, color: colors.text, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 400 },
  emptyAction: { marginTop: spacing.md },
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  mark: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  markText: { fontFamily: fonts.display, letterSpacing: -0.5 },
  bar: { backgroundColor: colors.surfaceHover, overflow: 'hidden' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 44, ...elevation(1) },
  searchInput: { flex: 1, color: colors.text, ...typography.body, paddingVertical: 10 },
  filterButton: { minWidth: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  filterButtonOn: { backgroundColor: colors.text, borderColor: colors.text, paddingHorizontal: 14 },
  filterCount: { ...typography.callout, fontFamily: fonts.semibold, color: colors.background },
  filterGroup: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
}));
