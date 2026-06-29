import type { GbmModel } from "./types";

/** Evaluate one regression tree (sklearn convention: x <= threshold -> left). */
function evalTree(tree: GbmModel["trees"][number], x: number[]): number {
  let node = 0;
  while (tree.left[node] !== -1) {
    node = x[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
  }
  return tree.value[node];
}

/** Mean over the seed ensemble of (init + lr * sum of tree leaf values). */
export function predictZ(models: GbmModel[], x: number[]): number {
  let total = 0;
  for (const m of models) {
    let acc = m.init;
    for (const tree of m.trees) acc += m.learning_rate * evalTree(tree, x);
    total += acc;
  }
  return total / models.length;
}
