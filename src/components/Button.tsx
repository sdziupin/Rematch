import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({ title, onPress, variant = 'primary', disabled, style, accessibilityLabel }: ButtonProps) {
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surfaceElevated : 'transparent';
  const textColor = variant === 'ghost' ? colors.primary : variant === 'primary' ? colors.background : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      disabled={disabled}
