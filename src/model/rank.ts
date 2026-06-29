import { buildFeatureVector } from "./features";
import { predictZ } from "./gbm";
import type { Model, RankedBook, Testament } from "./types";

export interface RankOptions {
  /** Testaments to exclude from the *candidate* set (the train side is unaffected). */
  excludeTestaments?: Testament[];
}

/**
 * Rank the remaining Bible books by predicted draft quality, given the books a
 * team has already translated (`selectedCodes`). Mirrors the notebook's
 * `rank_candidates`: predict a within-(train,direction) standardized z for each
 * candidate, then standardize *within the current candidate pool* (`withinPoolZ`)
 * for a stable, relative display signal.
 *
 * Returns [] when nothing is selected (no train side) or no candidate remains.
 */
export function rankCandidates(
  model: Model,
  selectedCodes: string[],
  options: RankOptions = {},
): RankedBook[] {
  const selected = selectedCodes
    .map((c) => model.index.get(c))
    .filter((i): i is number => i !== undefined);
  if (selected.length === 0) return [];

  const selectedSet = new Set(selected);
  const excluded = new Set(options.excludeTestaments ?? []);
  const candidates = model.order
    .map((_, i) => i)
    .filter((i) => !selectedSet.has(i) && !excluded.has(model.meta[model.order[i]].testament));
  if (candidates.length === 0) return [];

  const scored = candidates.map((cIdx) => ({
    cIdx,
    z: predictZ(model.models, buildFeatureVector(model, selected, cIdx)),
  }));

  const zs = scored.map((s) => s.z);
  const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
  const variance = zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length;
  const std = Math.sqrt(variance);

  const ranked: RankedBook[] = scored.map(({ cIdx, z }) => {
    const meta = model.meta[model.order[cIdx]];
    return {
      code: meta.code,
      name: meta.name,
      testament: meta.testament,
      section: meta.section,
      verses: meta.verses,
      predictedZ: z,
      withinPoolZ: std > 1e-9 ? (z - mean) / std : 0,
      rank: 0,
    };
  });

  ranked.sort((a, b) => b.predictedZ - a.predictedZ);
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}

/**
 * Natural-break ("largest gap") cutoff over a ranked list: the number of books
 * before the biggest score drop among the leading positions. Used to highlight
 * the recommended cluster rather than a fixed top-3.
 */
export function naturalBreak(ranked: RankedBook[], maxCount = 6): number {
  if (ranked.length <= 1) return ranked.length;
  const limit = Math.min(maxCount, ranked.length - 1);
  let best = 1;
  let bestGap = -Infinity;
  for (let i = 1; i <= limit; i++) {
    const gap = ranked[i - 1].predictedZ - ranked[i].predictedZ;
    if (gap > bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}
