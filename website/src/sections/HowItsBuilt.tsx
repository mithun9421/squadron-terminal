import { motion } from "framer-motion";

const STACK = [
  { label: "App shell", value: "Tauri 2" },
  { label: "PTY core", value: "portable-pty (Rust)" },
  { label: "Virtual terminal", value: "tattoy-wezterm-term" },
  { label: "Rendering", value: "xterm.js + WebGL" },
  { label: "Frontend", value: "React + TypeScript" },
  { label: "Agent hooks", value: "Local loopback HTTP server" },
];

const PRD_URL = "https://claude.ai/code/artifact/07e1a0af-b097-41bd-9ce2-0a7c93407a1d";
const GITHUB_URL = "https://github.com/mithun9421/squadron-terminal";

export function HowItsBuilt() {
  return (
    <section id="how-its-built" className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            A real terminal underneath.
          </h2>
          <p className="mt-4 text-[var(--text-dim)]">
            This isn't a chat window with a terminal-shaped skin. Full ANSI/VT100+ handling, 24-bit
            color, resizing, and scrollback — a daily-driver terminal that happens to know about your
            agents. The session/PTY core is a Tauri-free Rust crate on purpose, built to be extracted
            into a standalone daemon process without a rewrite.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 px-4 py-2 text-[var(--text)] hover:border-white/30"
            >
              Browse the source ↗
            </a>
            <a
              href={PRD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 px-4 py-2 text-[var(--text)] hover:border-white/30"
            >
              Read the full PRD ↗
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-[#111318] p-6"
        >
          <div className="font-mono text-xs text-[var(--text-dim)]">stack.toml</div>
          <dl className="mt-4 divide-y divide-white/5">
            {STACK.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-[var(--text-dim)]">{row.label}</dt>
                <dd className="font-mono text-[var(--text)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  );
}
