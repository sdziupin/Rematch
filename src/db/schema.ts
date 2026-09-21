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
