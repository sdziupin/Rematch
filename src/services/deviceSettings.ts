import { getMetaValue, setMetaValue } from '../db/repository';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../store/settingsStore';
import { ACCENTS, APPEARANCES } from '../theme/colors';

/** Settings that belong to this device (app_meta), not to the profile or backups. */
export type DeviceSettings = Pick<
  Settings,
  'healthSync' | 'restAlerts' | 'reminders' | 'reminderHour' | 'appearance' | 'accent' | 'defaultOpponent' | 'liveDemos' | 'restStepSec'
>;

type Codec<T> = { key: string; decode: (raw: string | null) => T; encode: (value: T) => string };

const bool = (key: string, fallback: boolean): Codec<boolean> => ({
  key,
  decode: (raw) => (raw === null ? fallback : raw === '1'),
  encode: (v) => (v ? '1' : '0'),
});

const oneOf = <T extends string>(key: string, options: readonly T[], fallback: T): Codec<T> => ({
  key,
  decode: (raw) => (raw !== null && (options as readonly string[]).includes(raw) ? (raw as T) : fallback),
  encode: (v) => v,
});

const int = (key: string, valid: (n: number) => boolean, fallback: number): Codec<number> => ({
  key,
  decode: (raw) => {
    const n = Number(raw);
    return raw !== null && Number.isInteger(n) && valid(n) ? n : fallback;
  },
  encode: (v) => String(v),
});

const CODECS: { [K in keyof DeviceSettings]: Codec<DeviceSettings[K]> } = {
  healthSync: bool('device.health_sync', DEFAULT_SETTINGS.healthSync),
  restAlerts: bool('device.rest_alerts', DEFAULT_SETTINGS.restAlerts),
  reminders: bool('device.reminders', DEFAULT_SETTINGS.reminders),
  reminderHour: int('device.reminder_hour', (h) => h >= 0 && h < 24, DEFAULT_SETTINGS.reminderHour),
  appearance: oneOf('device.appearance', APPEARANCES, DEFAULT_SETTINGS.appearance),
  accent: oneOf('device.accent', ACCENTS, DEFAULT_SETTINGS.accent),
  defaultOpponent: oneOf('device.default_opponent', ['best', 'last'] as const, DEFAULT_SETTINGS.defaultOpponent),
  liveDemos: bool('device.live_demos', DEFAULT_SETTINGS.liveDemos),
  restStepSec: int('device.rest_step_sec', (s) => s >= 5 && s <= 120, DEFAULT_SETTINGS.restStepSec),
};

const KEYS = Object.keys(CODECS) as (keyof DeviceSettings)[];

export async function loadDeviceSettings(): Promise<DeviceSettings> {
  const raw = await Promise.all(KEYS.map((k) => getMetaValue(CODECS[k].key)));
  const loaded = Object.fromEntries(KEYS.map((k, i) => [k, CODECS[k].decode(raw[i])])) as unknown as DeviceSettings;
  useSettings.getState().update(loaded);
  return loaded;
}

export async function saveDeviceSettings(patch: Partial<DeviceSettings>) {
  useSettings.getState().update(patch);
  for (const key of Object.keys(patch) as (keyof DeviceSettings)[]) {
    const codec = CODECS[key] as Codec<DeviceSettings[typeof key]>;
    await setMetaValue(codec.key, codec.encode(patch[key] as never));
  }
}
