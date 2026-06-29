import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { BookSelector } from "./components/BookSelector";
import { BookOpenIcon, InfoIcon } from "./components/icons";
import { RankedPlot } from "./components/RankedPlot";
import { loadModel } from "./model/loadModel";
import { rankCandidates } from "./model/rank";
import type { Model } from "./model/types";

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 520;

export default function App() {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excludeOT, setExcludeOT] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sidebarW, setSidebarW] = useState(320);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadModel()
      .then(setModel)
      .catch((e) => setError(String(e)));
  }, []);

  const toggle = useCallback((code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }, []);

  const toggleSection = useCallback((codes: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = codes.length > 0 && codes.every((c) => next.has(c));
      for (const c of codes) (allOn ? next.delete(c) : next.add(c));
      return next;
    });
  }, []);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSidebarW(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX - rect.left)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  const maxVerses = useMemo(
    () => (model ? Math.max(...model.order.map((c) => model.meta[c].verses)) : 1),
    [model],
  );

  const ranked = useMemo(
    () =>
      model
        ? rankCandidates(model, [...selected], { excludeTestaments: excludeOT ? ["OT"] : [] })
        : [],
    [model, selected, excludeOT],
  );

  const selectedList = useMemo(
    () => (model ? model.order.filter((c) => selected.has(c)) : []),
    [model, selected],
  );

  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <span className="brand__mark">
            <BookOpenIcon />
          </span>
          <span className="brand__name">Draft&nbsp;Next</span>
          <span className="brand__sub">Bible translation order planner</span>
        </div>
        <div className="appbar__actions">
          {model && (
            <label className="switch" title="Hide Old Testament books from the recommendations">
              <input
                type="checkbox"
                checked={!excludeOT}
                onChange={(e) => setExcludeOT(!e.target.checked)}
              />
              <span className="switch__track" aria-hidden>
                <span className="switch__thumb" />
              </span>
              <span className="switch__label">Include OT</span>
            </label>
          )}
          <button type="button" className="btn-ghost btn-icon" onClick={() => setAboutOpen(true)}>
            <InfoIcon />
            About
          </button>
        </div>
      </header>

      {error && <div className="banner banner--error">Could not load the model: {error}</div>}
      {!model && !error && <div className="banner">Loading model…</div>}

      {model && (
        <div className="shell__body" ref={bodyRef}>
          <aside className="pane pane--side" style={{ width: sidebarW }}>
            <div className="pane__head">
              <h2 className="pane__title">Already translated</h2>
              <span className="pane__meta">{selected.size}</span>
            </div>
            <div className="pane__scroll">
              <BookSelector
                model={model}
                selected={selected}
                onToggle={toggle}
                onToggleSection={toggleSection}
              />
            </div>
          </aside>

          <div
            className="divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            onPointerDown={startResize}
          />

          <main className="pane pane--main">
            <div className="selstrip">
              {selectedList.length === 0 ? (
                <span className="selstrip__hint">
                  Select the book(s) you’ve translated in the left panel.
                </span>
              ) : (
                <>
                  <span className="selstrip__label">Given:</span>
                  <div className="selstrip__chips">
                    {selectedList.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`pill pill--${model.meta[c].testament.toLowerCase()}`}
                        title={`Remove ${model.meta[c].name}`}
                        onClick={() => toggle(c)}
                      >
                        {c}
                        <span aria-hidden>×</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </>
              )}
            </div>

            <div className="pane__scroll">
              <RankedPlot
                ranked={ranked}
                selectedCount={selected.size}
                maxVerses={maxVerses}
                expanded={expanded}
                onToggleExpand={() => setExpanded((v) => !v)}
              />
            </div>
          </main>
        </div>
      )}

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        spearman={model?.leaveDirectionSpearman ?? 0}
      />
    </div>
  );
}
