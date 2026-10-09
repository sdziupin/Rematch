import type { ScalingCategory } from './types';

/** [RX movement, easier, easier still] following `easierVariantId` links (cycle-safe). */
export function easierChain(exerciseId: string, easierOf: (id: string) => string | null | undefined, maxDepth = 2): string[] {
  const chain = [exerciseId];
  let current = exerciseId;
  for (let i = 0; i < maxDepth; i++) {
    const next = easierOf(current);
    if (!next || chain.includes(next)) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

/** One step down the ladder is "scaled", two or more is "modified". */
export function categoryForSwaps(swaps: Record<string, string>, chainOf: (rx: string) => string[]): ScalingCategory {
  let depth = 0;
  for (const [rx, chosen] of Object.entries(swaps)) {
    if (rx === chosen) continue;
    const idx = chainOf(rx).indexOf(chosen);
    depth = Math.max(depth, idx < 0 ? 2 : idx);
  }
  return depth === 0 ? 'rx' : depth === 1 ? 'scaled' : 'modified';
}

/** Applies the same scaling level to every movement that has an easier option. */
export function presetSwaps(exerciseIds: string[], chainOf: (rx: string) => string[], level: 0 | 1 | 2): Record<string, string> {
  const swaps: Record<string, string> = {};
  if (level === 0) return swaps;
  for (const id of exerciseIds) {
    const chain = chainOf(id);
    const pick = chain[Math.min(level, chain.length - 1)];
    if (pick !== id) swaps[id] = pick;
  }
  return swaps;
}

export const SCALING_LABELS: Record<ScalingCategory, string> = { rx: 'RX', scaled: 'Scaled', modified: 'Modified' };
