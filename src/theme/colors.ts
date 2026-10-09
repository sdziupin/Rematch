/**
 * REMATCH colour tokens. One neutral ramp, one signal colour, and a small set of
 * race semantics. Anything else on screen is a workout's own identity colour.
 */
export const colors = {
  // Neutrals, darkest to lightest.
  background: '#09090B',
  surface: '#111113',
  surfaceRaised: '#18181B',
  surfaceHover: '#202024',
  border: '#1F1F23',
  borderStrong: '#2E2E33',

  // Text.
  text: '#F4F4F1',
  textSecondary: '#A1A1A8',
  textMuted: '#6A6A72',

  // Signal: the primary action, and "you".
  accent: '#D6F45B',
  onAccent: '#0B0C06',

  // Race semantics.
  ahead: '#D6F45B',
  behind: '#FF7A59',
  pb: '#F3C766',
  rest: '#8BA8FF',
  danger: '#FF5F5F',

  overlay: 'rgba(5, 5, 7, 0.82)',
} as const;

export type ColorName = keyof typeof colors;

/** Hex colour with alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

/** Lifts identity colours that would vanish on the dark canvas (e.g. slate #1E293B). */
export function readable(hex: string, minLuminance = 0.28): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= minLuminance) return hex;
  const k = Math.min(1, (minLuminance - lum) / (1 - lum) + 0.25);
  r = Math.round(r + (255 - r) * k);
  g = Math.round(g + (255 - g) * k);
  b = Math.round(b + (255 - b) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
