import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';
import { formatDelta, formatRepDelta } from '../domain/utils';

interface RaceRailsProps {
  youProgress: number;
  opponentProgress: number;
  youLabel?: string;
  opponentLabel?: string;
}

export function RaceRails({ youProgress, opponentProgress, youLabel = 'YOU', opponentLabel = 'PAST YOU' }: RaceRailsProps) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${youLabel} ${Math.round(youProgress * 100)} percent, ${opponentLabel} ${Math.round(opponentProgress * 100)} percent`}>
      <Rail label={youLabel} progress={youProgress} color={colors.accent} />
      <Rail label={opponentLabel} progress={opponentProgress} color={colors.accentWarm} />
    </View>
  );
}

function Rail({ label, progress, color }: { label: string; progress: number; color: string }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={styles.railRow}>
      <Text style={styles.railLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        <View style={[styles.marker, { left: `${pct}%`, borderColor: color }]} />
      </View>
    </View>
  );
}

export function CheckpointBreakdown({ items, unit = 'time' }: { items: { label: string; deltaMs: number; repDelta?: number }[]; unit?: 'time' | 'reps' }) {
  return (
    <View>
      {items.map((item, i) => {
        const value = unit === 'reps' ? item.repDelta ?? 0 : item.deltaMs;
        const good = unit === 'reps' ? value >= 0 : value <= 0;
        return (
          <View key={`${item.label}-${i}`} style={styles.row}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={[styles.rowDelta, { color: value === 0 ? colors.secondary : good ? colors.ahead : colors.behind }]}>
              {unit === 'reps' ? formatRepDelta(value) : formatDelta(value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  railRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  railLabel: { ...typography.label, color: colors.muted, width: 72 },
  track: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, position: 'relative' },
  fill: { height: 8, borderRadius: 4 },
  marker: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, borderWidth: 3, marginLeft: -8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { ...typography.body, color: colors.primary },
  rowDelta: { ...typography.bodyBold, fontVariant: ['tabular-nums'] },
});
