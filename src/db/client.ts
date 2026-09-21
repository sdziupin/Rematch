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
