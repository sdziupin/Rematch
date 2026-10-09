/**
 * The web database lives in the origin-private file system, which only one tab
 * can hold at a time (and expo-sqlite can't recover once a second tab tries).
 * A Web Lock decides which tab owns the data; another tab can take over.
 */
export type TabStatus = 'owner' | 'elsewhere' | 'no-storage';

const LOCK = 'rematch-database';
const MOVED = 'rematch-moved-to-another-tab';

type Locks = {
  request: (name: string, options: { ifAvailable?: boolean; steal?: boolean }, cb: (lock: unknown) => Promise<unknown> | unknown) => Promise<unknown>;
};

function locks(): Locks | null {
  return typeof navigator !== 'undefined' && 'locks' in navigator ? (navigator as unknown as { locks: Locks }).locks : null;
}

async function storageAvailable(): Promise<boolean> {
  try {
    const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<unknown> };
    if (!storage?.getDirectory) return false;
    await storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

export async function claimTab(): Promise<TabStatus> {
  if (!(await storageAvailable())) return 'no-storage';
  try {
    if (sessionStorage.getItem(MOVED)) return 'elsewhere';
  } catch {
    // sessionStorage blocked: carry on.
  }
  const l = locks();
  if (!l) return 'owner';
  return new Promise<TabStatus>((resolve) => {
    l.request(LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve('elsewhere');
        return undefined;
      }
      resolve('owner');
      // Hold the lock for the life of the tab.
      return new Promise(() => undefined);
    }).catch(() => {
      // Another tab took over: hand the data back by reloading into the "moved" state,
      // which releases this tab's file handles.
      try {
        sessionStorage.setItem(MOVED, '1');
      } catch {
        // ignore
      }
      window.location.reload();
    });
  });
}

/** Takes the data over from the other tab, then reloads to open it here. */
export async function takeOverTab(): Promise<void> {
  try {
    sessionStorage.removeItem(MOVED);
  } catch {
    // ignore
  }
  const l = locks();
  if (l) await l.request(LOCK, { steal: true }, () => undefined).catch(() => undefined);
  // Give the other tab a moment to reload and release its file handles.
  setTimeout(() => window.location.reload(), 900);
}
