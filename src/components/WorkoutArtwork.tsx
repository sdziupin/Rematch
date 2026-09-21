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
