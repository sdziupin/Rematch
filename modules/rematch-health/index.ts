import { requireOptionalNativeModule } from 'expo';

export type HealthAuthorization = 'unavailable' | 'notDetermined' | 'denied' | 'authorized';
/** Whether the platform's health store can be used. Android: Health Connect may be missing or need an update. */
export type HealthAvailability = 'available' | 'notInstalled' | 'needsUpdate' | 'unsupported';
export type HealthActivity =
  | 'hiit' | 'functionalStrength' | 'traditionalStrength' | 'coreTraining' | 'flexibility'
  | 'mixedCardio' | 'crossTraining' | 'jumpRope' | 'warmup' | 'cooldown';

export interface HealthWorkout {
  /** Epoch ms. */
  start: number;
  end: number;
  activity: HealthActivity;
  energyKcal?: number | null;
  /** [pausedAt, resumedAt] pairs in epoch ms; a pause without a resume lasts until `end`. */
  pauses: number[][];
  /** Stable id of the REMATCH session (used for de-duplication and deletion). */
  externalId: string;
  title: string;
  notes?: string | null;
}

export interface HeartRateSummary { avgBpm: number; maxBpm: number; minBpm: number }

interface RematchHealthModule {
  isAvailable(): boolean;
  getAvailability(): HealthAvailability;
  /** iOS answers synchronously, Android asynchronously; callers always await. */
  getAuthorizationStatus(): HealthAuthorization | Promise<HealthAuthorization>;
  requestAuthorization(): Promise<HealthAuthorization>;
  getBodyMassKg(): Promise<number | null>;
  /** Heart rate recorded by a watch or band between two epoch-ms instants; null when there is none or reading isn't allowed. */
  getHeartRate(start: number, end: number): Promise<HeartRateSummary | null>;
  /** Saves (or, on Android, upserts) a workout; resolves to the platform record id. */
  saveWorkout(workout: HealthWorkout): Promise<string>;
  /** Deletes a workout this app saved (and the energy sample saved with it). Resolves true when something was deleted. */
  deleteWorkout(id: string, externalId: string): Promise<boolean>;
  /** Android: opens Health Connect's permission/data screen; iOS: resolves false (JS opens the Health app itself). */
  openSettings(): Promise<boolean>;
}

/** Native Health bridge: HealthKit on iOS, Health Connect on Android. `null` on the web and in tests. */
export const RematchHealth = requireOptionalNativeModule<RematchHealthModule>('RematchHealth');
