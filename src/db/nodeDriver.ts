import { normalizeParams, type QueryMethod, type SqlDriver } from './driver';

/** `node:sqlite` driver for tests and scripts. Not bundled into the app. */
export function openNodeDriver(path = ':memory:'): SqlDriver {
  // Loaded lazily so bundlers never see the Node built-in.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  return {
    description: `node:sqlite ${path}`,
    persistent: path !== ':memory:',
    async exec(sql) {
      db.exec(sql);
    },
    async query(sql: string, params: unknown[], method: QueryMethod) {
      const statement = db.prepare(sql);
      const bound = normalizeParams(params) as (string | number | null | Uint8Array)[];
      if (method === 'run') {
        statement.run(...bound);
        return [];
      }
      statement.setReturnArrays(true);
      if (method === 'get') return statement.get(...bound) as unknown as unknown[] | undefined;
      return statement.all(...bound) as unknown as unknown[][];
    },
  };
}
