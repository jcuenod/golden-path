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

// Abramowitz-Stegun erf (max error ~1.5e-7) → normal CDF, mapped to a 0..100
// "relative fit" percentile. This is the number shown on each bar, and the
// quantity the cluster cut-off is computed on, so the divider lines up with the
// figures the user sees.
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function fitPercentile(withinPoolZ: number): number {
  return Math.round(100 * normalCdf(withinPoolZ));
}

/**
 * Leading-cluster cut-off: the number of books before the largest drop in
 * relative fit among the top `cap` positions.
 *
 * Computed on the displayed fit percentile (not the raw z) so the cut matches
 * the numbers on the bars — a tier like "…88" that then drops to "79" cuts
 * after the 88. `cap` keeps the recommended set a tight shortlist; ties resolve
 * to the earlier (more restrictive) cut.
 */
export function naturalBreak(ranked: RankedBook[], cap = 5): number {
  const n = ranked.length;
  if (n <= 1) return n;
  const limit = Math.min(cap, n - 1);
  let best = 1;
  let bestGap = -Infinity;
  for (let i = 1; i <= limit; i++) {
    const gap = fitPercentile(ranked[i - 1].withinPoolZ) - fitPercentile(ranked[i].withinPoolZ);
    if (gap > bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}
