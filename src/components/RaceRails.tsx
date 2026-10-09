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

/** Two lanes: you in the signal colour, past you as a quiet outline. */
export function RaceRails({ youProgress, opponentProgress, youLabel = 'You', opponentLabel = 'Past you' }: RaceRailsProps) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${youLabel} ${Math.round(youProgress * 100)} percent, ${opponentLabel} ${Math.round(opponentProgress * 100)} percent`}>
      <Rail label={youLabel} progress={youProgress} color={colors.accent} />
      <Rail label={opponentLabel} progress={opponentProgress} color={colors.textSecondary} ghost />
    </View>
  );
}

function Rail({ label, progress, color, ghost }: { label: string; progress: number; color: string; ghost?: boolean }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={styles.railRow}>
      <Text style={[styles.railLabel, !ghost && { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: ghost ? colors.borderStrong : color }]} />
        <View style={[styles.marker, { left: `${pct}%`, backgroundColor: ghost ? colors.background : color, borderColor: color }]} />
      </View>
    </View>
  );
}

export function CheckpointBreakdown({ items, unit = 'time' }: { items: { label: string; deltaMs: number; repDelta?: number }[]; unit?: 'time' | 'reps' }) {
  const values = items.map((item) => (unit === 'reps' ? item.repDelta ?? 0 : item.deltaMs));
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <View>
      {items.map((item, i) => {
        const value = values[i];
        const good = unit === 'reps' ? value >= 0 : value <= 0;
        const color = value === 0 ? colors.textSecondary : good ? colors.ahead : colors.behind;
        return (
          <View key={`${item.label}-${i}`} style={[styles.row, i === items.length - 1 && styles.rowLast]}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <View style={styles.deltaTrack}>
              <View style={[styles.deltaBar, { width: `${(Math.abs(value) / max) * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.rowDelta, { color }]}>{unit === 'reps' ? formatRepDelta(value) : formatDelta(value)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  railRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  railLabel: { ...typography.callout, color: colors.textMuted, width: 64 },
  track: { flex: 1, height: 4, backgroundColor: colors.surfaceHover, borderRadius: 2, position: 'relative' },
  fill: { height: 4, borderRadius: 2 },
  marker: { position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginLeft: -7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...typography.callout, color: colors.text, minWidth: 76, maxWidth: '45%' },
  deltaTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  deltaBar: { height: 4, borderRadius: 2, opacity: 0.85 },
  rowDelta: { ...typography.figure, minWidth: 72, textAlign: 'right' },
});
