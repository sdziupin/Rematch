import { create } from 'zustand';
import type { Profile } from '../db/repository';

export interface Settings {
  haptics: boolean;
  sound: boolean;
  voice: boolean;
  keepAwake: boolean;
  countdownSec: number;
  weekStartsOn: number;
  weeklyGoal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  sound: true,
  voice: false,
  keepAwake: true,
  countdownSec: 3,
  weekStartsOn: 1,
  weeklyGoal: 3,
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
