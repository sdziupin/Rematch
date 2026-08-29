import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';
import { formatDuration, formatDelta } from '../domain/utils';

interface RematchBarProps {
  deltaMs: number | null;
  opponentLabel?: string;
}

export function RematchBar({ deltaMs, opponentLabel = 'OPP' }: RematchBarProps) {
  if (deltaMs === null) return null;
  const ahead = deltaMs < 0;
  const tied = deltaMs === 0;
  const color = tied ? colors.muted : ahead ? colors.ahead : colors.behind;
  const label = tied ? 'TIED' : ahead ? 'AHEAD' : 'BEHIND';

  return (
    <View style={styles.container} accessibilityLabel={`${label} ${formatDelta(deltaMs)} versus ${opponentLabel}`}>
      <Text style={styles.label}>REMATCH</Text>
      <Text style={[styles.delta, { color }]}>{tied ? 'TIED' : formatDelta(deltaMs)}</Text>
      <Text style={[styles.status, { color }]}>{label}</Text>
    </View>
  );
}

export function TimerDisplay({ ms, large }: { ms: number; large?: boolean }) {
  return (
    <Text style={[large ? styles.timerLarge : styles.timer, { color: colors.primary }]} accessibilityLabel={`Elapsed time ${formatDuration(ms)}`}>
      {formatDuration(ms)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
  delta: {
    ...typography.subheading,
  },
  status: {
    ...typography.caption,
  },
  timer: {
    ...typography.displayMD,
  },
  timerLarge: {
    ...typography.displayXL,
  },
});
