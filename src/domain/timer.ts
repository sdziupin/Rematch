export interface TimerSnapshot {
  startedAt: number | null;
  pausedAccumulatedMs: number;
  lastPausedAt: number | null;
  isPaused: boolean;
}

export function createTimerSnapshot(): TimerSnapshot {
  return {
    startedAt: null,
    pausedAccumulatedMs: 0,
    lastPausedAt: null,
    isPaused: false,
  };
}

export function startTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (snapshot.startedAt !== null) return snapshot;
  return { ...snapshot, startedAt: now, isPaused: false, lastPausedAt: null };
}

export function pauseTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (snapshot.isPaused || snapshot.startedAt === null) return snapshot;
  return { ...snapshot, isPaused: true, lastPausedAt: now };
}

export function resumeTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (!snapshot.isPaused || snapshot.lastPausedAt === null) return snapshot;
  const pauseDuration = now - snapshot.lastPausedAt;
  return {
    ...snapshot,
    isPaused: false,
    lastPausedAt: null,
    pausedAccumulatedMs: snapshot.pausedAccumulatedMs + pauseDuration,
  };
}

export function getElapsedActiveMs(snapshot: TimerSnapshot, now = Date.now()): number {
  if (snapshot.startedAt === null) return 0;
  const pauseExtra = snapshot.isPaused && snapshot.lastPausedAt
    ? now - snapshot.lastPausedAt
    : 0;
  return Math.max(0, now - snapshot.startedAt - snapshot.pausedAccumulatedMs - pauseExtra);
}

export function restoreTimerFromElapsed(elapsedActiveMs: number, isPaused: boolean, now = Date.now()): TimerSnapshot {
  return {
    startedAt: now - elapsedActiveMs,
    pausedAccumulatedMs: 0,
    lastPausedAt: isPaused ? now : null,
    isPaused,
  };
}
