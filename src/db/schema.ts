import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(),
  goal: text('goal').notNull(),
  level: text('level').notNull(),
  typicalMinutes: integer('typical_minutes').notNull(),
  frequencyDays: integer('frequency_days').notNull(),
  restrictions: text('restrictions'),
  equipmentJson: text('equipment_json').notNull(),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).notNull().default(false),
  hapticsEnabled: integer('haptics_enabled', { mode: 'boolean' }).notNull().default(true),
  soundEnabled: integer('sound_enabled', { mode: 'boolean' }).notNull().default(true),
  voiceEnabled: integer('voice_enabled', { mode: 'boolean' }).notNull().default(false),
  keepAwakeEnabled: integer('keep_awake_enabled', { mode: 'boolean' }).notNull().default(true),
  countdownSec: integer('countdown_sec').notNull().default(3),
  weekStartsOn: integer('week_starts_on').notNull().default(1),
  displayName: text('display_name'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  startPosition: text('start_position').notNull(),
  movementSequence: text('movement_sequence').notNull(),
  cuesJson: text('cues_json').notNull(),
  mistakesJson: text('mistakes_json').notNull(),
  primaryMusclesJson: text('primary_muscles_json').notNull(),
  secondaryMusclesJson: text('secondary_muscles_json').notNull(),
  category: text('category').notNull(),
  equipmentJson: text('equipment_json').notNull(),
  impactLevel: text('impact_level').notNull(),
  easierVariantId: text('easier_variant_id'),
  harderVariantId: text('harder_variant_id'),
  visualAsset: text('visual_asset').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  focus: text('focus').notNull(),
  difficulty: text('difficulty').notNull(),
  estimatedMinutesMin: integer('estimated_minutes_min').notNull(),
  estimatedMinutesMax: integer('estimated_minutes_max').notNull(),
  equipmentJson: text('equipment_json').notNull(),
  format: text('format').notNull(),
  identityColor: text('identity_color').notNull(),
  visualAsset: text('visual_asset').notNull(),
  progressionTier: text('progression_tier').notNull(),
  description: text('description'),
  /** 'benchmark' | 'warmup' | 'cooldown' */
  kind: text('kind').notNull().default('benchmark'),
  /** 'library' (shipped content) | 'custom' (built by the athlete) */
  source: text('source').notNull().default('library'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const workoutVersions = sqliteTable('workout_versions', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id').notNull().references(() => workouts.id),
  version: integer('version').notNull(),
  structureJson: text('structure_json').notNull(),
  rulesJson: text('rules_json').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
  /** Identity of the version: structure + scoring. A change creates a new version. */
  contentHash: text('content_hash'),
  createdAt: integer('created_at').notNull(),
});

export const workoutVariants = sqliteTable('workout_variants', {
  id: text('id').primaryKey(),
  workoutVersionId: text('workout_version_id').notNull().references(() => workoutVersions.id),
  partialKey: text('partial_key').notNull(),
  label: text('label').notNull(),
  fraction: real('fraction').notNull(),
  structureJson: text('structure_json').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id').notNull(),
  workoutVersionId: text('workout_version_id').notNull(),
  workoutVariantId: text('workout_variant_id').notNull(),
  opponentSessionId: text('opponent_session_id'),
  scalingCategory: text('scaling_category').notNull(),
  status: text('status').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  elapsedActiveMs: integer('elapsed_active_ms').notNull().default(0),
  pausedAccumulatedMs: integer('paused_accumulated_ms').notNull().default(0),
  lastPausedAt: integer('last_paused_at'),
  currentStateJson: text('current_state_json').notNull(),
  programEnrollmentId: text('program_enrollment_id'),
  programSessionKey: text('program_session_key'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const workoutSessionEvents = sqliteTable('workout_session_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => workoutSessions.id),
  type: text('type').notNull(),
  payloadJson: text('payload_json').notNull(),
  elapsedActiveMs: integer('elapsed_active_ms').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const workoutCheckpoints = sqliteTable('workout_checkpoints', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => workoutSessions.id),
  checkpointKey: text('checkpoint_key').notNull(),
  label: text('label').notNull(),
  elapsedActiveMs: integer('elapsed_active_ms').notNull(),
  /** Cumulative reps banked at this checkpoint. Null on sessions recorded before engine v2. */
  reps: integer('reps'),
  createdAt: integer('created_at').notNull(),
});

export const workoutResults = sqliteTable('workout_results', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().unique().references(() => workoutSessions.id),
  workoutId: text('workout_id').notNull(),
  workoutVersionId: text('workout_version_id').notNull(),
  workoutVariantId: text('workout_variant_id').notNull(),
  scalingCategory: text('scaling_category').notNull(),
  completionMs: integer('completion_ms').notNull(),
  isComplete: integer('is_complete', { mode: 'boolean' }).notNull(),
  isAbandoned: integer('is_abandoned', { mode: 'boolean' }).notNull().default(false),
  scoreType: text('score_type').notNull().default('time'),
  scoreReps: integer('score_reps'),
  roundsCompleted: integer('rounds_completed'),
  totalReps: integer('total_reps'),
  timeCapped: integer('time_capped', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const personalBests = sqliteTable('personal_bests', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id').notNull(),
  workoutVersionId: text('workout_version_id').notNull(),
  workoutVariantId: text('workout_variant_id').notNull(),
  scalingCategory: text('scaling_category').notNull(),
  resultId: text('result_id').notNull().references(() => workoutResults.id),
  sessionId: text('session_id').notNull(),
  completionMs: integer('completion_ms').notNull(),
  scoreType: text('score_type').notNull().default('time'),
  scoreReps: integer('score_reps'),
  achievedAt: integer('achieved_at').notNull(),
});

export const postWorkoutFeedback = sqliteTable('post_workout_feedback', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().unique().references(() => workoutSessions.id),
  intensity: text('intensity'),
  technique: text('technique'),
  painReported: integer('pain_reported', { mode: 'boolean' }).notNull().default(false),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
});

export const programEnrollments = sqliteTable('program_enrollments', {
  id: text('id').primaryKey(),
  programId: text('program_id').notNull(),
  /** 'active' | 'completed' | 'abandoned' */
  status: text('status').notNull(),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type WorkoutRow = typeof workouts.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type SessionRow = typeof workoutSessions.$inferSelect;
export type ResultRow = typeof workoutResults.$inferSelect;
export type CheckpointRow = typeof workoutCheckpoints.$inferSelect;
export type PersonalBestRow = typeof personalBests.$inferSelect;
export type ProfileRow = typeof userProfile.$inferSelect;
export type EnrollmentRow = typeof programEnrollments.$inferSelect;
export type PostWorkoutFeedbackRow = typeof postWorkoutFeedback.$inferSelect;
