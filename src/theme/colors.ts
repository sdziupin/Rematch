/**
 * REMATCH colour tokens. One neutral ramp, one signal colour, and a small set of
 * race semantics. Anything else on screen is a workout's own identity colour.
 *
 * The ramp and the signal colour are customisable (Profile › Appearance). `colors`
 * is a live object: `applyPalette` rewrites it in place and the theme store bumps a
 * version so every `makeStyles` sheet and every subscribed screen re-renders.
 */

export type Scheme = 'dark' | 'light';

/** What the athlete picked. 'system' follows the phone. */
export const APPEARANCES = ['system', 'dark', 'midnight', 'light'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const APPEARANCE_LABELS: Record<Appearance, string> = {
  system: 'Automatic',
  dark: 'Graphite',
  midnight: 'Midnight',
  light: 'Daylight',
};

export const ACCENTS = ['volt', 'mint', 'aqua', 'orchid', 'flamingo', 'mono'] as const;
export type AccentId = (typeof ACCENTS)[number];

interface AccentSpec {
  label: string;
  /** Fill and ink on dark grounds. */
  dark: string;
  /** Fill and ink on light grounds: deeper, so text in the accent stays legible (≥ 4.5:1). */
  light: string;
  onDark: string;
  onLight: string;
}

export const ACCENT_SPECS: Record<AccentId, AccentSpec> = {
  volt: { label: 'Volt', dark: '#D6F45B', light: '#4D7C0F', onDark: '#0B0C06', onLight: '#FFFFFF' },
  mint: { label: 'Mint', dark: '#5EEAA8', light: '#047857', onDark: '#04140C', onLight: '#FFFFFF' },
  aqua: { label: 'Aqua', dark: '#5CDDF0', light: '#0E7490', onDark: '#03141A', onLight: '#FFFFFF' },
  orchid: { label: 'Orchid', dark: '#C9A2FF', light: '#7C3AED', onDark: '#130A22', onLight: '#FFFFFF' },
  flamingo: { label: 'Flamingo', dark: '#FF8AC8', light: '#BE185D', onDark: '#22050F', onLight: '#FFFFFF' },
  mono: { label: 'Mono', dark: '#F4F4F1', light: '#111113', onDark: '#09090B', onLight: '#FFFFFF' },
};

export interface Palette {
  scheme: Scheme;
  // Neutrals, back to front.
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  // Text.
  text: string;
  textSecondary: string;
  textMuted: string;
  // Signal: the primary action, and "you".
  accent: string;
  onAccent: string;
  // Race semantics.
  ahead: string;
  behind: string;
  pb: string;
  rest: string;
  danger: string;
  overlay: string;
  /** Soft shadow colour for raised surfaces (only drawn on light grounds). */
  shadow: string;
}

type Ramp = Omit<Palette, 'accent' | 'onAccent' | 'ahead'>;

const GRAPHITE: Ramp = {
  scheme: 'dark',
  background: '#09090B',
  surface: '#111113',
  surfaceRaised: '#18181B',
  surfaceHover: '#202024',
  border: '#1F1F23',
  borderStrong: '#2E2E33',
  text: '#F4F4F1',
  textSecondary: '#A1A1A8',
  textMuted: '#6A6A72',
  behind: '#FF7A59',
  pb: '#F3C766',
  rest: '#8BA8FF',
  danger: '#FF5F5F',
  overlay: 'rgba(5, 5, 7, 0.82)',
  shadow: '#000000',
};

/** True black for OLED screens; surfaces step up a little more so cards still read. */
const MIDNIGHT: Ramp = {
  ...GRAPHITE,
  background: '#000000',
  surface: '#0C0C0E',
  surfaceRaised: '#151517',
  surfaceHover: '#1D1D20',
  border: '#1B1B1E',
  borderStrong: '#2B2B2F',
  overlay: 'rgba(0, 0, 0, 0.86)',
};

/** Warm paper white. Surfaces are pure white and lift on a soft shadow instead of a border. */
const DAYLIGHT: Ramp = {
  scheme: 'light',
  background: '#F5F5F2',
  surface: '#FFFFFF',
  surfaceRaised: '#EFEFEB',
  surfaceHover: '#E7E7E2',
  border: '#E4E4DF',
  borderStrong: '#CFCFC8',
  text: '#111113',
  textSecondary: '#55555C',
  textMuted: '#7C7C84',
  behind: '#D9480F',
  pb: '#A16207',
  rest: '#4361EE',
  danger: '#DC2626',
  overlay: 'rgba(17, 17, 19, 0.42)',
  shadow: '#1B1B12',
};

export function rampFor(appearance: Appearance, system: Scheme): Ramp {
  const resolved = appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;
  return resolved === 'light' ? DAYLIGHT : resolved === 'midnight' ? MIDNIGHT : GRAPHITE;
}

export function buildPalette(appearance: Appearance, accent: AccentId, system: Scheme = 'dark'): Palette {
  const ramp = rampFor(appearance, system);
  const spec = ACCENT_SPECS[accent] ?? ACCENT_SPECS.volt;
  const light = ramp.scheme === 'light';
  const signal = light ? spec.light : spec.dark;
  return { ...ramp, accent: signal, onAccent: light ? spec.onLight : spec.onDark, ahead: signal };
}

/** The live palette. Read it at render time (or inside `makeStyles`), never cache it at module scope. */
export const colors: Palette = buildPalette('dark', 'volt');

export function applyPalette(next: Palette) {
  Object.assign(colors, next);
}

export type ColorName = Exclude<keyof Palette, 'scheme'>;

/** Hex colour with alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

function luma(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function toHex(r: number, g: number, b: number) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Keeps a workout's identity colour visible on the current ground: lifts colours that
 * would vanish on dark (e.g. slate #1E293B) and deepens ones that would wash out on
 * light (e.g. frost #E8ECF4).
 */
export function readable(hex: string, scheme: Scheme = colors.scheme): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const lum = luma(r, g, b);
  if (scheme === 'light') {
    const max = 0.52;
    if (lum <= max) return hex;
    const k = Math.min(0.85, (lum - max) / lum + 0.18);
    return toHex(Math.round(r * (1 - k)), Math.round(g * (1 - k)), Math.round(b * (1 - k)));
  }
  const min = 0.28;
  if (lum >= min) return hex;
  const k = Math.min(1, (min - lum) / (1 - lum) + 0.25);
  r = Math.round(r + (255 - r) * k);
  g = Math.round(g + (255 - g) * k);
  b = Math.round(b + (255 - b) * k);
  return toHex(r, g, b);
}
