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
