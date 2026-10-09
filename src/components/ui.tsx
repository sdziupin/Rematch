import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout';
import { colors, fonts, layout, radius, readable, spacing, typography, withAlpha } from '../theme';
import { Icon, type IconName } from './Icon';

type Hoverable = { hovered?: boolean; pressed: boolean };

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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={(s) => [styles.back, (s as Hoverable).hovered && styles.backHover, s.pressed && styles.pressed]}
    >
      <Icon name="back" size={20} color={colors.text} />
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, eyebrow, onBack, right }: { title: string; subtitle?: string; eyebrow?: string; onBack?: () => void; right?: React.ReactNode }) {
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
  const base = [styles.card, accent ? { borderColor: withAlpha(accent, 0.32) } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={(state) => [...base, (state as Hoverable).hovered && styles.cardHover, state.pressed && styles.pressed]}
    >
      {children}
    </Pressable>
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
  const tinted = selected && color;
  const fg = tinted ? color : selected ? colors.background : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      style={(state) => [
        styles.chip,
        (state as Hoverable).hovered && !selected && styles.chipHover,
        selected && (tinted ? { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.5) } : styles.chipSelected),
        state.pressed && styles.pressed,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
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

/** iOS-style segmented control for switching between views of one screen. */
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
  return (
    <View style={[styles.segmented, fill && styles.segmentedFill, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={(s) => [styles.segment, fill && styles.segmentFill, active && styles.segmentActive, !active && (s as Hoverable).hovered && styles.segmentHover]}
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
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Rounded search field. */
export function SearchField({ value, onChange, placeholder = 'Search', label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
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
  const on = open || count > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Filters${count ? `, ${count} active` : ''}`}
      style={(st) => [styles.filterButton, on && styles.filterButtonOn, st.pressed && styles.pressed]}
    >
      <Icon name="list" size={17} color={on ? colors.background : colors.text} />
      {count > 0 && <Text style={styles.filterCount}>{count}</Text>}
    </Pressable>
  );
}

/** Labelled group inside a filter panel. */
export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.statLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Responsive grid: lays children out in `columns` equal columns. */
export function Grid({ columns, gap = spacing.sm + 4, children }: { columns: number; gap?: number; children: React.ReactNode }) {
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
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
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
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md + 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  cardHover: { backgroundColor: colors.surfaceRaised },
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
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  segmentedFill: { alignSelf: 'stretch' },
  segmentFill: { flexGrow: 1, paddingHorizontal: 10 },
  segment: { minHeight: 32, paddingHorizontal: 14, borderRadius: radius.sm + 1, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surfaceHover },
  segmentHover: { backgroundColor: colors.surfaceRaised },
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
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 44 },
  searchInput: { flex: 1, color: colors.text, ...typography.body, paddingVertical: 10 },
  filterButton: { minWidth: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  filterButtonOn: { backgroundColor: colors.text, borderColor: colors.text, paddingHorizontal: 14 },
  filterCount: { ...typography.callout, fontFamily: fonts.semibold, color: colors.background },
  filterGroup: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
