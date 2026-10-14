import { syncWorkoutActivity } from '../widgets';
import { refreshGlances } from './glanceService';
import { exportSessionToHealth } from './healthService';
import { cancelRestAlert } from './notificationService';

/** Everything outside the app that follows a session ending: Health, widget, reminders, Live Activity. */
export function afterSessionEnded(sessionId: string) {
  void cancelRestAlert();
  void syncWorkoutActivity(null);
  void exportSessionToHealth(sessionId).catch((error) => console.warn('[rematch] Health export failed', error));
  void refreshGlances();
}
