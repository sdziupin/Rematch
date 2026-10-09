/** 4-point spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/** Content widths for wide (web/tablet) layouts. */
export const layout = {
  wideBreakpoint: 900,
  desktopBreakpoint: 1240,
  maxContent: 1120,
  maxReading: 720,
  sidebarWidth: 240,
} as const;
