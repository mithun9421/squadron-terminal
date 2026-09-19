import { motion } from "framer-motion";
import { AVATAR_COLORS, AVATAR_FRAMES, STATE_LABELS, type VisualState } from "../lib/avatarStates";
import { useAnimationFrame } from "../lib/useAnimationFrame";

interface MockSession {
  label: string;
  kind: "shell" | "agent";
  state: VisualState;
}

const SESSIONS: MockSession[] = [
  { label: "Shell 1", kind: "shell", state: "shell" },
  { label: "Agent — refactor-auth", kind: "agent", state: "runningTool" },
  { label: "Agent — write-tests", kind: "agent", state: "thinking" },
  { label: "Agent — fix-flaky-ci", kind: "agent", state: "needsInput" },
  { label: "Agent — review-pr-412", kind: "agent", state: "idle" },
];

/** The hero's centerpiece: a live recreation of the app's own sidebar, using
 * the exact frame data and colors from src/sidebar/AsciiAvatar.tsx — this is
 * the real product detail animating, not an illustration of it. */
export function AsciiAvatarShowcase() {
  const tick = useAnimationFrame(400);

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111318]/90 shadow-2xl shadow-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f5c542]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4b9cff]/70" />
        <span className="font-mono ml-2 text-xs text-[var(--text-dim)]">squadron — 5 sessions</span>
      </div>
      <ul className="divide-y divide-white/5 py-1">
        {SESSIONS.map((session, index) => {
          const frames = AVATAR_FRAMES[session.state];
          const frame = frames[tick % frames.length];
          return (
            <motion.li
              key={session.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                className="font-mono w-[5ch] shrink-0 text-[13px]"
                style={{ color: AVATAR_COLORS[session.state] }}
              >
                {frame}
              </span>
              <span className="flex-1 truncate text-sm text-[var(--text)]">{session.label}</span>
              <span className="text-xs text-[var(--text-dim)]">{STATE_LABELS[session.state]}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
