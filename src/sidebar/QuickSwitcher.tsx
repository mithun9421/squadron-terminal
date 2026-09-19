import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SessionSummary } from "../sessions/types";
import { AsciiAvatar } from "./AsciiAvatar";
import { useAnimationFrame } from "./useAnimationFrame";
import { fuzzyMatch } from "./fuzzyMatch";
import { visualStateLabel, visualStateOf } from "./sessionVisual";
import "./QuickSwitcher.css";

interface QuickSwitcherProps {
  sessions: SessionSummary[];
  onSelect: (id: number) => void;
  onClose: () => void;
}

export function QuickSwitcher({ sessions, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tick = useAnimationFrame(400);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const scored = sessions
      .map((session) => ({ session, score: fuzzyMatch(query, session.label) }))
      .filter((entry): entry is { session: SessionSummary; score: number } => entry.score !== null);
    scored.sort((a, b) => a.score - b.score);
    return scored.map((entry) => entry.session);
  }, [sessions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Clamped (not just reset-on-query-change) so a session finishing/closing
  // while the switcher is open can't leave `selectedIndex` pointing past the
  // end of a now-shorter `matches` — which would highlight nothing and make
  // Enter a no-op until the next arrow-key press recalculated it.
  const clampedIndex = matches.length === 0 ? 0 : Math.min(selectedIndex, matches.length - 1);

  const selectAndClose = (id: number) => {
    onSelect(id);
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex(matches.length === 0 ? 0 : (clampedIndex + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(matches.length === 0 ? 0 : (clampedIndex - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = matches[clampedIndex];
      if (selected) {
        selectAndClose(selected.id);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="quick-switcher-backdrop" onClick={onClose}>
      <div className="quick-switcher" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="quick-switcher__input"
          placeholder="Jump to session..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ul className="quick-switcher__list">
          {matches.length === 0 && <li className="quick-switcher__empty">No matching sessions</li>}
          {matches.map((session, index) => (
            <li
              key={session.id}
              className={
                index === clampedIndex
                  ? "quick-switcher__item quick-switcher__item--selected"
                  : "quick-switcher__item"
              }
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectAndClose(session.id)}
            >
              <AsciiAvatar session={session} tick={tick} />
              <span className="quick-switcher__label">{session.label}</span>
              <span className="quick-switcher__state">{visualStateLabel(visualStateOf(session))}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
