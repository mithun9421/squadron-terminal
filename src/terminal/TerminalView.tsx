import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import "./TerminalView.css";

interface SessionOutputEvent {
  sessionId: number;
  data: number[];
}

interface TerminalViewProps {
  sessionId: number;
  visible: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Renders one already-spawned session's live terminal. Session lifecycle
 * (spawn/close) is owned by `useSessionList`, not by this component's mount
 * lifecycle — every active session's `TerminalView` stays mounted (just
 * hidden via `visible`) so background sessions keep their scrollback. */
export function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // A hidden ancestor (`display: none` while backgrounded) collapses this
  // container's content box to near-zero, so a resize observed while hidden
  // must never be forwarded — it would shrink the real PTY to ~1 row. Read
  // via a ref (not the `visible` prop directly) so the observer callback,
  // created once per session, always sees the current value.
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const showError = (message: string) => {
      if (errorRef.current) {
        errorRef.current.textContent = message;
      }
    };

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      theme: { background: "#111318" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    try {
      term.loadAddon(new WebglAddon());
    } catch (error: unknown) {
      // WebGL can be unavailable (sandboxed/CI environments); xterm.js keeps
      // working with its canvas renderer, just without GPU acceleration.
      showError(`WebGL renderer unavailable, falling back: ${getErrorMessage(error)}`);
    }

    if (visibleRef.current) {
      fitAddon.fit();
      invoke("resize_session", { sessionId, rows: term.rows, cols: term.cols }).catch(() => {
        // Best-effort — the session just keeps its spawn-time default size.
      });
    }

    let unlistenOutput: UnlistenFn | undefined;
    let disposed = false;

    listen<SessionOutputEvent>("session-output", (event) => {
      if (event.payload.sessionId !== sessionId) {
        return;
      }
      term.write(new Uint8Array(event.payload.data));
    }).then((unlisten) => {
      if (disposed) {
        // Cleanup already ran while this await was in flight; run it now
        // instead of leaking the listener (cleanup can't rerun to catch it).
        unlisten();
        return;
      }
      unlistenOutput = unlisten;
    });

    const dataDisposable = term.onData((chunk) => {
      const bytes = Array.from(new TextEncoder().encode(chunk));
      invoke("write_to_session", { sessionId, data: bytes }).catch((error: unknown) =>
        showError(`Write failed: ${getErrorMessage(error)}`),
      );
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!visibleRef.current) {
        // A hidden ancestor collapses this container's content box; fitting
        // now would shrink the real PTY to ~1 row. The visibility effect
        // below re-fits from the actual size as soon as this pane is shown.
        return;
      }
      fitAddon.fit();
      invoke("resize_session", { sessionId, rows: term.rows, cols: term.cols }).catch(
        (error: unknown) => showError(`Resize failed: ${getErrorMessage(error)}`),
      );
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenOutput?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    // Becoming visible again: the container may have been resized (e.g. the
    // window was resized) while this pane was hidden and skipping fits.
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) {
      return;
    }
    fitAddon.fit();
    invoke("resize_session", { sessionId, rows: term.rows, cols: term.cols }).catch(() => {
      // Best-effort — the next real resize corrects a stale size.
    });
  }, [visible, sessionId]);

  return (
    <div className="terminal-view" style={{ display: visible ? "flex" : "none" }}>
      <div ref={containerRef} className="terminal-view__surface" />
      <div ref={errorRef} className="terminal-view__error" />
    </div>
  );
}
