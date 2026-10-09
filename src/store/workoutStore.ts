import { create } from 'zustand';
import type { ActiveWorkoutState } from '../domain/types';
import type { OpponentCheckpoint } from '../domain/rematch';
import type { TimerSnapshot } from '../domain/timer';
import { createTimerSnapshot } from '../domain/timer';

interface WorkoutStore {
  sessionId: string | null;
  state: ActiveWorkoutState | null;
  timer: TimerSnapshot;
  opponentSessionId: string | null;
  /** Live telemetry recorded in this session (mirrors the DB). */
  yourCheckpoints: OpponentCheckpoint[];
  setSession: (sessionId: string, state: ActiveWorkoutState, opponentSessionId?: string | null, timer?: TimerSnapshot, checkpoints?: OpponentCheckpoint[]) => void;
  setState: (state: ActiveWorkoutState) => void;
  setTimer: (timer: TimerSnapshot) => void;
  addCheckpoints: (checkpoints: OpponentCheckpoint[]) => void;
  clear: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  sessionId: null,
  state: null,
  timer: createTimerSnapshot(),
  opponentSessionId: null,
  yourCheckpoints: [],
  setSession: (sessionId, state, opponentSessionId = null, timer, checkpoints) =>
    set({ sessionId, state, opponentSessionId, timer: timer ?? createTimerSnapshot(), yourCheckpoints: checkpoints ?? [] }),
  setState: (state) => set({ state }),
  setTimer: (timer) => set({ timer }),
  addCheckpoints: (checkpoints) => set((s) => ({ yourCheckpoints: [...s.yourCheckpoints, ...checkpoints] })),
  clear: () => set({ sessionId: null, state: null, timer: createTimerSnapshot(), opponentSessionId: null, yourCheckpoints: [] }),
}));
