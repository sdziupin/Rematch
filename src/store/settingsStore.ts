import { create } from 'zustand';
import type { Profile } from '../db/repository';
import type { AccentId, Appearance } from '../theme/colors';

export type DefaultOpponent = 'best' | 'last';

export interface Settings {
  haptics: boolean;
  sound: boolean;
  voice: boolean;
  keepAwake: boolean;
  countdownSec: number;
  weekStartsOn: number;
  weeklyGoal: number;
  /** Device-only (app_meta), not in the profile or backups. */
  healthSync: boolean;
  restAlerts: boolean;
  reminders: boolean;
  reminderHour: number;
  /** Look and feel (device-only). */
  appearance: Appearance;
  accent: AccentId;
  /** Who the main "Rematch" button races when both a best and a last attempt exist. */
  defaultOpponent: DefaultOpponent;
  /** Show the animated demo of the current movement during a workout. */
  liveDemos: boolean;
  /** Seconds added by the "more rest" button. */
  restStepSec: number;
}

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  sound: true,
  voice: false,
  keepAwake: true,
  countdownSec: 3,
  weekStartsOn: 1,
  weeklyGoal: 3,
  healthSync: false,
  restAlerts: false,
  reminders: false,
  reminderHour: 18,
  appearance: 'dark',
  accent: 'volt',
  defaultOpponent: 'best',
  liveDemos: true,
  restStepSec: 15,
};

interface SettingsStore extends Settings {
  /** Bumped whenever profile-derived data changes so screens can refresh. */
  revision: number;
  applyProfile: (profile: Profile | null) => void;
  update: (patch: Partial<Settings>) => void;
  touch: () => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  revision: 0,
  applyProfile: (p) =>
    set((s) => ({
      haptics: p?.hapticsEnabled ?? DEFAULT_SETTINGS.haptics,
      sound: p?.soundEnabled ?? DEFAULT_SETTINGS.sound,
      voice: p?.voiceEnabled ?? DEFAULT_SETTINGS.voice,
      keepAwake: p?.keepAwakeEnabled ?? DEFAULT_SETTINGS.keepAwake,
      countdownSec: p?.countdownSec ?? DEFAULT_SETTINGS.countdownSec,
      weekStartsOn: p?.weekStartsOn ?? DEFAULT_SETTINGS.weekStartsOn,
      weeklyGoal: p?.frequencyDays ?? DEFAULT_SETTINGS.weeklyGoal,
      revision: s.revision + 1,
    })),
  update: (patch) => set((s) => ({ ...patch, revision: s.revision + 1 })),
  touch: () => set((s) => ({ revision: s.revision + 1 })),
}));
