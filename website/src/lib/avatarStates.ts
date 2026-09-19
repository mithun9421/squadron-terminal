/** Ported from the real app's src/sidebar/AsciiAvatar.tsx + AsciiAvatar.css —
 * the hero visual on this site is the actual product detail, not a mockup
 * invented for marketing. Kept as a standalone copy (this is a separate
 * package) rather than a cross-package import. */
export type VisualState =
  | "shell"
  | "starting"
  | "idle"
  | "thinking"
  | "runningTool"
  | "needsInput"
  | "finished";

export const AVATAR_FRAMES: Record<VisualState, string[]> = {
  shell: ["$_"],
  starting: [".", "..", "..."],
  idle: ["(-_-)"],
  thinking: ["(o.o)", "(o_o)", "(O_O)", "(o_o)"],
  runningTool: ["[>  ]", "[ > ]", "[  >]", "[ > ]"],
  needsInput: ["(?)", "( )"],
  finished: ["(x_x)"],
};

export const AVATAR_COLORS: Record<VisualState, string> = {
  shell: "#6b7280",
  starting: "#6b7280",
  idle: "#4b9cff",
  thinking: "#f5c542",
  runningTool: "#f59e42",
  needsInput: "#ef4444",
  finished: "#3a3f4e",
};

export const STATE_LABELS: Record<VisualState, string> = {
  shell: "shell",
  starting: "starting",
  idle: "idle",
  thinking: "thinking",
  runningTool: "running tool",
  needsInput: "needs input",
  finished: "finished",
};
