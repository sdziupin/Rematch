import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout';
import { colors, layout, spacing, typography, withAlpha } from '../theme';
import { Icon, type IconName } from './Icon';

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
    { paddingHorizontal: gutter, maxWidth: narrow ? layout.maxReading : layout.maxContent, paddingTop: isWide ? spacing.xl : spacing.md },
    contentStyle,
  ];
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

export function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack && (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Icon name="back" size={24} />
        </Pressable>
      )}
      <View style={styles.fill}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
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

export function Card({ children, style, onPress, accessibilityLabel, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; accent?: string }) {
  const base = [styles.card, accent ? { borderColor: withAlpha(accent, 0.55) } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={(state) => [...base, (state as { hovered?: boolean }).hovered && styles.cardHover, state.pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, color = colors.accent, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      style={(state) => [
        styles.chip,
        selected && { borderColor: color, backgroundColor: withAlpha(color, 0.14) },
        (state as { hovered?: boolean }).hovered && !selected && styles.chipHover,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={selected ? color : colors.secondary} />}
      <Text style={[styles.chipText, selected && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow<T extends string | number>({ options, value, onChange, format, scroll }: { options: readonly T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string; scroll?: boolean }) {
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

export function Stat({ label, value, color, style, small }: { label: string; value: string; color?: string; style?: StyleProp<ViewStyle>; small?: boolean }) {
  return (
    <View style={style}>
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
      <Icon name={icon} size={32} color={colors.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Pill({ label, color = colors.secondary, style, textStyle }: { label: string; color?: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.16) }, style]}>
      <Text style={[styles.pillText, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

/** Responsive grid: lays children out in `columns` equal columns. */
export function Grid({ columns, gap = spacing.md, children }: { columns: number; gap?: number; children: React.ReactNode }) {
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
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: spacing.xxl },
  inner: { width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { ...typography.displayMD, color: colors.primary },
  subtitle: { ...typography.body, color: colors.secondary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  section: { ...typography.label, color: colors.muted, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHover: { backgroundColor: colors.surfaceElevated },
  chipRow: { flexDirection: 'row', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipHover: { backgroundColor: colors.surfaceElevated },
  chipText: { ...typography.caption, color: colors.secondary, fontFamily: 'DMSans_500Medium' },
  statLabel: { ...typography.label, color: colors.muted, textTransform: 'uppercase' },
  statValue: { ...typography.heading, color: colors.primary },
  statValueSmall: { ...typography.subheading, color: colors.primary },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.subheading, color: colors.primary, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.secondary, textAlign: 'center', maxWidth: 420 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  pillText: { ...typography.label, fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
