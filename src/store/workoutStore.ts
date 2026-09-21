import { create } from 'zustand';
import type { ActiveWorkoutState } from '../domain/types';
import type { TimerSnapshot } from '../domain/timer';
import { createTimerSnapshot } from '../domain/timer';

interface WorkoutStore {
  sessionId: string | null;
  state: ActiveWorkoutState | null;
  timer: TimerSnapshot;
  opponentSessionId: string | null;
  setSession: (sessionId: string, state: ActiveWorkoutState, opponentSessionId?: string | null) => void;
  setState: (state: ActiveWorkoutState) => void;
  setTimer: (timer: TimerSnapshot) => void;
  clear: () => void;
