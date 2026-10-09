import { configureDatabase } from './client';
import { syncContent } from './contentSync';
import type { SqlDriver } from './driver';

export {
  getCurrentVersion,
  getExercise,
  getProfile,
  getVariant,
  getWorkoutById,
  listExercises,
  listWorkouts,
  updateProfile,
} from './repository';

/** Brings bundled content up to date (new workouts, metadata, versions). */
export async function seedDatabaseIfNeeded() {
  await syncContent();
}

/** Startup: install the driver, migrate the schema, sync content. */
export async function initDatabase(driver: SqlDriver) {
  await configureDatabase(driver);
  await syncContent();
}
