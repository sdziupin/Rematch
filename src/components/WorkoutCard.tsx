import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, readable, spacing, typography, withAlpha } from '../theme';
import { formatDuration, formatScore } from '../domain/utils';
import { Pill } from './ui';
import { Icon } from './Icon';

interface ScoreInfo {
  completionMs: number;
  scoreType?: string | null;
  scoreReps?: number | null;
}

interface WorkoutCardProps {
  name: string;
  symbol: string;
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

/** The big "next challenge" card. */
export function WorkoutHeroCard({ name, symbol, meta, duration, pb, last, color: rawColor, onPress, badge, format, description }: WorkoutCardProps) {
  const color = readable(rawColor);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}. ${meta}. About ${duration}.`}
      style={(state) => [styles.hero, { borderColor: withAlpha(color, 0.6) }, state.pressed && { opacity: 0.9 }]}
    >
      <LinearGradient colors={[withAlpha(color, 0.28), withAlpha(color, 0.02)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.heroTop}>
        {badge ? <Pill label={badge} color={color} /> : <View />}
        {format ? <Text style={styles.format}>{format}</Text> : null}
      </View>
      <View style={styles.header}>
        <View style={[styles.symbolWrap, { backgroundColor: withAlpha(color, 0.18) }]}>
          <Text style={[styles.symbol, { color }]}>{symbol}</Text>
        </View>
        <View style={styles.fill}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
            {name}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
          <Text style={styles.duration}>≈ {duration}</Text>
        </View>
        {onPress && <Icon name="forward" size={22} color={colors.secondary} />}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>LAST</Text>
          <Text style={styles.statValue}>{show(last)}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>PB</Text>
          <Text style={[styles.statValue, { color: colors.pb }]}>{show(pb)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

interface WorkoutTileProps {
  name: string;
  symbol: string;
  color: string;
  meta: string;
  format: string;
  pb?: ScoreInfo | null;
  attempts?: number;
  onPress: () => void;
  tag?: string;
}

/** Compact library card. */
export function WorkoutTile({ name, symbol, color: rawColor, meta, format, pb, attempts, onPress, tag }: WorkoutTileProps) {
  const color = readable(rawColor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${format}. ${meta}${pb ? `. Personal best ${formatScore(pb)}` : ''}`}
      style={(state) => [styles.tile, (state as { hovered?: boolean }).hovered && styles.tileHover, state.pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.tileSymbol, { backgroundColor: withAlpha(color, 0.16) }]}>
        <Text style={[styles.tileSymbolText, { color }]}>{symbol}</Text>
      </View>
      <View style={styles.fill}>
        <View style={styles.tileTitleRow}>
          <Text style={styles.tileName} numberOfLines={1}>
            {name}
          </Text>
          {tag ? <Pill label={tag} color={colors.accentWarm} /> : null}
        </View>
        <Text style={styles.tileMeta} numberOfLines={1}>
          {format} · {meta}
        </Text>
        <Text style={[styles.tileStats, pb ? { color: colors.pb } : null]} numberOfLines={1}>
          {pb ? `PB ${formatScore(pb)}` : 'No attempts yet'}
          {attempts ? `  ·  ${attempts} attempt${attempts === 1 ? '' : 's'}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, borderWidth: 1, overflow: 'hidden', gap: spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  format: { ...typography.label, color: colors.secondary },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  symbolWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontSize: 34 },
  name: { ...typography.displayLG, color: colors.primary },
  meta: { ...typography.caption, color: colors.secondary },
  duration: { ...typography.body, color: colors.secondary },
  description: { ...typography.body, color: colors.primary, opacity: 0.85 },
  stats: { flexDirection: 'row', gap: spacing.xl },
  statLabel: { ...typography.label, color: colors.muted },
  statValue: { ...typography.heading, color: colors.primary, fontVariant: ['tabular-nums'] },
  tile: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tileHover: { backgroundColor: colors.surfaceElevated },
  tileSymbol: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileSymbolText: { fontSize: 26 },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileName: { ...typography.displayMD, fontSize: 26, lineHeight: 30, color: colors.primary, flexShrink: 1 },
  tileMeta: { ...typography.caption, color: colors.secondary },
  tileStats: { ...typography.caption, color: colors.muted, marginTop: 2 },
});
