import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { getExerciseImage } from '../assets/imageRegistry';
import { colors, typography } from '../theme';

const POSES: Record<string, { color: string }> = {
  push: { color: colors.accent },
  squat: { color: colors.accentWarm },
  core: { color: colors.success },
  cardio: { color: '#5B8DEF' },
  default: { color: colors.muted },
};

interface ExerciseVisualProps {
  exerciseId: string;
  category?: string;
  size?: number;
}

export function ExerciseVisual({ exerciseId, category = 'default', size = 160 }: ExerciseVisualProps) {
  const generated = getExerciseImage(exerciseId);

  if (generated) {
    return (
      <View style={[styles.wrap, { width: size }]} accessibilityLabel={`Exercise demonstration for ${exerciseId}`}>
        <Image source={generated} style={[styles.image, { width: size, height: size, borderRadius: 16 }]} resizeMode="cover" />
        <Text style={styles.caption} numberOfLines={1}>{exerciseId.replace(/-/g, ' ')}</Text>
      </View>
    );
  }

  const pose = POSES[category] ?? POSES.default;
  const id = exerciseId.toLowerCase();

  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityLabel={`Exercise demonstration for ${exerciseId}`}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
