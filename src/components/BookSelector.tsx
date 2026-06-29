import { useMemo } from "react";
import type { Model, Testament } from "../model/types";

interface Props {
  model: Model;
  selected: Set<string>;
  onToggle: (code: string) => void;
  onToggleSection: (codes: string[]) => void;
}

const SECTION_ORDER: Record<Testament, string[]> = {
  OT: ["Pentateuch", "Historical", "Wisdom & Poetry", "Major Prophets", "Minor Prophets"],
  NT: ["Gospels", "History", "Pauline letters", "General letters", "Apocalyptic"],
};

const TESTAMENT_LABEL: Record<Testament, string> = {
  OT: "Old Testament",
  NT: "New Testament",
};

export function BookSelector({ model, selected, onToggle, onToggleSection }: Props) {
  const grouped = useMemo(() => {
    const out: Record<Testament, Record<string, string[]>> = { OT: {}, NT: {} };
    for (const code of model.order) {
      const { testament, section } = model.meta[code];
      (out[testament][section] ??= []).push(code);
    }
    return out;
  }, [model]);

  return (
    <div className="selector">
      {(["OT", "NT"] as Testament[]).map((t) => {
        const total = model.order.filter((c) => model.meta[c].testament === t).length;
        const count = model.order.filter(
          (c) => model.meta[c].testament === t && selected.has(c),
        ).length;
        return (
          <div key={t} className={`testament testament--${t.toLowerCase()}`}>
            <div className="testament__head">
              <span className="testament__dot" />
              <h3>{TESTAMENT_LABEL[t]}</h3>
              <span className="testament__count">
                {count}/{total}
              </span>
            </div>
            {SECTION_ORDER[t].map((section) => {
              const codes = grouped[t][section] ?? [];
              const allOn = codes.length > 0 && codes.every((c) => selected.has(c));
              return (
                <div key={section} className="section">
                  <button
                    type="button"
                    className={`section__head${allOn ? " section__head--on" : ""}`}
                    onClick={() => onToggleSection(codes)}
                    title={allOn ? `Deselect all ${section}` : `Select all ${section}`}
                  >
                    <span className="section__name">{section}</span>
                    <span className="section__all">{allOn ? "clear" : "all"}</span>
                  </button>
                  <div className="chips">
                    {codes.map((code) => {
                      const isSel = selected.has(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          className={`chip${isSel ? " chip--on" : ""}`}
                          aria-pressed={isSel}
                          title={`${model.meta[code].name} · ${model.meta[code].verses} verses`}
                          onClick={() => onToggle(code)}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
