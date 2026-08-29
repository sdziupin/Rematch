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

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL,
      workout_version_id TEXT NOT NULL,
      workout_variant_id TEXT NOT NULL,
      opponent_session_id TEXT,
      scaling_category TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      elapsed_active_ms INTEGER NOT NULL DEFAULT 0,
      paused_accumulated_ms INTEGER NOT NULL DEFAULT 0,
      last_paused_at INTEGER,
      current_state_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id),
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      elapsed_active_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_checkpoints (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id),
      checkpoint_key TEXT NOT NULL,
      label TEXT NOT NULL,
      elapsed_active_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_results (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id),
      workout_id TEXT NOT NULL,
      workout_version_id TEXT NOT NULL,
      workout_variant_id TEXT NOT NULL,
      scaling_category TEXT NOT NULL,
      completion_ms INTEGER NOT NULL,
      is_complete INTEGER NOT NULL,
      is_abandoned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personal_bests (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL,
      workout_version_id TEXT NOT NULL,
      workout_variant_id TEXT NOT NULL,
      scaling_category TEXT NOT NULL,
      result_id TEXT NOT NULL REFERENCES workout_results(id),
      session_id TEXT NOT NULL,
      completion_ms INTEGER NOT NULL,
      achieved_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_workout_feedback (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id),
      intensity TEXT,
      technique TEXT,
      pain_reported INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_status ON workout_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_results_workout ON workout_results(workout_id, workout_variant_id, scaling_category);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON workout_checkpoints(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_session ON workout_session_events(session_id);
  `);
}
