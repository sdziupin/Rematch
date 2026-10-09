import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '../theme';

/** Responsive breakpoints shared by every screen. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  const isDesktop = width >= layout.desktopBreakpoint;
  const contentWidth = Math.min(width - (isWide ? layout.sidebarWidth : 0), layout.maxContent);
  const gutter = width < 380 ? 16 : isWide ? 32 : 20;
  /** Columns for card grids. */
  const columns = contentWidth >= 1000 ? 3 : contentWidth >= 640 ? 2 : 1;
  return { width, height, isWide, isDesktop, contentWidth, gutter, columns, isWeb: Platform.OS === 'web' };
}
