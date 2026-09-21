import type { CheckpointComparison, RematchComparison } from './types';

export interface OpponentCheckpoint {
  checkpointKey: string;
  label: string;
  elapsedActiveMs: number;
}

export function compareCheckpoints(
  yourCheckpoints: OpponentCheckpoint[],
  opponentCheckpoints: OpponentCheckpoint[],
  yourFinalMs: number,
  opponentFinalMs: number,
): RematchComparison {
  const opponentMap = new Map(opponentCheckpoints.map((c) => [c.checkpointKey, c]));
  const comparisons: CheckpointComparison[] = [];

  for (const yours of yourCheckpoints) {
    const opp = opponentMap.get(yours.checkpointKey);
    if (!opp) continue;
    comparisons.push({
      checkpointKey: yours.checkpointKey,
      label: yours.label,
      youMs: yours.elapsedActiveMs,
      opponentMs: opp.elapsedActiveMs,
      deltaMs: yours.elapsedActiveMs - opp.elapsedActiveMs,
    });
  }

  const deltaMs = yourFinalMs - opponentFinalMs;
  return {
    youMs: yourFinalMs,
    opponentMs: opponentFinalMs,
    deltaMs,
    won: deltaMs < 0,
    tied: deltaMs === 0,
    checkpoints: comparisons,
    isNewPb: false,
    previousPbMs: null,
  };
}

export function getLiveDelta(
  yourElapsedMs: number,
  opponentCheckpoints: OpponentCheckpoint[],
  currentCheckpointKey: string,
): number | null {
  const lastCompleted = [...opponentCheckpoints]
    .filter((c) => c.checkpointKey <= currentCheckpointKey)
    .sort((a, b) => b.elapsedActiveMs - a.elapsedActiveMs)[0];
  if (!lastCompleted) return null;
  return yourElapsedMs - lastCompleted.elapsedActiveMs;
}

export function getOpponentProgress(
  opponentCheckpoints: OpponentCheckpoint[],
  opponentFinalMs: number,
  yourElapsedMs: number,
): number {
  if (opponentCheckpoints.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < opponentCheckpoints.length; i++) {
    if (yourElapsedMs >= opponentCheckpoints[i].elapsedActiveMs) idx = i + 1;
  }
  return Math.min(1, idx / opponentCheckpoints.length);
}
