import { and, desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { ActiveWorkoutState, ScalingCategory, SessionRoundState, WorkoutStructure } from '../domain/types';
import { compareCheckpoints } from '../domain/rematch';
import type { RematchComparison } from '../domain/types';

import { createActiveState as buildState } from '../engine/workoutEngine';

const now = () => Date.now();

export async function createSession(params: {
  workoutId: string;
  workoutVersionId: string;
  workoutVariantId: string;
  scalingCategory: ScalingCategory;
  structure: WorkoutStructure;
  partialKey: ActiveWorkoutState['partialKey'];
  opponentSessionId?: string | null;
