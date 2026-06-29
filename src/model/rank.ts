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
 * Size of the leading "top cluster" via Otsu's method (maximize between-class
 * variance ≡ minimize within-class variance) applied to the *top window* of
 * scores.
 *
 * Otsu over the whole candidate set is the wrong tool: the score distribution is
 * roughly unimodal, so the best 2-way split lands near the median (≈half the
 * books "above the line"). Restricting Otsu to the strongest `windowSize`
 * candidates gives it the next tier to contrast against, so it cleanly separates
 * the genuine top cluster (e.g. Luke → the three Gospels) from the rest.
 *
 * Returns the count of books in the high-score class (≥ 1). For an essentially
 * flat window (no real separation) it returns `ranked.length`, so the caller
 * draws no divider.
 */
export function topClusterCount(ranked: RankedBook[], windowSize = 12): number {
  const n = ranked.length;
  if (n <= 1) return n;
  const k = Math.min(windowSize, n);

  // ascending scores of the top-k candidates (ranked is already sorted desc)
  const xs = ranked
    .slice(0, k)
    .map((r) => r.predictedZ)
    .sort((a, b) => a - b);
  const prefix = [0];
  for (const v of xs) prefix.push(prefix[prefix.length - 1] + v);
  const total = prefix[k];

  let bestSplit = 0;
  let bestVar = -Infinity;
  for (let i = 1; i < k; i++) {
    // lower class = xs[0..i), upper class = xs[i..k)
    const w0 = i / k;
    const w1 = 1 - w0;
    const mu0 = prefix[i] / i;
    const mu1 = (total - prefix[i]) / (k - i);
    const between = w0 * w1 * (mu0 - mu1) ** 2;
    if (between > bestVar) {
      bestVar = between;
      bestSplit = i;
    }
  }

  if (bestVar <= 1e-12) return n; // flat window → no meaningful cluster
  return k - bestSplit; // size of the upper (high-score) class
}
