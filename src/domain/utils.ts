import type { CompatibilityKey } from './types';

export function makeCompatibilityKey(key: CompatibilityKey): string {
  return `${key.workoutId}|${key.workoutVersionId}|${key.workoutVariantId}|${key.scalingCategory}`;
}

export function areCompatible(a: CompatibilityKey, b: CompatibilityKey): boolean {
  return (
    a.workoutId === b.workoutId &&
    a.workoutVersionId === b.workoutVersionId &&
    a.workoutVariantId === b.workoutVariantId &&
    a.scalingCategory === b.scalingCategory
  );
}

export function formatDuration(ms: number): string {
