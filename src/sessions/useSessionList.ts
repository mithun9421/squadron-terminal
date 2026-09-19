import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SessionSummary } from "./types";

const DEFAULT_ROWS = 24;
const DEFAULT_COLS = 80;

interface UseSessionList {
  sessions: SessionSummary[];
  spawnShell: () => Promise<number>;
  spawnAgent: (label: string, cwd: string) => Promise<number>;
  close: (sessionId: number) => Promise<void>;
}

/** Keeps `sessions` in sync with the backend's `sessions-changed` broadcasts
 * (see `src-tauri/src/lib.rs`'s session-list poller) and exposes the session
 * lifecycle actions the sidebar needs. */
export function useSessionList(): UseSessionList {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<SessionSummary[]>("sessions-changed", (event) => {
      setSessions(event.payload);
    }).then((unlistenFn) => {
      if (cancelled) {
        unlistenFn();
        return;
      }
      unlisten = unlistenFn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const spawnShell = useCallback(() => {
    return invoke<number>("spawn_shell_session", { rows: DEFAULT_ROWS, cols: DEFAULT_COLS });
  }, []);

  const spawnAgent = useCallback((label: string, cwd: string) => {
    const trimmedCwd = cwd.trim();
    return invoke<number>("spawn_agent_session", {
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      label,
      cwd: trimmedCwd.length > 0 ? trimmedCwd : null,
    });
  }, []);

  const close = useCallback((sessionId: number) => {
    return invoke<void>("close_session", { sessionId });
  }, []);

  return { sessions, spawnShell, spawnAgent, close };
}
