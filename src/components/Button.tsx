import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing, withAlpha } from '../theme';
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
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const FONT: Record<Size, number> = { sm: 13.5, md: 15, lg: 16 };

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, accessibilityLabel, accessibilityHint }: ButtonProps) {
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const textColor =
    variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.text : variant === 'outline' ? colors.text : variant === 'ghost' ? colors.textSecondary : colors.text;
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
        const hovered = (state as { hovered?: boolean }).hovered && !inactive;
        const hoverBg =
          variant === 'ghost' || variant === 'outline'
            ? withAlpha(colors.text, 0.06)
            : variant === 'secondary'
              ? colors.surfaceHover
              : withAlpha(bg, 0.9);
        return [
          styles.base,
          { minHeight: HEIGHT[size], backgroundColor: hovered ? hoverBg : bg, opacity: inactive ? 0.45 : 1 },
          variant === 'outline' && styles.outline,
          variant === 'secondary' && styles.secondary,
          size === 'sm' && styles.small,
          state.pressed && styles.pressed,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={textColor} strokeWidth={2} />}
          <Text style={[styles.text, { fontSize: FONT[size], color: textColor }]} numberOfLines={1}>
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
export function IconButton({ icon, onPress, label, size = 48, color = colors.text, background = colors.surfaceRaised, disabled, style }: IconButtonProps) {
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
          opacity: disabled ? 0.4 : 1,
        },
        state.pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} color={color} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondary: { borderWidth: 1, borderColor: colors.border },
  outline: { borderWidth: 1, borderColor: colors.borderStrong },
  small: { paddingHorizontal: 14 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontFamily: fonts.semibold, letterSpacing: -0.15 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
});
