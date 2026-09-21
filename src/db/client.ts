import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const sqlite = SQLite.openDatabaseSync('rematch.db');
    dbInstance = drizzle(sqlite, { schema });
  }
  return dbInstance;
}

export async function runMigrations() {
  const sqlite = SQLite.openDatabaseSync('rematch.db');
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      level TEXT NOT NULL,
      typical_minutes INTEGER NOT NULL,
      frequency_days INTEGER NOT NULL,
      restrictions TEXT,
      equipment_json TEXT NOT NULL,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      haptics_enabled INTEGER NOT NULL DEFAULT 1,
      sound_enabled INTEGER NOT NULL DEFAULT 1,
      voice_enabled INTEGER NOT NULL DEFAULT 0,
      keep_awake_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      start_position TEXT NOT NULL,
      movement_sequence TEXT NOT NULL,
      cues_json TEXT NOT NULL,
      mistakes_json TEXT NOT NULL,
      primary_muscles_json TEXT NOT NULL,
      secondary_muscles_json TEXT NOT NULL,
      category TEXT NOT NULL,
      equipment_json TEXT NOT NULL,
      impact_level TEXT NOT NULL,
      easier_variant_id TEXT,
      harder_variant_id TEXT,
      visual_asset TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      focus TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      estimated_minutes_min INTEGER NOT NULL,
      estimated_minutes_max INTEGER NOT NULL,
      equipment_json TEXT NOT NULL,
      format TEXT NOT NULL,
      identity_color TEXT NOT NULL,
      visual_asset TEXT NOT NULL,
      progression_tier TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_versions (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL REFERENCES workouts(id),
      version INTEGER NOT NULL,
      structure_json TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_variants (
      id TEXT PRIMARY KEY,
      workout_version_id TEXT NOT NULL REFERENCES workout_versions(id),
      partial_key TEXT NOT NULL,
      label TEXT NOT NULL,
      fraction REAL NOT NULL,
      structure_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

