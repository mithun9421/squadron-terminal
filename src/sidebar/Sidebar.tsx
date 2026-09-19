import { useState } from "react";
import type { SessionSummary } from "../sessions/types";
import { AsciiAvatar } from "./AsciiAvatar";
import { useAnimationFrame } from "./useAnimationFrame";
import { visualStateLabel, visualStateOf } from "./sessionVisual";
import "./Sidebar.css";

interface SidebarProps {
  sessions: SessionSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewShell: () => void;
  onNewAgent: (cwd: string) => void;
  onClose: (id: number) => void;
}

const AVATAR_FRAME_INTERVAL_MS = 400;

export function Sidebar({ sessions, activeId, onSelect, onNewShell, onNewAgent, onClose }: SidebarProps) {
  const [cwdDraft, setCwdDraft] = useState("");
  const tick = useAnimationFrame(AVATAR_FRAME_INTERVAL_MS);

  return (
    <aside className="sidebar">
      <div className="sidebar__actions">
        <button type="button" className="sidebar__button" onClick={onNewShell}>
          + Shell
        </button>
      </div>
      <div className="sidebar__new-agent">
        <input
          type="text"
          className="sidebar__cwd-input"
          placeholder="Project directory (optional)"
          value={cwdDraft}
          onChange={(event) => setCwdDraft(event.target.value)}
        />
        <button
          type="button"
          className="sidebar__button"
          onClick={() => {
            onNewAgent(cwdDraft);
            setCwdDraft("");
          }}
        >
          + Agent
        </button>
      </div>
      <ul className="sidebar__list">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={session.id === activeId ? "session-row session-row--active" : "session-row"}
          >
            <button
              type="button"
              className="session-row__select"
              onClick={() => onSelect(session.id)}
            >
              <AsciiAvatar session={session} tick={tick} />
              <span className="session-row__label">{session.label}</span>
              <span className="session-row__state">{visualStateLabel(visualStateOf(session))}</span>
            </button>
            <button
              type="button"
              className="session-row__close"
              aria-label={`Close ${session.label}`}
              onClick={() => onClose(session.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
