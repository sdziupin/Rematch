// Widgets and Live Activities are iOS-only (see index.ios.tsx); elsewhere these do nothing.
import type { WeekWidgetProps } from '../domain/glance';
import type { WorkoutActivityProps } from './types';

export function updateWeekWidget(_entries: { date: Date; props: WeekWidgetProps }[]) {}

export async function syncWorkoutActivity(_props: WorkoutActivityProps | null) {}
