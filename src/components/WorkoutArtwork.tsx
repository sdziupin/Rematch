import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getWorkoutImage } from '../assets/imageRegistry';
import { colors, typography } from '../theme';

interface WorkoutArtworkProps {
  slug: string;
  symbol: string;
  color: string;
  size?: number;
}

export function WorkoutArtwork({ slug, symbol, color, size = 80 }: WorkoutArtworkProps) {
  const source = getWorkoutImage(slug);
  if (source) {
    return <Image source={source} style={{ width: size, height: size, borderRadius: 12 }} resizeMode="cover" accessibilityLabel={`${slug} workout artwork`} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size }]} accessibilityLabel={`${slug} symbol`}>
      <Text style={[styles.symbol, { color, fontSize: size * 0.45 }]}>{symbol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 12 },
  symbol: { fontFamily: 'BebasNeue' },
});
