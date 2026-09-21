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
