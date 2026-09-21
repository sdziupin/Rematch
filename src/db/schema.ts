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
