import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Sidebar } from "./sidebar/Sidebar";
import { QuickSwitcher } from "./sidebar/QuickSwitcher";
import { TerminalView } from "./terminal/TerminalView";
import { useSessionList } from "./sessions/useSessionList";

/** True for a "real" text input the user is typing into (the sidebar's
 * project-directory field, in practice) — but false for xterm.js's own
 * hidden helper textarea, which is how it captures keyboard input while a
 * terminal pane is focused. Shortcuts must fire in the latter case (that's
 * the whole point of them) but never steal keystrokes from the former. */
function isPlainTextInput(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) {
    return !element.classList.contains("xterm-helper-textarea");
  }
  return element instanceof HTMLInputElement;
}

/** The app-shortcut modifier: Cmd on macOS, Alt elsewhere — deliberately
 * never Ctrl, which real terminal programs rely on (Ctrl+K, Ctrl+1, etc. are
 * readline/shell bindings a terminal user expects to reach the shell).
 * Excludes AltGr, which browsers report as `altKey` (usually `ctrlKey` too)
 * and which European keyboard layouts use to type `[`, `]`, `@`, `\` — all
 * common in file paths — so a bare `altKey` check would eat normal typing. */
function hasAppModifier(event: KeyboardEvent): boolean {
  return event.metaKey || (event.altKey && !event.ctrlKey);
}

function App() {
  const { sessions, spawnShell, spawnAgent, close } = useSessionList();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const agentCounterRef = useRef(0);

  // Mirrored into refs so the keydown listener below can be registered once
  // (not re-added on every session-list/active-session change, which — with
  // several agents transitioning state — would otherwise churn constantly).
  const sessionsRef = useRef(sessions);
  const activeIdRef = useRef(activeId);
  const quickSwitcherOpenRef = useRef(quickSwitcherOpen);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    quickSwitcherOpenRef.current = quickSwitcherOpen;
  }, [quickSwitcherOpen]);

  useEffect(() => {
    const activeStillExists = sessions.some((session) => session.id === activeId);
    if (activeId !== null && activeStillExists) {
      return;
    }
    setActiveId(sessions.length > 0 ? sessions[0].id : null);
  }, [sessions, activeId]);

  // The listener is registered on the *capturing* phase so it runs before
  // xterm.js's own keydown handling on its focused textarea; on a match we
  // call stopPropagation so the keystroke is consumed here, not also sent to
  // the shell.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // OS key-repeat would otherwise re-fire the toggle on the same held
      // keypress, flickering the quick switcher open/closed.
      if (event.repeat) {
        return;
      }

      const isToggleQuickSwitcher = hasAppModifier(event) && event.key.toLowerCase() === "k";

      if (quickSwitcherOpenRef.current) {
        if (isToggleQuickSwitcher) {
          event.preventDefault();
          event.stopPropagation();
          setQuickSwitcherOpen(false);
        }
        // Every other key (typing the filter, arrows, enter, escape) is
        // handled locally by QuickSwitcher's own input.
        return;
      }

      // Switcher closed: don't steal keystrokes from an ordinary text field
      // (e.g. the sidebar's "Project directory" input) — only a terminal
      // pane being focused (or nothing) should let shortcuts through.
      if (isPlainTextInput(document.activeElement)) {
        return;
      }

      if (!hasAppModifier(event)) {
        return;
      }

      const sessions = sessionsRef.current;
      const activeId = activeIdRef.current;

      if (isToggleQuickSwitcher) {
        event.preventDefault();
        event.stopPropagation();
        setQuickSwitcherOpen(true);
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const target = sessions[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          event.stopPropagation();
          setActiveId(target.id);
        }
        return;
      }

      if ((event.key === "]" || event.key === "[") && sessions.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const currentIndex = sessions.findIndex((session) => session.id === activeId);
        const direction = event.key === "]" ? 1 : -1;
        const nextIndex = (currentIndex + direction + sessions.length) % sessions.length;
        setActiveId(sessions[nextIndex].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const handleNewShell = () => {
    spawnShell()
      .then(setActiveId)
      .catch(() => {
        // Nothing to surface here yet — no pane exists for a failed spawn.
      });
  };

  const handleNewAgent = (cwd: string) => {
    agentCounterRef.current += 1;
    const label = `Agent ${agentCounterRef.current}`;
    spawnAgent(label, cwd)
      .then(setActiveId)
      .catch(() => {
        // Same as above.
      });
  };

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNewShell={handleNewShell}
        onNewAgent={handleNewAgent}
        onClose={close}
      />
      <div className="app-layout__panes">
        {sessions.map((session) => (
          <TerminalView key={session.id} sessionId={session.id} visible={session.id === activeId} />
        ))}
      </div>
      {quickSwitcherOpen && (
        <QuickSwitcher
          sessions={sessions}
          onSelect={setActiveId}
          onClose={() => setQuickSwitcherOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
