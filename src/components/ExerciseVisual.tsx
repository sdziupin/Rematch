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
        <Rect x="0" y="0" width="120" height="120" rx="16" fill={colors.surfaceElevated} />
        {id.includes('squat') || id.includes('lunge') ? (
          <>
            <Circle cx="60" cy="28" r="10" fill={pose.color} />
            <Line x1="60" y1="38" x2="60" y2="70" stroke={pose.color} strokeWidth="6" strokeLinecap="round" />
            <Line x1="60" y1="48" x2="40" y2="58" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="48" x2="80" y2="58" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="70" x2="42" y2="92" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="70" x2="78" y2="92" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
          </>
        ) : id.includes('plank') || id.includes('mountain') ? (
          <>
            <Line x1="30" y1="70" x2="90" y2="70" stroke={pose.color} strokeWidth="6" strokeLinecap="round" />
            <Circle cx="95" cy="65" r="8" fill={pose.color} />
            <Line x1="50" y1="70" x2="45" y2="95" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="75" y1="70" x2="80" y2="95" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Circle cx="60" cy="35" r="10" fill={pose.color} />
            <Line x1="60" y1="45" x2="60" y2="78" stroke={pose.color} strokeWidth="6" strokeLinecap="round" />
            <Line x1="60" y1="55" x2="38" y2="72" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="55" x2="82" y2="72" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="78" x2="48" y2="102" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
            <Line x1="60" y1="78" x2="72" y2="102" stroke={pose.color} strokeWidth="5" strokeLinecap="round" />
          </>
