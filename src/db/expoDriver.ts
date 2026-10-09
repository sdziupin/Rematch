import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { normalizeParams, type QueryMethod, type SqlDriver } from './driver';

function wrap(db: SQLite.SQLiteDatabase, description: string, persistent: boolean): SqlDriver {
  return {
    description,
    persistent,
    async exec(sql) {
      await db.execAsync(sql);
    },
    async query(sql: string, params: unknown[], method: QueryMethod) {
      const bound = normalizeParams(params);
      if (method === 'run') {
        await db.runAsync(sql, bound);
        return [];
      }
      const statement = await db.prepareAsync(sql);
      try {
        const result = await statement.executeForRawResultAsync(bound);
        const rows = (await result.getAllAsync()) as unknown[][];
        return method === 'get' ? rows[0] : rows;
      } finally {
        await statement.finalizeAsync();
      }
    },
  };
}

/**
 * Opens the app database. On the web the persistent store (OPFS) can be
 * unavailable — private windows, or the app already open in another tab — so
 * the app falls back to an in-memory database instead of failing to start.
 */
export async function openExpoDriver(name = 'rematch.db'): Promise<SqlDriver> {
  try {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
    return wrap(db, Platform.OS === 'web' ? 'This browser (origin private file system)' : 'On this device (SQLite)', true);
  } catch (error) {
    if (Platform.OS !== 'web') throw error;
    console.warn('[rematch] persistent storage unavailable, using memory', error);
    const db = await SQLite.openDatabaseAsync(':memory:');
    return wrap(db, 'Temporary (this tab only)', false);
  }
}
