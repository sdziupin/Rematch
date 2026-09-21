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
