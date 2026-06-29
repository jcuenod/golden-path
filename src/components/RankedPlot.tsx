import { AnimatePresence, motion } from "framer-motion";
import { fitPercentile, naturalBreak } from "../model/rank";
import type { RankedBook } from "../model/types";

interface Props {
  ranked: RankedBook[];
  selectedCount: number;
  maxVerses: number;
  expanded: boolean;
  onToggleExpand: () => void;
  collapsedCount?: number;
}

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.9 };

export function RankedPlot({
  ranked,
  selectedCount,
  maxVerses,
  expanded,
  onToggleExpand,
  collapsedCount = 10,
}: Props) {
  if (selectedCount === 0) {
    return (
      <motion.div
        className="plot plot--empty"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <svg className="empty__art" viewBox="0 0 240 150" width="240" height="150" aria-hidden>
          <rect x="2" y="2" width="236" height="146" rx="14" className="empty__card" />
          {[0, 1, 2, 3].map((i) => {
            const widths = [186, 150, 112, 80];
            const y = 26 + i * 30;
            return (
              <g key={i}>
                <circle cx="28" cy={y + 9} r="7" className="empty__dot" />
                <rect
                  x="46"
                  y={y}
                  width={widths[i]}
                  height="18"
                  rx="9"
                  className={i === 0 ? "empty__bar empty__bar--lead" : "empty__bar"}
                />
              </g>
            );
          })}
        </svg>
        <p className="plot__prompt">Select the book(s) your team has already translated.</p>
        <p className="plot__hint">
          The model will rank the remaining books by how well each is likely to draft next.
        </p>
      </motion.div>
    );
  }
  if (ranked.length === 0) {
    return (
      <div className="plot plot--empty">
        <p className="plot__prompt">No candidate books to rank.</p>
        <p className="plot__hint">Everything is selected, or every remaining book is filtered out.</p>
      </div>
    );
  }

  const breakCount = naturalBreak(ranked);
  const shownCount = expanded ? ranked.length : Math.min(collapsedCount, ranked.length);
  const shown = ranked.slice(0, shownCount);

  // normalize bar widths *within the shown set* so the drop reads clearly
  const zs = shown.map((b) => b.withinPoolZ);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const span = maxZ - minZ || 1;
  const fitWidth = (b: RankedBook) => 14 + 86 * ((b.withinPoolZ - minZ) / span);
  // bubble radius encodes magnitude (area ~ length), so it reads as size not progress
  const lenRadius = (b: RankedBook) =>
    maxVerses > 0 ? 3 + 7.5 * Math.sqrt(b.verses / maxVerses) : 3;

  const showDivider = breakCount < shown.length;

  return (
    <div className="plot">
      <div className="plot__legend">
        <span>
          <strong>{breakCount}</strong> suggested next, ranked by relative fit
        </span>
        <span className="legend__size">
          <svg viewBox="0 0 26 14" width="26" height="14" aria-hidden>
            <circle cx="5" cy="7" r="2.5" />
            <circle cx="18" cy="7" r="5.5" />
          </svg>
          larger = longer book
        </span>
      </div>

      <motion.ul className="bars" layout>
        <AnimatePresence>
          {shown.flatMap((b, i) => {
            const recommended = i < breakCount;
            const row = (
              <motion.li
                key={b.code}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={SPRING}
                className={`bar bar--${b.testament.toLowerCase()}${recommended ? " bar--rec" : ""}`}
              >
                <span className="bar__rank">{b.rank}</span>
                <span className="bar__label">
                  <span className="bar__name">{b.name}</span>
                  <span className="bar__section">{b.section}</span>
                </span>
                <span className="bar__track">
                  <motion.span
                    className="bar__fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${fitWidth(b)}%` }}
                    transition={SPRING}
                  >
                    <span className="bar__score" title="Relative fit among current candidates (0–100)">
                      {fitPercentile(b.withinPoolZ)}
                    </span>
                  </motion.span>
                </span>
                <span className="bar__len" title={`${b.verses.toLocaleString()} verses`}>
                  <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden>
                    <circle cx="11" cy="11" r={lenRadius(b)} />
                  </svg>
                  <span className="bar__len-num">{b.verses.toLocaleString()}</span>
                </span>
              </motion.li>
            );
            if (showDivider && i === breakCount - 1) {
              return [
                row,
                <motion.li
                  key="__divider"
                  layout
                  className="bars__divider"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-hidden
                >
                  <span>lower anticipated quality</span>
                </motion.li>,
              ];
            }
            return [row];
          })}
        </AnimatePresence>
      </motion.ul>

      {ranked.length > collapsedCount && (
        <button type="button" className="plot__expand" onClick={onToggleExpand}>
          {expanded ? "Show fewer" : `Show all ${ranked.length} candidates`}
        </button>
      )}
    </div>
  );
}
