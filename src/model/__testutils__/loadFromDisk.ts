import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeModel } from "../loadModel";
import type { Model, RawAssets } from "../types";

// Test-only helper: load the serialized artifacts straight from public/model so
// tests exercise exactly the bytes the browser fetches. Not imported by the app
// entry, so it is never bundled into the client.
const MODEL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/model");

export function loadRawFromDisk(): RawAssets {
  const json = <T>(f: string): T => JSON.parse(readFileSync(resolve(MODEL_DIR, f), "utf8"));
  const u8 = (f: string): Uint8Array => {
    const b = readFileSync(resolve(MODEL_DIR, f));
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  };
  const u32 = (f: string): Uint32Array => {
    const b = readFileSync(resolve(MODEL_DIR, f));
    return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  };
  return {
    gbm: json("gbm.json"),
    books: json("books.json"),
    pairsIndex: json("pairs_index.json"),
    tokens: json("tokens.json"),
    tgtmaxWord: u8("tgtmax_word.u8"),
    tgtmaxChar: u8("tgtmax_char.u8"),
    histWord: u32("hist_word.u32"),
    histChar: u32("hist_char.u32"),
  };
}

export function loadModelFromDisk(): Model {
  return decodeModel(loadRawFromDisk());
}

export function loadFixtures(): { selected: string[]; scores: Record<string, number> }[] {
  return JSON.parse(readFileSync(resolve(MODEL_DIR, "parity_fixtures.json"), "utf8")).fixtures;
}
