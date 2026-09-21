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
