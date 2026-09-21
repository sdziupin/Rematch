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
