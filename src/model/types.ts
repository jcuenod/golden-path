// Decoded artifact types. The raw JSON/binary shapes match what
// `export_recommender_model.py` writes into `public/model/`.

export interface Tree {
  feature: number[];
  threshold: number[];
  left: number[];
  right: number[];
  value: number[];
}

export interface GbmModel {
  init: number;
  learning_rate: number;
  trees: Tree[];
}

export interface GbmJson {
  featureOrder: string[];
  calibration: { chrfMean: number; chrfStd: number };
  leaveDirectionSpearman: number;
  leaveDirectionSpearmanByRegime?: { singlePassage: number; multiPassage: number };
  trainingRows?: number;
  models: GbmModel[];
}

export type Testament = "OT" | "NT";

export interface BookMeta {
  code: string;
  name: string;
  testament: Testament;
  section: string;
  verses: number;
  intrinsic: Record<string, number>;
}

export interface BooksJson {
  order: string[];
  books: Record<string, BookMeta>;
}

export interface PairsIndex {
  books: string[];
  verseCounts: number[];
  bins: number;
  covThreshold: number;
  tgtmaxScale: number;
  pairIndexMatrix: number[][];
  tgtmaxOffsets: number[];
  wSum: number[];
  wCovCount: number[];
}

export interface TokensJson {
  tokens: string[];
  books: Record<string, [number, number][]>;
}

export interface RawAssets {
  gbm: GbmJson;
  books: BooksJson;
  pairsIndex: PairsIndex;
  tokens: TokensJson;
  tgtmaxWord: Uint8Array;
  tgtmaxChar: Uint8Array;
  histWord: Uint32Array;
  histChar: Uint32Array;
}

/** Fully decoded model, ready for inference. Book index = position in `order`. */
export interface Model {
  order: string[];
  meta: Record<string, BookMeta>;
  index: Map<string, number>;
  verseCounts: number[];
  bins: number;
  covThreshold: number;
  tgtmaxScale: number;
  tgtmaxOffsets: number[];
  pairIndexMatrix: number[][];
  wSum: number[];
  wCovCount: number[];
  tgtmaxWord: Uint8Array;
  tgtmaxChar: Uint8Array;
  histWord: Uint32Array;
  histChar: Uint32Array;
  bookTokenCounts: Map<number, number>[]; // per book index: tokenId -> count
  featureOrder: string[];
  models: GbmModel[];
  calibration: { chrfMean: number; chrfStd: number };
  leaveDirectionSpearman: number;
}

export interface RankedBook {
  code: string;
  name: string;
  testament: Testament;
  section: string;
  verses: number;
  predictedZ: number;
  withinPoolZ: number;
  rank: number;
}
