/**
 * Minimal async SQL driver the app talks to. The app uses expo-sqlite's async
 * API (see `expoDriver.ts`); tests use Node's built-in `node:sqlite`.
 *
 * Only the async API is used on purpose: on the web, expo-sqlite's synchronous
 * calls busy-wait the main thread and time out while the worker boots.
 */
export type QueryMethod = 'run' | 'all' | 'get' | 'values';

export interface SqlDriver {
  /** Rows come back as arrays of column values, in select order. */
  query(sql: string, params: unknown[], method: QueryMethod): Promise<unknown[][] | unknown[] | undefined>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  /** Human-readable note about where data lives (shown in settings). */
  readonly description: string;
  /** False when data will not survive a reload (private browsing, second tab). */
  readonly persistent: boolean;
}

/** Runs async work one item at a time so statements never interleave. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export function normalizeParams(params: unknown[]): (string | number | null | Uint8Array)[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'bigint') return Number(p);
    if (p instanceof Uint8Array) return p;
    if (typeof p === 'object') return JSON.stringify(p);
    return p as string | number;
  });
}
