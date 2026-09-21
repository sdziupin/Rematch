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
