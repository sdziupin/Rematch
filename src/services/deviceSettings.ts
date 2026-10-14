import { getMetaValue, setMetaValue } from '../db/repository';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../store/settingsStore';

export type DeviceSettings = Pick<Settings, 'healthSync' | 'restAlerts' | 'reminders' | 'reminderHour'>;

const KEYS: Record<keyof DeviceSettings, string> = {
  healthSync: 'device.health_sync',
  restAlerts: 'device.rest_alerts',
  reminders: 'device.reminders',
  reminderHour: 'device.reminder_hour',
};

export async function loadDeviceSettings(): Promise<DeviceSettings> {
  const [healthSync, restAlerts, reminders, reminderHour] = await Promise.all([
    getMetaValue(KEYS.healthSync),
    getMetaValue(KEYS.restAlerts),
    getMetaValue(KEYS.reminders),
    getMetaValue(KEYS.reminderHour),
  ]);
  const hour = Number(reminderHour);
  const loaded: DeviceSettings = {
    healthSync: healthSync === '1',
    restAlerts: restAlerts === '1',
    reminders: reminders === '1',
    reminderHour: reminderHour !== null && Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : DEFAULT_SETTINGS.reminderHour,
  };
  useSettings.getState().update(loaded);
  return loaded;
}

export async function saveDeviceSettings(patch: Partial<DeviceSettings>) {
  useSettings.getState().update(patch);
  for (const [key, value] of Object.entries(patch) as [keyof DeviceSettings, DeviceSettings[keyof DeviceSettings]][]) {
    await setMetaValue(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
}
