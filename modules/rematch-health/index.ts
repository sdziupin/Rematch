import { requireOptionalNativeModule } from 'expo';

export type HealthAuthorization = 'unavailable' | 'notDetermined' | 'denied' | 'authorized';

export type HealthActivity = 'hiit' | 'functionalStrength' | 'coreTraining' | 'flexibility' | 'mixedCardio' | 'crossTraining';

export interface HealthWorkout {
  /** Epoch ms. */
  start: number;
  end: number;
  activity: HealthActivity;
  energyKcal?: number | null;
  /** [pausedAt, resumedAt] pairs in epoch ms; a pause without a resume lasts until `end`. */
  pauses: number[][];
  externalId: string;
  title: string;
}

interface RematchHealthModule {
  isAvailable(): boolean;
  getAuthorizationStatus(): HealthAuthorization;
  requestAuthorization(): Promise<HealthAuthorization>;
  getBodyMassKg(): Promise<number | null>;
  saveWorkout(workout: HealthWorkout): Promise<string>;
}

/** HealthKit bridge. `null` on Android, the web, and in tests. */
export const RematchHealth = requireOptionalNativeModule<RematchHealthModule>('RematchHealth');
