import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography, withAlpha } from '../theme';
import { Icon, type IconName } from './Icon';

export const TAB_ICONS: Record<string, IconName> = {
  today: 'today',
  library: 'library',
  exercises: 'exercises',
  progress: 'progress',
  profile: 'profile',
};

/** Bottom tab bar on phones, a sidebar on wide screens (web, tablets). */
export function AppTabBar({ state, descriptors, navigation, sidebar }: BottomTabBarProps & { sidebar: boolean }) {
  const insets = useSafeAreaInsets();

  const items = state.routes
    .filter((route) => {
      const opts = descriptors[route.key].options as { href?: unknown };
      return opts.href !== null;
    })
    .map((route) => {
      const index = state.routes.indexOf(route);
      const focused = state.index === index;
      const options = descriptors[route.key].options;
      const label = typeof options.title === 'string' ? options.title : route.name;
      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      };
      return { route, focused, label, onPress, icon: TAB_ICONS[route.name] ?? 'library' };
    });

  if (sidebar) {
    return (
      <View style={[styles.sidebar, { paddingTop: insets.top + spacing.lg }]} accessibilityRole="tablist">
        <Text style={styles.brand}>REMATCH</Text>
        <Text style={styles.tagline}>You vs. you.</Text>
        <View style={styles.sideItems}>
          {items.map(({ route, focused, label, onPress, icon }) => (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={(s) => [styles.sideItem, focused && styles.sideItemActive, (s as { hovered?: boolean }).hovered && !focused && styles.sideItemHover]}
            >
              <Icon name={icon} size={20} color={focused ? colors.accent : colors.secondary} />
              <Text style={[styles.sideLabel, focused && { color: colors.primary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sideFooter}>
          <Icon name="keyboard" size={16} color={colors.muted} />
          <Text style={styles.sideFooterText}>Space = next · P = pause during workouts</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {items.map(({ route, focused, label, onPress, icon }) => (
        <Pressable
          key={route.key}
          onPress={onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={label}
          style={styles.bottomItem}
        >
          <Icon name={icon} size={22} color={focused ? colors.accent : colors.muted} />
          <Text style={[styles.bottomLabel, focused && { color: colors.accent }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  bottomLabel: { ...typography.label, fontSize: 11, letterSpacing: 0.4, color: colors.muted },
  sidebar: { width: layout.sidebarWidth, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: spacing.md },
  brand: { ...typography.displayMD, color: colors.primary, paddingHorizontal: spacing.sm },
  tagline: { ...typography.caption, color: colors.accent, paddingHorizontal: spacing.sm, marginBottom: spacing.xl },
  sideItems: { gap: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm + 4, minHeight: 46, borderRadius: 12 },
  sideItemActive: { backgroundColor: withAlpha(colors.accent, 0.12) },
  sideItemHover: { backgroundColor: colors.surfaceElevated },
  sideLabel: { ...typography.bodyBold, color: colors.secondary },
  sideFooter: { marginTop: 'auto', marginBottom: spacing.lg, flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: spacing.sm },
  sideFooterText: { ...typography.caption, color: colors.muted, flex: 1 },
});
