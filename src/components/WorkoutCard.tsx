import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '../theme';
import { formatDuration, formatScore } from '../domain/utils';
import { Pill, WorkoutMark } from './ui';
import { Icon } from './Icon';

interface ScoreInfo {
  completionMs: number;
  scoreType?: string | null;
  scoreReps?: number | null;
}

interface WorkoutCardProps {
  name: string;
  meta: string;
  duration: string;
  pb?: number | ScoreInfo | null;
  last?: number | ScoreInfo | null;
  color: string;
  onPress?: () => void;
  badge?: string;
  format?: string;
  description?: string | null;
}

const show = (v: number | ScoreInfo | null | undefined) => (v == null ? '—' : typeof v === 'number' ? formatDuration(v) : formatScore(v));

type Hoverable = { hovered?: boolean; pressed: boolean };

/** The featured "next challenge" card. */
export function WorkoutHeroCard({ name, meta, duration, pb, last, color, onPress, badge, format, description }: WorkoutCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}. ${meta}. About ${duration}.`}
      style={(state) => [styles.hero, (state as Hoverable).hovered && styles.heroHover, state.pressed && styles.pressed]}
    >
      <View style={styles.heroTop}>
        <WorkoutMark name={name} color={color} size={40} />
        <View style={styles.heroTags}>
          {badge ? <Pill label={badge} color={colors.accent} /> : null}
          {format ? <Pill label={format} /> : null}
        </View>
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Text>
        <Text style={styles.meta}>
          {meta} · {duration}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={styles.heroFooter}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Last</Text>
          <Text style={styles.statValue}>{show(last)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Best</Text>
          <Text style={[styles.statValue, pb != null && { color: colors.pb }]}>{show(pb)}</Text>
        </View>
        <View style={styles.fill} />
        {onPress && (
          <View style={styles.go}>
            <Icon name="forward" size={20} color={colors.onAccent} strokeWidth={2.25} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface WorkoutTileProps {
  name: string;
  color: string;
  meta: string;
  format: string;
  pb?: ScoreInfo | null;
  attempts?: number;
  onPress: () => void;
  tag?: string;
}

/** Compact list row for a workout. */
export function WorkoutTile({ name, color, meta, format, pb, attempts, onPress, tag }: WorkoutTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${format}. ${meta}${pb ? `. Personal best ${formatScore(pb)}` : ''}`}
      style={(state) => [styles.tile, (state as Hoverable).hovered && styles.tileHover, state.pressed && styles.pressed]}
    >
      <WorkoutMark name={name} color={color} size={42} />
      <View style={styles.fill}>
        <View style={styles.tileTitleRow}>
          <Text style={styles.tileName} numberOfLines={1}>
            {name}
          </Text>
          {tag ? <Pill label={tag} /> : null}
        </View>
        <Text style={styles.tileMeta} numberOfLines={1}>
          {format} · {meta}
          {attempts ? ` · ${attempts} attempt${attempts === 1 ? '' : 's'}` : ''}
        </Text>
      </View>
      {pb ? (
        <View style={styles.tilePb}>
          <Text style={styles.tilePbLabel}>Best</Text>
          <Text style={styles.tilePbValue}>{formatScore(pb)}</Text>
        </View>
      ) : (
        <Icon name="forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.8 },
  hero: { backgroundColor: colors.surface, borderRadius: radius.xl + 4, padding: spacing.lg - 2, borderWidth: 1, borderColor: colors.border, gap: spacing.lg },
  heroHover: { borderColor: colors.borderStrong },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTags: { flexDirection: 'row', gap: 6 },
  heroBody: { gap: 6 },
  name: { ...typography.display, color: colors.text, letterSpacing: -0.8 },
  meta: { ...typography.callout, color: colors.textSecondary },
  description: { ...typography.body, color: colors.textSecondary, marginTop: 6, maxWidth: 560 },
  heroFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { gap: 2 },
  statLabel: { ...typography.overline, color: colors.textMuted },
  statValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.text, fontVariant: ['tabular-nums'] },
  go: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  tile: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileHover: { backgroundColor: colors.surfaceRaised },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileName: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, letterSpacing: 0.2, color: colors.text, flexShrink: 1 },
  tileMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  tilePb: { alignItems: 'flex-end', gap: 1 },
  tilePbLabel: { ...typography.overline, fontSize: 9.5, color: colors.textMuted },
  tilePbValue: { ...typography.figure, color: colors.pb },
});
