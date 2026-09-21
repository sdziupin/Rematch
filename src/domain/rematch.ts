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
