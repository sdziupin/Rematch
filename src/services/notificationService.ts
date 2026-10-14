import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedReminder } from '../domain/glance';

/** Local notifications only: nothing here talks to a server. */
export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

const CHANNEL = 'training';
const REST_ID = 'rest-alert';
const REMINDER_PREFIX = 'reminder-';
const MAX_REMINDERS = 7;

let configured = false;

export function configureNotifications() {
  if (!notificationsSupported || configured) return;
  configured = true;
  // In the app the workout screen already beeps and speaks; banners would only cover it.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Training',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    }).catch(() => undefined);
  }
}

/** Asks once; afterwards reports what the user chose in Settings. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return asked.granted;
}

async function hasPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** "Rest is over" while the app is in the background. Replaces any earlier one. */
export async function scheduleRestAlert(at: number, title: string, body: string) {
  if (!(await hasPermission())) return;
  await cancelRestAlert();
  if (at <= Date.now() + 1000) return;
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: { title, body, sound: 'default', data: { url: '/workout/active' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
  });
}

export async function cancelRestAlert() {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined);
  await Notifications.dismissNotificationAsync(REST_ID).catch(() => undefined);
}

/** Replaces every scheduled training reminder with `plan` (empty clears them). */
export async function scheduleReminders(plan: PlannedReminder[]) {
  if (!notificationsSupported) return;
  for (let i = 0; i < MAX_REMINDERS; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${REMINDER_PREFIX}${i}`).catch(() => undefined);
  }
  if (plan.length === 0 || !(await hasPermission())) return;
  for (const [i, r] of plan.slice(0, MAX_REMINDERS).entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}${i}`,
      content: { title: r.title, body: r.body, sound: 'default', data: { url: '/today' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

/** Opens the screen a tapped notification points at, including the one that launched the app. */
export function observeNotificationTaps(open: (url: string) => void): () => void {
  if (!notificationsSupported) return () => undefined;
  const route = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) open(url);
  };
  const launch = Notifications.getLastNotificationResponse();
  if (launch) {
    Notifications.clearLastNotificationResponse();
    route(launch);
  }
  const sub = Notifications.addNotificationResponseReceivedListener(route);
  return () => sub.remove();
}
