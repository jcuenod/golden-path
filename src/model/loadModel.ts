import type { Model, RawAssets } from "./types";

/** Decode raw artifacts into an inference-ready Model. Pure (no I/O), so the
 *  same path is exercised by the browser loader and the vitest parity test. */
export function decodeModel(raw: RawAssets): Model {
  const order = raw.pairsIndex.books;
  const index = new Map(order.map((code, i) => [code, i] as const));

  const bookTokenCounts: Map<number, number>[] = order.map((code) => {
    const m = new Map<number, number>();
    for (const [tid, count] of raw.tokens.books[code]) m.set(tid, count);
    return m;
  });

  return {
    order,
    meta: raw.books.books,
    index,
    verseCounts: raw.pairsIndex.verseCounts,
    bins: raw.pairsIndex.bins,
    covThreshold: raw.pairsIndex.covThreshold,
    tgtmaxScale: raw.pairsIndex.tgtmaxScale,
    tgtmaxOffsets: raw.pairsIndex.tgtmaxOffsets,
    pairIndexMatrix: raw.pairsIndex.pairIndexMatrix,
    wSum: raw.pairsIndex.wSum,
    wCovCount: raw.pairsIndex.wCovCount,
    tgtmaxWord: raw.tgtmaxWord,
    tgtmaxChar: raw.tgtmaxChar,
    histWord: raw.histWord,
    histChar: raw.histChar,
    bookTokenCounts,
    featureOrder: raw.gbm.featureOrder,
    models: raw.gbm.models,
    calibration: raw.gbm.calibration,
    leaveDirectionSpearman: raw.gbm.leaveDirectionSpearman,
  };
}

/** Browser loader: fetch the artifact bundle and decode it. */
export async function loadModel(baseUrl = "model/"): Promise<Model> {
  const url = (f: string) => new URL(baseUrl + f, document.baseURI).href;
  const json = async <T>(f: string): Promise<T> => (await fetch(url(f))).json();
  const buf = async (f: string): Promise<ArrayBuffer> =>
    (await fetch(url(f))).arrayBuffer();

  const [gbm, books, pairsIndex, tokens, tgtW, tgtC, hW, hC] = await Promise.all([
    json<RawAssets["gbm"]>("gbm.json"),
    json<RawAssets["books"]>("books.json"),
    json<RawAssets["pairsIndex"]>("pairs_index.json"),
    json<RawAssets["tokens"]>("tokens.json"),
    buf("tgtmax_word.u8"),
    buf("tgtmax_char.u8"),
    buf("hist_word.u32"),
    buf("hist_char.u32"),
  ]);

  return decodeModel({
    gbm,
    books,
    pairsIndex,
    tokens,
    tgtmaxWord: new Uint8Array(tgtW),
    tgtmaxChar: new Uint8Array(tgtC),
    histWord: new Uint32Array(hW),
    histChar: new Uint32Array(hC),
  });
}
