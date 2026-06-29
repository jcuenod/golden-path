# Bible draft-order recommender

A self-contained web app that helps a translation team decide **which book to
draft next**. Mark the books you have already translated; the app ranks every
remaining book of the Bible by the draft quality a fine-tuned MT system is
likely to produce, using only source-side signal — and animates the ranking as
you change your selection.

The model runs **entirely in the browser**. There is no backend.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static bundle in dist/  (deploy anywhere, e.g. GitHub Pages)
npm test         # parity + UI smoke tests
```

`dist/` is fully static — host it on any static file server / CDN. The build
uses `base: "./"` so it also works from a subpath.

## What it is

This is the source-side reranker from *“Predicting Bible Translation Draft
Quality from Source-Side Passage Signals.”* A gradient-boosting model
(`GradientBoostingRegressor`, 8-seed ensemble) predicts *within-group
standardized* case-normalized chrF++ from:

- train/candidate **lexical & character TF-IDF overlap**, and
- the candidate book's **intrinsic difficulty** (coverage, proper-noun density,
  corpus-relative entropy, length, lexical diversity).

It is a **relative ranking / triage aid**, not an absolute-quality forecaster.
Validated by leave-one-language-direction-out cross-validation (mean rank
correlation ρ ≈ 0.77).

## How the model gets here (the only tie to the rest of the repo)

`client/` is otherwise standalone. The model artifacts in
[`public/model/`](public/model/) are produced by
[`../export_recommender_model.py`](../export_recommender_model.py) (repo root),
which trains the ensemble on `all_scores.csv` + `all_scores_2.csv` and
precomputes the per-book-pair primitives that let the browser recombine features
for any selection. To regenerate:

```bash
cd ..               # repo root (needs en-NIV11.txt, niv11.tsv, all_scores*.csv, vref_utils)
python export_recommender_model.py
```

See [`public/model/README.md`](public/model/README.md) for the artifact format
and the union algebra that makes arbitrary multi-book selection exact.

## Architecture

```
src/model/      TS port of the model (loaded from public/model/ at runtime)
  loadModel.ts    fetch + decode artifacts
  features.ts     recombine per-pair primitives for a union of selected books
  gbm.ts          decision-tree ensemble evaluation
  rank.ts         rankCandidates() + natural-break cutoff
  model.test.ts   parity vs the notebook's exact rank_candidates (fixtures)
src/components/
  BookSelector    OT/NT book grid, per-section select-all
  RankedPlot      animated ranked bars (framer-motion), length indicators
App.tsx           selection state, OT filter, expand/collapse
```

The `model.test.ts` parity test asserts the TS ranking matches the Python
ground truth (`public/model/parity_fixtures.json`) — i.e. the compiled client
model is the same model the paper validated.
