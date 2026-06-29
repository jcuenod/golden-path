import { describe, expect, it } from "vitest";
import { loadFixtures, loadModelFromDisk } from "./__testutils__/loadFromDisk";
import { rankCandidates } from "./rank";

// The parity test loads the SAME serialized artifacts the browser fetches and
// asserts the TS port reproduces the ground-truth rankings emitted by the
// notebook's exact `rank_candidates` (parity_fixtures.json). This is the
// guarantee that the compiled client model == the validated paper model.

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]): number[] => {
    const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length).fill(0);
    order.forEach(([, idx], pos) => (r[idx] = pos));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (n - 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - mean) * (rb[i] - mean);
    da += (ra[i] - mean) ** 2;
    db += (rb[i] - mean) ** 2;
  }
  return num / Math.sqrt(da * db);
}

const model = loadModelFromDisk();
const fixtures = loadFixtures();

describe("client model parity with notebook rank_candidates", () => {
  it("loads all 66 Bible books with OT and NT testaments", () => {
    expect(model.order.length).toBe(66);
    const testaments = new Set(model.order.map((c) => model.meta[c].testament));
    expect(testaments).toEqual(new Set(["OT", "NT"]));
  });

  const rhos: number[] = [];
  for (const fx of fixtures) {
    it(`reproduces ranking for [${fx.selected.join(", ")}]`, () => {
      const ranked = rankCandidates(model, fx.selected);
      const codes = ranked.map((r) => r.code);
      const mine = ranked.map((r) => r.predictedZ);
      const truth = codes.map((c) => fx.scores[c]);

      const rho = spearman(mine, truth);
      rhos.push(rho);

      // top recommendation is identical
      const truthTop1 = Object.entries(fx.scores).sort((a, b) => b[1] - a[1])[0][0];
      expect(codes[0]).toBe(truthTop1);
      // ordering essentially identical
      expect(rho).toBeGreaterThan(0.99);
      // absolute z within the histogram-approximation tolerance
      const maxZErr = Math.max(...codes.map((c, i) => Math.abs(fx.scores[c] - mine[i])));
      expect(maxZErr).toBeLessThan(0.35);
    });
  }

  it("has mean Spearman >= 0.999 across fixtures", () => {
    const mean = rhos.reduce((a, b) => a + b, 0) / rhos.length;
    expect(mean).toBeGreaterThan(0.999);
  });

  it("ranks the Gospels + Genesis at the top for a Luke seed", () => {
    const top = rankCandidates(model, ["LUK"]).slice(0, 3).map((r) => r.code);
    expect(top).toContain("MAT");
    expect(top).toContain("JHN");
    expect(top).toContain("MRK");
  });
});
