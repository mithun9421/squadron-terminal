import { useState } from "react";
import type { SessionSummary } from "../sessions/types";
import "./Sidebar.css";

interface SidebarProps {
  sessions: SessionSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewShell: () => void;
  onNewAgent: (cwd: string) => void;
  onClose: (id: number) => void;
}

function stateLabel(session: SessionSummary): string {
  if (session.finished) {
    return "finished";
  }
  if (session.kind === "shell") {
    return "shell";
  }
  return session.agentState ?? "starting";
}

function dotClassName(session: SessionSummary): string {
  if (session.finished) {
    return "session-row__dot--finished";
  }
  if (session.kind === "shell") {
    return "session-row__dot--shell";
  }
  switch (session.agentState) {
    case null:
      // No hook has fired yet (matches the "starting" text in stateLabel).
      return "session-row__dot--starting";
    case "thinking":
      return "session-row__dot--thinking";
    case "runningTool":
      return "session-row__dot--running";
    case "needsInput":
      return "session-row__dot--needs-input";
    case "idle":
      return "session-row__dot--idle";
  }
}

export function Sidebar({ sessions, activeId, onSelect, onNewShell, onNewAgent, onClose }: SidebarProps) {
  const [cwdDraft, setCwdDraft] = useState("");

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
              <span className={`session-row__dot ${dotClassName(session)}`} />
              <span className="session-row__label">{session.label}</span>
              <span className="session-row__state">{stateLabel(session)}</span>
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
