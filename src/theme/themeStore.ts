import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { create } from 'zustand';
import { applyPalette, buildPalette, colors, type AccentId, type Appearance, type Palette, type Scheme } from './colors';

interface ThemeState {
  appearance: Appearance;
  accent: AccentId;
  /** What the phone itself is set to (for 'system'). */
  system: Scheme;
  /** The scheme actually on screen. */
  scheme: Scheme;
  /** Bumped on every palette change; style sheets rebuild when it moves. */
  version: number;
}

export const useThemeStore = create<ThemeState>(() => ({
  appearance: 'dark',
  accent: 'volt',
  system: 'dark',
  scheme: 'dark',
  version: 0,
}));

/** Rewrites the live palette and re-renders everything that reads it. */
export function setTheme(patch: Partial<Pick<ThemeState, 'appearance' | 'accent' | 'system'>>) {
  const prev = useThemeStore.getState();
  const next = { ...prev, ...patch };
  if (next.appearance === prev.appearance && next.accent === prev.accent && next.system === prev.system) return;
  const palette = buildPalette(next.appearance, next.accent, next.system);
  applyPalette(palette);
  useThemeStore.setState({ ...next, scheme: palette.scheme, version: prev.version + 1 });
}

/** The live palette, subscribed: the calling component re-renders when the theme changes. */
export function useColors(): Palette {
  useThemeStore((s) => s.version);
  return colors;
}

export function useScheme(): Scheme {
  return useThemeStore((s) => s.scheme);
}

/**
 * Theme-aware style sheets. The factory reads the live `colors`; the sheet is rebuilt
 * once per theme change and shared by every component that calls the hook.
 *
 *   const useStyles = makeStyles(() => ({ card: { backgroundColor: colors.surface } }));
 *   function Card() { const styles = useStyles(); ... }
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(factory: () => T & StyleSheet.NamedStyles<any>): () => T {
  let cache: { version: number; sheet: T } | null = null;
  const build = (version: number) => {
    if (!cache || cache.version !== version) cache = { version, sheet: StyleSheet.create<T>(factory()) };
    return cache.sheet;
  };
  return function useStyles() {
    return build(useThemeStore((s) => s.version));
  };
}

/**
 * Soft elevation for raised surfaces. Dark grounds separate with hairlines, so this is
 * empty there; light grounds get a diffuse, low shadow that reads as paper on a desk.
 */
export function elevation(level: 1 | 2 | 3 = 1): ViewStyle {
  if (colors.scheme !== 'light') return {};
  const y = level === 1 ? 1 : level === 2 ? 4 : 10;
  const blur = level === 1 ? 3 : level === 2 ? 12 : 24;
  const opacity = level === 1 ? 0.06 : level === 2 ? 0.08 : 0.12;
  if (Platform.OS === 'web') return { boxShadow: `0 ${y}px ${blur}px rgba(27, 27, 18, ${opacity})` } as ViewStyle;
  return { shadowColor: colors.shadow, shadowOpacity: opacity, shadowRadius: blur / 2, shadowOffset: { width: 0, height: y }, elevation: level * 2 };
}
