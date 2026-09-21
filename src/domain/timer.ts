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
