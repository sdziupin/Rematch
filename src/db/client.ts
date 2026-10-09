import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';
import { SerialQueue, type QueryMethod, type SqlDriver } from './driver';
import { migrate } from './migrations';

export type Db = SqliteRemoteDatabase<typeof schema>;

let driver: SqlDriver | null = null;
let db: Db | null = null;
const queue = new SerialQueue();

function makeDb(run: (sql: string, params: unknown[], method: QueryMethod) => Promise<unknown>): Db {
  return drizzle(async (sql, params, method) => ({ rows: (await run(sql, params, method)) as unknown[] }), { schema });
}

/** Installs the SQL driver and runs migrations. Call once at startup. */
export async function configureDatabase(next: SqlDriver): Promise<void> {
  driver = next;
  db = makeDb((sql, params, method) => queue.run(() => next.query(sql, params, method)));
  await queue.run(() => migrate(next));
}

export function isDatabaseReady(): boolean {
  return db !== null;
}

export function getDriverInfo(): { description: string; persistent: boolean } | null {
  return driver ? { description: driver.description, persistent: driver.persistent } : null;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not configured. Call configureDatabase() first.');
  return db;
}

/**
 * Runs `work` inside a transaction. Use the `tx` handle for every statement:
 * the global queue is held for the whole transaction, so other callers wait
 * instead of interleaving with it.
 */
export function withTransaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  const d = driver;
  if (!d) return Promise.reject(new Error('Database not configured.'));
  return queue.run(async () => {
    const tx = makeDb((sql, params, method) => d.query(sql, params, method));
    await d.exec('BEGIN');
    try {
      const result = await work(tx);
      await d.exec('COMMIT');
      return result;
    } catch (error) {
      await d.exec('ROLLBACK');
      throw error;
    }
  });
}

/** Raw multi-statement SQL (used by reset). */
export function execRaw(sql: string): Promise<void> {
  const d = driver;
  if (!d) return Promise.reject(new Error('Database not configured.'));
  return queue.run(() => d.exec(sql));
}
