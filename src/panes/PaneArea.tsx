import type { SessionSummary } from "../sessions/types";
import { AsciiAvatar } from "../sidebar/AsciiAvatar";
import { visualStateLabel, visualStateOf } from "../sidebar/sessionVisual";
import { useAnimationFrame } from "../sidebar/useAnimationFrame";
import { TerminalView } from "../terminal/TerminalView";
import { gridColumns } from "./gridColumns";
import "./PaneArea.css";

const AVATAR_FRAME_INTERVAL_MS = 400;

interface PaneAreaProps {
  sessions: SessionSummary[];
  activeId: number | null;
  fanOutOpen: boolean;
  onFocus: (id: number) => void;
}

/** Renders exactly one `TerminalView` per session, always — in focus mode
 * only the active one is visible (CSS `display: none` on the rest, per
 * Phase 1); in fan-out mode every non-finished session is visible at once in
 * a CSS grid. Critically, the `<TerminalView key={session.id}>` instances
 * themselves are never conditionally mounted/unmounted between modes — only
 * their wrapping tile's styling and visibility change — so switching modes
 * never destroys a session's scrollback or live output stream. */
export function PaneArea({ sessions, activeId, fanOutOpen, onFocus }: PaneAreaProps) {
  const avatarTick = useAnimationFrame(AVATAR_FRAME_INTERVAL_MS);
  const visibleInGrid = fanOutOpen ? sessions.filter((session) => !session.finished) : [];
  const columns = gridColumns(visibleInGrid.length);

  if (fanOutOpen && visibleInGrid.length === 0) {
    return (
      <div className="pane-area">
        <div className="pane-area--empty-message">No running sessions to fan out</div>
      </div>
    );
  }

  return (
    <div
      className={fanOutOpen ? "pane-area pane-area--grid" : "pane-area"}
      style={fanOutOpen ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {sessions.map((session) => {
        const isVisible = fanOutOpen ? !session.finished : session.id === activeId;
        return (
          <div
            key={session.id}
            className="pane-tile"
            style={isVisible ? undefined : { display: "none" }}
          >
            {fanOutOpen && (
              <button type="button" className="pane-tile__header" onClick={() => onFocus(session.id)}>
                <AsciiAvatar session={session} tick={avatarTick} />
                <span className="pane-tile__label">{session.label}</span>
                <span className="pane-tile__state">{visualStateLabel(visualStateOf(session))}</span>
              </button>
            )}
            <div className="pane-tile__body">
              {/* `inert` while fanned out: every tile is a preview here, none
               * of them interactive, so xterm's own focusable helper
               * textarea must be unreachable by Tab — otherwise a
               * keyboard-only user tabbing through the grid lands directly
               * in a backgrounded session's live terminal and types into the
               * wrong PTY, bypassing click-to-focus entirely. The overlay
               * button below is a *sibling*, not a descendant, of this
               * wrapper specifically so `inert` never also swallows it. */}
              <div className="pane-tile__terminal" inert={fanOutOpen}>
                <TerminalView sessionId={session.id} visible={isVisible} />
              </div>
              {fanOutOpen && (
                <button
                  type="button"
                  className="pane-tile__overlay"
                  aria-label={`Focus ${session.label}`}
                  onClick={() => onFocus(session.id)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
