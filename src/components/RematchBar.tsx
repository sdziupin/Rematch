import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LiveRace } from '../domain/rematch';
import { colors, typography, withAlpha } from '../theme';
import { formatDelta, formatDuration, formatRepDelta } from '../domain/utils';

interface RematchBarProps {
  race: LiveRace | null;
  opponentLabel?: string;
}

/** Live "you vs past you" delta. Pace races show time, volume races show reps. */
export function RematchBar({ race, opponentLabel = 'PAST YOU' }: RematchBarProps) {
  if (!race) return null;
  const waiting = race.status === 'none' || race.delta === null;
  const color = waiting || race.status === 'tied' ? colors.secondary : race.status === 'ahead' ? colors.ahead : colors.behind;
  const label = waiting ? 'FIRST SPLIT PENDING' : race.status === 'tied' ? 'DEAD EVEN' : race.status === 'ahead' ? 'AHEAD' : 'BEHIND';
  const value = waiting ? '—' : race.status === 'tied' ? '±0' : race.unit === 'reps' ? formatRepDelta(race.delta!) : formatDelta(race.delta!);
  return (
    <View
      style={[styles.container, { borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.08) }]}
      accessibilityLabel={waiting ? `Racing ${opponentLabel}, first split pending` : `${label} ${value} versus ${opponentLabel}`}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.label}>VS {opponentLabel}</Text>
      <Text style={[styles.delta, { color }]}>{value}</Text>
      <Text style={[styles.status, { color }]}>{label}</Text>
    </View>
  );
}

export function TimerDisplay({ ms, large, color = colors.primary }: { ms: number; large?: boolean; color?: string }) {
  return (
    <Text style={[large ? styles.timerLarge : styles.timer, { color }]} accessibilityLabel={`Elapsed time ${formatDuration(ms)}`}>
      {formatDuration(ms)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: { ...typography.label, color: colors.muted, flex: 1 },
  delta: { ...typography.displayMD, fontSize: 30, lineHeight: 34 },
  status: { ...typography.label, minWidth: 64, textAlign: 'right' },
  timer: { ...typography.displayMD, fontVariant: ['tabular-nums'] },
  timerLarge: { ...typography.displayXL, fontVariant: ['tabular-nums'] },
});
