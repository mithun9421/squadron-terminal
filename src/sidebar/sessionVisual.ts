import type { SessionSummary } from "../sessions/types";

/** The category an avatar/label is chosen from — a coarser view than the raw
 * `SessionSummary` fields, so the avatar and the text label can never drift
 * out of sync (they both derive from this one function). */
export type VisualState =
  | "shell"
  | "starting"
  | "idle"
  | "thinking"
  | "runningTool"
  | "needsInput"
  | "finished";

export function visualStateOf(session: SessionSummary): VisualState {
  if (session.finished) {
    return "finished";
  }
  if (session.kind === "shell") {
    return "shell";
  }
  return session.agentState ?? "starting";
}

export function visualStateLabel(state: VisualState): string {
  switch (state) {
    case "shell":
      return "shell";
    case "starting":
      return "starting";
    case "idle":
      return "idle";
    case "thinking":
      return "thinking";
    case "runningTool":
      return "running tool";
    case "needsInput":
      return "needs input";
    case "finished":
      return "finished";
  }
}
