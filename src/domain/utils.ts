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
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function formatDelta(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  const abs = Math.abs(ms);
  const sec = Math.floor(abs / 1000);
  if (sec < 60) return `${sign}${sec} sec`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${sign}${min}:${rem.toString().padStart(2, '0')}`;
}
