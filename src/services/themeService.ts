import { Appearance as RNAppearance, Platform } from 'react-native';
import { setTheme, useThemeStore } from '../theme/themeStore';
import type { AccentId, Appearance, Scheme } from '../theme/colors';
import { saveDeviceSettings } from './deviceSettings';

function systemScheme(): Scheme {
  try {
    return RNAppearance.getColorScheme() === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * Native chrome (keyboards, switches, the status bar, system sheets) follows the app's
 * choice instead of the phone's. iOS only: Android would recreate the activity.
 */
function syncNativeChrome(appearance: Appearance) {
  if (Platform.OS !== 'ios') return;
  try {
    const resolved = appearance === 'system' ? 'unspecified' : appearance === 'light' ? 'light' : 'dark';
    RNAppearance.setColorScheme(resolved);
  } catch {
    // Older runtimes without an override: the palette still changes.
  }
}

let listening = false;

/** Applies the saved look before the first screen renders, then follows the phone for 'system'. */
export function initTheme(appearance: Appearance, accent: AccentId) {
  syncNativeChrome(appearance);
  setTheme({ appearance, accent, system: systemScheme() });
  if (listening) return;
  listening = true;
  RNAppearance.addChangeListener(({ colorScheme }) => {
    if (useThemeStore.getState().appearance !== 'system') return;
    setTheme({ system: colorScheme === 'light' ? 'light' : 'dark' });
  });
}

export async function saveAppearance(appearance: Appearance) {
  syncNativeChrome(appearance);
  setTheme({ appearance, system: systemScheme() });
  await saveDeviceSettings({ appearance });
}

export async function saveAccent(accent: AccentId) {
  setTheme({ accent });
  await saveDeviceSettings({ accent });
}
