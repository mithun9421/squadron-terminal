import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPane.css";

interface SessionOutputEvent {
  sessionId: number;
  data: number[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

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
      theme: { background: "#111318" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    try {
      term.loadAddon(new WebglAddon());
    } catch (error: unknown) {
      // WebGL can be unavailable (sandboxed/CI environments); xterm.js keeps
      // working with its canvas renderer, just without GPU acceleration.
      showError(`WebGL renderer unavailable, falling back: ${getErrorMessage(error)}`);
    }

    fitAddon.fit();

    let sessionId: number | null = null;
    let unlistenOutput: UnlistenFn | undefined;
    let disposed = false;

    async function start() {
      try {
        const unlisten = await listen<SessionOutputEvent>("session-output", (event) => {
          if (event.payload.sessionId !== sessionId) {
            return;
          }
          term.write(new Uint8Array(event.payload.data));
        });
        if (disposed) {
          // Cleanup already ran while this await was in flight; run it now
          // instead of leaking the listener (cleanup can't rerun to catch it).
          unlisten();
          return;
        }
        unlistenOutput = unlisten;

        const id = await invoke<number>("spawn_session", {
          rows: term.rows,
          cols: term.cols,
        });

        if (disposed) {
          await invoke("close_session", { sessionId: id });
          return;
        }
        sessionId = id;
      } catch (error: unknown) {
        showError(`Failed to start session: ${getErrorMessage(error)}`);
      }
    }

    void start();

    const dataDisposable = term.onData((chunk) => {
      const activeSessionId = sessionId;
      if (activeSessionId === null) {
        return;
      }
      const bytes = Array.from(new TextEncoder().encode(chunk));
      invoke("write_to_session", { sessionId: activeSessionId, data: bytes }).catch(
        (error: unknown) => showError(`Write failed: ${getErrorMessage(error)}`),
      );
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const activeSessionId = sessionId;
      if (activeSessionId === null) {
        return;
      }
      invoke("resize_session", {
        sessionId: activeSessionId,
        rows: term.rows,
        cols: term.cols,
      }).catch((error: unknown) => showError(`Resize failed: ${getErrorMessage(error)}`));
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenOutput?.();
      const activeSessionId = sessionId;
      if (activeSessionId !== null) {
        invoke("close_session", { sessionId: activeSessionId }).catch(() => {
          // Best-effort cleanup; nothing the user can act on at this point.
        });
      }
      term.dispose();
    };
  }, []);

  return (
    <div className="terminal-pane">
      <div ref={containerRef} className="terminal-pane__surface" />
      <div ref={errorRef} className="terminal-pane__error" />
    </div>
  );
}
