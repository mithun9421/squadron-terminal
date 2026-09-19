import type { SessionSummary } from "../sessions/types";
import { visualStateOf, type VisualState } from "./sessionVisual";
import "./AsciiAvatar.css";

const FRAMES: Record<VisualState, string[]> = {
  shell: ["$_"],
  starting: [".", "..", "..."],
  idle: ["(-_-)"],
  thinking: ["(o.o)", "(o_o)", "(O_O)", "(o_o)"],
  runningTool: ["[>  ]", "[ > ]", "[  >]", "[ > ]"],
  needsInput: ["(?)", "( )"],
  finished: ["(x_x)"],
};

interface AsciiAvatarProps {
  session: SessionSummary;
  tick: number;
}

/** A small, fixed-width, animated ASCII glyph reflecting a session's state.
 * Frame selection is driven by a shared `tick` (see `useAnimationFrame`) so
 * every avatar in the sidebar animates in lockstep off one timer. Color is a
 * redundant cue, not the only one — the sidebar's text label is what makes
 * state legible without relying on the avatar or color alone. */
export function AsciiAvatar({ session, tick }: AsciiAvatarProps) {
  const state = visualStateOf(session);
  const frames = FRAMES[state];
  const frame = frames[tick % frames.length];

  return (
    <span className={`ascii-avatar ascii-avatar--${state}`} aria-hidden="true">
      {frame}
    </span>
  );
}
