import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { formatDuration } from '../domain/utils';

interface WorkoutCardProps {
  name: string;
  symbol: string;
  meta: string;
  duration: string;
  pb?: number | null;
  last?: number | null;
  color: string;
  onPress: () => void;
}

export function WorkoutHeroCard({ name, symbol, meta, duration, pb, last, color, onPress }: WorkoutCardProps) {
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.header}>
        <Text style={[styles.symbol, { color }]}>{symbol}</Text>
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{meta}</Text>
          <Text style={styles.duration}>≈ {duration}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>LAST</Text>
          <Text style={styles.statValue}>{last != null ? formatDuration(last) : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PB</Text>
          <Text style={[styles.statValue, { color: colors.pb }]}>{pb != null ? formatDuration(pb) : '—'}</Text>
        </View>
      </View>
    </View>
  );
