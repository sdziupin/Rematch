import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, typography, withAlpha } from '../theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Background colour override for primary buttons (workout identity colours). */
  tint?: string;
}

const HEIGHT: Record<Size, number> = { sm: 40, md: 52, lg: 64 };

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, accessibilityLabel, accessibilityHint, tint }: ButtonProps) {
  const accent = tint ?? colors.accent;
  const bg =
    variant === 'primary' ? accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surfaceElevated : 'transparent';
  const textColor = variant === 'primary' ? colors.background : variant === 'danger' ? colors.primary : variant === 'outline' ? accent : colors.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        const hoverBg =
          variant === 'ghost' || variant === 'outline' ? withAlpha(colors.primary, 0.06) : variant === 'secondary' ? colors.surfaceHover : bg;
        return [
          styles.base,
          { minHeight: HEIGHT[size], backgroundColor: hovered && !inactive ? hoverBg : bg, opacity: inactive ? 0.5 : state.pressed ? 0.82 : 1 },
          variant === 'outline' && { borderWidth: 1.5, borderColor: accent },
          size === 'sm' && styles.small,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} color={textColor} />}
          <Text style={[styles.text, size === 'lg' && styles.textLarge, size === 'sm' && styles.textSmall, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  background?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only button with a 48 pt minimum touch target. */
export function IconButton({ icon, onPress, label, size = 48, color = colors.primary, background = colors.surfaceElevated, disabled, style }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={Math.max(0, (48 - size) / 2)}
      style={(state) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: (state as { hovered?: boolean }).hovered ? colors.surfaceHover : background,
          opacity: disabled ? 0.4 : state.pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  small: { paddingHorizontal: spacing.md, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: {
    ...typography.bodyBold,
    letterSpacing: 1,
  },
  textLarge: { fontSize: 18, letterSpacing: 1.5 },
  textSmall: { fontSize: 14, letterSpacing: 0.5 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
});
