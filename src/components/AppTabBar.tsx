import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, layout, radius, spacing, typography, makeStyles } from '../theme';
import { Icon, type IconName } from './Icon';
import { Wordmark } from './Wordmark';
import { PressableScale, SPRING } from './motion';
import { haptic } from '../services/cues';

export const TAB_ICONS: Record<string, IconName> = {
  today: 'today',
  library: 'library',
  exercises: 'exercises',
  progress: 'progress',
  profile: 'profile',
};

/** Bottom tab bar on phones, a sidebar on wide screens (web, tablets). */
export function AppTabBar({ state, descriptors, navigation, sidebar }: BottomTabBarProps & { sidebar: boolean }) {
  const styles = useStyles();
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
        if (!focused && !event.defaultPrevented) {
          haptic('selection');
          navigation.navigate(route.name, route.params);
        }
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

  return <BottomBar items={items} bottomInset={insets.bottom} />;
}

type TabItem = { route: { key: string }; focused: boolean; label: string; onPress: () => void; icon: IconName };

/** Phone tab bar: a soft pill glides to the selected tab. */
function BottomBar({ items, bottomInset }: { items: TabItem[]; bottomInset: number }) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.focused));
  const itemWidth = items.length ? width / items.length : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!itemWidth) return;
    const target = index * itemWidth + (itemWidth - PILL_WIDTH) / 2;
    if (shown.value === 0) {
      x.value = target;
      shown.value = 1;
    } else x.value = withSpring(target, SPRING);
  }, [index, itemWidth, x, shown]);

  const pill = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(bottomInset, 8) }]} accessibilityRole="tablist">
      <View style={styles.bottomRow} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
        {items.map(({ route, focused, label, onPress, icon }) => (
          <PressableScale
            key={route.key}
            onPress={onPress}
            scaleTo={0.9}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.bottomItem}
          >
            <Icon name={icon} size={22} color={focused ? colors.text : colors.textMuted} strokeWidth={focused ? 2 : 1.75} />
            <Text style={[styles.bottomLabel, focused && styles.bottomLabelActive]}>{label}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const PILL_WIDTH = 58;

function Shortcut({ keys, label }: { keys: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.shortcut}>
      <Text style={styles.kbd}>{keys}</Text>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  bottom: { backgroundColor: colors.scheme === 'light' ? colors.surface : colors.background, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border, paddingTop: 6 },
  bottomRow: { flexDirection: 'row' },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 50 },
  pill: { position: 'absolute', top: 2, left: 0, width: PILL_WIDTH, height: 30, borderRadius: 15, backgroundColor: colors.scheme === 'light' ? colors.surfaceRaised : colors.surfaceRaised },
  bottomLabel: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13, color: colors.textMuted },
  bottomLabelActive: { color: colors.text, fontFamily: fonts.semibold },
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
}));
