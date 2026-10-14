/** Live Activity content for a running workout. Plain values: they cross into the widget runtime. */
export interface WorkoutActivityProps {
  name: string;
  color: string;
  /** What to do now, e.g. "10 Burpees" or "Rest". */
  step: string;
  /** e.g. "Round 2 of 5". */
  detail: string;
  /** Epoch ms the clock counts up from (now minus active time). */
  anchor: number;
  paused: boolean;
  /** Frozen clock while paused. */
  elapsedLabel: string;
  /** Gap to the opponent, e.g. "−0:12", or empty without one. */
  delta: string;
  deltaTone: 'ahead' | 'behind' | 'even';
}
