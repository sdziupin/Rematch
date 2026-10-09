export const colors = {
  background: '#0A0C10',
  surface: '#141820',
  surfaceElevated: '#1C2230',
  surfaceHover: '#232A3A',
  primary: '#E8ECF4',
  secondary: '#A3ACBD',
  accent: '#4ECDC4',
  accentDim: '#1F4F4C',
  accentWarm: '#F4A261',
  success: '#6BCB77',
  danger: '#E76F51',
  muted: '#6B7280',
  border: '#2A3142',
  overlay: 'rgba(10, 12, 16, 0.85)',
  ahead: '#4ECDC4',
  behind: '#F4A261',
  pb: '#6BCB77',
  rest: '#5B8DEF',
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
