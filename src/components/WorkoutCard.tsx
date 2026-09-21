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
