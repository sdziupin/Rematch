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

/** Opens the app database (native SQLite, or OPFS-backed SQLite on the web). */
export async function openExpoDriver(name = 'rematch.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  return wrap(db, Platform.OS === 'web' ? 'in this browser (origin private file system)' : 'on this device (SQLite)', true);
}
