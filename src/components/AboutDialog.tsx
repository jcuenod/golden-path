import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  spearman: number;
}

export function AboutDialog({ open, onClose, spearman }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="About this tool"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>About this tool</h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal__body">
          <p>
            When a team starts translating the Bible into a new language, a
            computer can help by drafting passages automatically. But those drafts
            are much better for some books than others — and which books draft
            well depends on what the team has <em>already</em> translated.
          </p>
          <p>
            Tell this tool which books you’ve finished, and it suggests what to
            translate next: the books the computer is most likely to draft well,
            so your team spends less time fixing rough drafts. It’s a planning
            aid for sequencing a project — everything runs privately in your
            browser.
          </p>
          <h3>How to read the chart</h3>
          <ul>
            <li>
              <strong>Longer bars are better picks.</strong> The length of each
              bar shows how good a fit a book is, compared with the other
              remaining books.
            </li>
            <li>
              <strong>The green bubble shows how long the book is</strong> — a
              bigger bubble means more verses to translate.
            </li>
            <li>
              <strong>The divider</strong> marks where quality starts to drop off:
              books below it are less promising next steps.
            </li>
            <li>
              Use the <strong>Include OT</strong> switch to focus only on the New
              Testament, and <strong>Show all</strong> to see every book.
            </li>
          </ul>
          <p>
            Think of it as a <strong>shortlist to discuss</strong>, not a verdict.
            It reflects how easy a book is to draft, not how important it is to
            translate — that judgement stays with your team.
          </p>

          <details className="modal__note">
            <summary>For the technically curious</summary>
            <p>
              This is the source-side reranker from{" "}
              <a href="golden_path.pdf" target="_blank" rel="noopener noreferrer">
                “Predicting Bible Translation Draft Quality from Source-Side
                Passage Signals”
              </a>{" "}
              (PDF). A gradient-boosting model predicts the <em>within-group
              standardized</em> case-normalized <strong>chrF++</strong> of an
              NLLB-style draft, from source-side features only: TF–IDF word and
              character overlap between the translated books and each candidate,
              plus the candidate’s intrinsic difficulty (frequency-weighted token
              coverage, proper-noun density, corpus-relative cross-entropy/KL,
              verse length, type–token ratio).
            </p>
            <p>
              It is a <strong>relative, within-pool ranking</strong>, not an
              absolute-quality forecast, and it predicts <em>reference-overlap</em>{" "}
              quality (chrF++) specifically. Validated by
              leave-one-language-direction-out cross-validation — mean rank
              correlation <strong>ρ ≈ {spearman.toFixed(2)}</strong>. The first
              few recommendations are the most reliable; selecting many books
              pushes the model beyond its training support and the remaining
              candidates converge. The model and all computation are compiled to
              run client-side.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
