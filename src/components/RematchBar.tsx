import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LiveRace } from '../domain/rematch';
import { colors, fonts, radius, typography, withAlpha } from '../theme';
import { formatDelta, formatDuration, formatRepDelta } from '../domain/utils';

interface RematchBarProps {
  race: LiveRace | null;
  opponentLabel?: string;
}

/** Live "you vs past you" delta. Pace races show time, volume races show reps. */
export function RematchBar({ race, opponentLabel = 'past you' }: RematchBarProps) {
  if (!race) return null;
  const waiting = race.status === 'none' || race.delta === null;
  const color = waiting || race.status === 'tied' ? colors.textSecondary : race.status === 'ahead' ? colors.ahead : colors.behind;
  const label = waiting ? 'First split pending' : race.status === 'tied' ? 'Dead even' : race.status === 'ahead' ? 'Ahead' : 'Behind';
  const value = waiting ? '—' : race.status === 'tied' ? '±0' : race.unit === 'reps' ? formatRepDelta(race.delta!) : formatDelta(race.delta!);
  return (
    <View
      style={[styles.container, { backgroundColor: withAlpha(color, 0.07), borderColor: withAlpha(color, 0.22) }]}
      accessibilityLabel={waiting ? `Racing ${opponentLabel}, first split pending` : `${label} ${value} versus ${opponentLabel}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.fill}>
        <Text style={styles.label}>vs {opponentLabel}</Text>
        <Text style={[styles.status, { color }]}>{label}</Text>
      </View>
      <Text style={[styles.delta, { color }]}>{value}</Text>
    </View>
  );
}

export function TimerDisplay({ ms, large, color = colors.text }: { ms: number; large?: boolean; color?: string }) {
  return (
    <Text style={[large ? styles.timerLarge : styles.timer, { color }]} accessibilityLabel={`Elapsed time ${formatDuration(ms)}`}>
      {formatDuration(ms)}
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: 2 },
  container: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1 },
  label: { ...typography.overline, color: colors.textMuted },
  status: { ...typography.bodyStrong },
  delta: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  timer: { fontFamily: fonts.displaySemi, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  timerLarge: { ...typography.numeral, fontSize: 56, lineHeight: 60, letterSpacing: -2 },
});
