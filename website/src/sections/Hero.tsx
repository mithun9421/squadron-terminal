import { motion } from "framer-motion";
import { AuroraBackground } from "../components/AuroraBackground";
import { AsciiAvatarShowcase } from "../components/AsciiAvatarShowcase";
import { useOS } from "../lib/useOS";

const GITHUB_URL = "https://github.com/mithun9421/squadron-terminal";

export function Hero() {
  const os = useOS();
  const primaryLabel = os === "windows" ? "Download for Windows" : "Download for Mac";
  const secondaryLabel = os === "windows" ? "Download for Mac" : "Download for Windows";

  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-10 sm:pt-16">
      <AuroraBackground />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-mono inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-dim)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
            open source · macOS &amp; Windows
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--text)] sm:text-6xl"
          >
            A terminal for running a{" "}
            <span className="bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-orange)] to-[var(--accent-red)] bg-clip-text text-transparent">
              fleet
            </span>{" "}
            of Claude Code agents.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--text-dim)]"
          >
            Spawn shells and Claude Code agents side by side, watch their real lifecycle state update
            live via Claude Code's own hooks, and switch between them with a keystroke — or fan every
            running agent out into one grid at once.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a
              href="#download"
              className="rounded-lg bg-[var(--text)] px-5 py-3 text-sm font-semibold text-[#05070a] transition hover:opacity-90"
            >
              {primaryLabel}
            </a>
            <a
              href="#download"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-white/30"
            >
              {secondaryLabel}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--text-dim)] underline decoration-white/20 underline-offset-4 hover:text-[var(--text)]"
            >
              or read the source →
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex justify-center lg:justify-end"
        >
          <AsciiAvatarShowcase />
        </motion.div>
      </div>
    </section>
  );
}
