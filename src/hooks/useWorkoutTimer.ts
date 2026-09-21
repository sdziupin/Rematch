import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getElapsedActiveMs, pauseTimer, resumeTimer, startTimer, type TimerSnapshot } from '../domain/timer';

export function useWorkoutTimer(snapshot: TimerSnapshot, onTick?: (ms: number) => void) {
  const [elapsed, setElapsed] = useState(0);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    const id = setInterval(() => {
      const ms = getElapsedActiveMs(snapshotRef.current);
      setElapsed(ms);
      onTick?.(ms);
    }, 250);
    return () => clearInterval(id);
  }, [onTick]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setElapsed(getElapsedActiveMs(snapshotRef.current));
      }
    });
    return () => sub.remove();
  }, []);

  return elapsed;
}

export function useTimerControls() {
  return {
    start: (s: TimerSnapshot, now = Date.now()) => startTimer(s, now),
    pause: (s: TimerSnapshot, now = Date.now()) => pauseTimer(s, now),
    resume: (s: TimerSnapshot, now = Date.now()) => resumeTimer(s, now),
    elapsed: getElapsedActiveMs,
  };
}
