import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, layout, radius, spacing, typography } from '../theme';
import { Icon, type IconName } from './Icon';
import { Wordmark } from './Wordmark';

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
        <View style={styles.wordmark}>
          <Wordmark />
        </View>
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
              <Icon name={icon} size={19} color={focused ? colors.text : colors.textMuted} />
              <Text style={[styles.sideLabel, focused && { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sideFooter}>
          <Text style={styles.sideFooterTitle}>Shortcuts</Text>
          <Shortcut keys="Space" label="Next" />
          <Shortcut keys="↑ ↓" label="Count reps" />
          <Shortcut keys="P" label="Pause" />
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
          <Icon name={icon} size={22} color={focused ? colors.text : colors.textMuted} />
          <Text style={[styles.bottomLabel, focused && { color: colors.text }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <View style={styles.shortcut}>
      <Text style={styles.kbd}>{keys}</Text>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 50 },
  bottomLabel: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13, color: colors.textMuted },
  sidebar: { width: layout.sidebarWidth, backgroundColor: colors.background, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: spacing.md },
  wordmark: { paddingHorizontal: spacing.sm + 2, marginBottom: spacing.xl },
  sideItems: { gap: 2 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.sm + 4, minHeight: 40, borderRadius: radius.md },
  sideItemActive: { backgroundColor: colors.surfaceRaised },
  sideItemHover: { backgroundColor: colors.surface },
  sideLabel: { ...typography.callout, color: colors.textSecondary },
  sideFooter: { marginTop: 'auto', marginBottom: spacing.lg, gap: 8, paddingHorizontal: spacing.sm + 4 },
  sideFooterTitle: { ...typography.overline, color: colors.textMuted, marginBottom: 2 },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kbd: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 26,
    textAlign: 'center',
    overflow: 'hidden',
  },
  shortcutLabel: { ...typography.caption, color: colors.textMuted },
});
