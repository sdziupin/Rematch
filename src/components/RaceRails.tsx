import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';
import { formatDelta } from '../domain/utils';

interface RaceRailsProps {
  youProgress: number;
  opponentProgress: number;
  youLabel?: string;
  opponentLabel?: string;
}

export function RaceRails({ youProgress, opponentProgress, youLabel = 'YOU', opponentLabel = 'PB' }: RaceRailsProps) {
  return (
    <View style={styles.wrap}>
      <Rail label={youLabel} progress={youProgress} color={colors.accent} />
      <Rail label={opponentLabel} progress={opponentProgress} color={colors.muted} />
    </View>
  );
}

function Rail({ label, progress, color }: { label: string; progress: number; color: string }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={styles.railRow}>
      <Text style={styles.railLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        <View style={[styles.marker, { left: `${pct}%`, borderColor: color }]} />
      </View>
    </View>
  );
}

export function CheckpointBreakdown({ items }: { items: { label: string; deltaMs: number }[] }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={[styles.rowDelta, { color: item.deltaMs <= 0 ? colors.ahead : colors.behind }]}>
            {formatDelta(item.deltaMs)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  railRow: { gap: 6 },
  railLabel: { ...typography.label, color: colors.muted },
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
