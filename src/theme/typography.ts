import type { TextStyle } from 'react-native';

/** Fonts registered in app/_layout.tsx. */
export const fonts = {
  display: 'InterTight_700Bold',
  displaySemi: 'InterTight_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Type scale. Inter Tight carries names and numbers, Inter carries the interface.
 * Numbers are always tabular so clocks and splits don't jitter.
 */
export const typography = {
  /** Clocks and the big score. */
  numeral: { fontFamily: fonts.displaySemi, fontSize: 72, lineHeight: 76, letterSpacing: -2.5, fontVariant: tabular },
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
  heading: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, letterSpacing: -0.4 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: -0.05 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Small uppercase labels above values. */
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  /** Tabular figures in body sizes. */
  figure: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontVariant: tabular },
} satisfies Record<string, TextStyle>;
