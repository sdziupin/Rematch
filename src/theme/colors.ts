export const colors = {
  background: '#0A0C10',
  surface: '#141820',
  surfaceElevated: '#1C2230',
  primary: '#E8ECF4',
  accent: '#4ECDC4',
  accentWarm: '#F4A261',
  success: '#6BCB77',
  danger: '#E76F51',
  muted: '#6B7280',
  border: '#2A3142',
  overlay: 'rgba(10, 12, 16, 0.85)',
  ahead: '#4ECDC4',
  behind: '#F4A261',
  pb: '#6BCB77',
} as const;

export type ColorName = keyof typeof colors;
