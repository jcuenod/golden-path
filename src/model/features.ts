import type { Model } from "./types";

// Recombine the per-(selected_book, candidate_book) primitives into the
// deployment feature vector for a *union* of selected books, mirroring
// `features_from_primitives` in export_recommender_model.py exactly. See the
// model README for the union algebra.

/** Mean of the top 10% of values from a summed histogram (approx aggregate_top10). */
function top10FromHist(counts: Float64Array, centers: Float64Array): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i];
  if (total === 0) return 0;
  const k = Math.max(1, Math.ceil(total * 0.1));
  let remaining = k;
  let acc = 0;
  for (let b = counts.length - 1; b >= 0; b--) {
    const c = counts[b];
    if (c <= 0) continue;
    const take = c < remaining ? c : remaining;
    acc += take * centers[b];
    remaining -= take;
    if (remaining <= 0) break;
  }
  return acc / k;
}

/** q-th quantile from a summed histogram (linear within the crossing bin). */
function quantileFromHist(counts: Float64Array, edges: Float64Array, q: number): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i];
  if (total === 0) return 0;
  const target = q * total;
  let cum = 0;
  for (let b = 0; b < counts.length; b++) {
    const c = counts[b];
    if (c > 0 && cum + c >= target) {
      return edges[b] + ((target - cum) / c) * (edges[b + 1] - edges[b]);
    }
    cum += c;
  }
  return edges[edges.length - 1];
}

/** Cache the histogram bin edges/centers per model instance. */
const binCache = new WeakMap<Model, { edges: Float64Array; centers: Float64Array }>();
function bins(model: Model) {
  let b = binCache.get(model);
  if (!b) {
    const n = model.bins;
    const edges = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) edges[i] = i / n;
    const centers = new Float64Array(n);
    for (let i = 0; i < n; i++) centers[i] = (edges[i] + edges[i + 1]) / 2;
    b = { edges, centers };
    binCache.set(model, b);
  }
  return b;
}

/**
 * Build the feature vector (in model.featureOrder) for candidate `cIdx`, given
 * the selected (already-translated) book indices `selected` as the train side.
 */
export function buildFeatureVector(model: Model, selected: number[], cIdx: number): number[] {
  const mC = model.verseCounts[cIdx];
  const wordMax = new Float64Array(mC);
  const charMax = new Float64Array(mC);
  const wHist = new Float64Array(model.bins);
  const cHist = new Float64Array(model.bins);
  const scale = model.tgtmaxScale;

  let wSum = 0;
  let wCov = 0;
  let nTrain = 0;
  const trainCounts = new Map<number, number>();

  for (const s of selected) {
    const p = model.pairIndexMatrix[s][cIdx];
    const off = model.tgtmaxOffsets[p];
    for (let t = 0; t < mC; t++) {
      const w = model.tgtmaxWord[off + t] / scale;
      if (w > wordMax[t]) wordMax[t] = w;
      const c = model.tgtmaxChar[off + t] / scale;
      if (c > charMax[t]) charMax[t] = c;
    }
    wSum += model.wSum[p];
    wCov += model.wCovCount[p];
    nTrain += model.verseCounts[s];
    const hOff = p * model.bins;
    for (let b = 0; b < model.bins; b++) {
      wHist[b] += model.histWord[hOff + b];
      cHist[b] += model.histChar[hOff + b];
    }
    for (const [tid, count] of model.bookTokenCounts[s]) {
      trainCounts.set(tid, (trainCounts.get(tid) ?? 0) + count);
    }
  }

  // coverage features from the candidate's own token counts vs the union train side
  const testCounts = model.bookTokenCounts[cIdx];
  let nTest = 0;
  for (const c of testCounts.values()) nTest += c;
  nTest = Math.max(1, nTest);
  let covFreqNum = 0;
  let covTypeNum = 0;
  let covWeightedNum = 0;
  for (const [tid, count] of testCounts) {
    const trainCount = trainCounts.get(tid);
    if (trainCount !== undefined) {
      covFreqNum += count;
      covTypeNum += 1;
      covWeightedNum += Math.min(count, trainCount);
    }
  }

  let wordMaxSum = 0;
  let charMaxSum = 0;
  for (let t = 0; t < mC; t++) {
    wordMaxSum += wordMax[t];
    charMaxSum += charMax[t];
  }

  const { edges, centers } = bins(model);
  const feats: Record<string, number> = {
    w_top10: top10FromHist(wHist, centers),
    w_q95: quantileFromHist(wHist, edges, 0.95),
    w_mean: wSum / (nTrain * mC),
    w_tgtbest: wordMaxSum / mC,
    w_cov: wCov / nTrain,
    c_top10: top10FromHist(cHist, centers),
    c_tgtbest: charMaxSum / mC,
    cov_freq: covFreqNum / nTest,
    cov_type: covTypeNum / Math.max(1, testCounts.size),
    cov_count_weighted: covWeightedNum / nTest,
  };

  const intrinsic = model.meta[model.order[cIdx]].intrinsic;
  return model.featureOrder.map((f) => (f in feats ? feats[f] : intrinsic[f]));
}
