import { motion } from "framer-motion";
import { useOS } from "../lib/useOS";

const RELEASES_URL = "https://github.com/mithun9421/squadron-terminal/releases/latest";

export function Download() {
  const os = useOS();

  return (
    <section id="download" className="relative mx-auto max-w-4xl px-6 py-24 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          Get the MVP.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--text-dim)]">
          Early release, unsigned while it's fresh — your OS will flag it as coming from an unidentified
          developer. That's expected; here's how to open it anyway.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className={
              os === "windows"
                ? "rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-[var(--text)] hover:border-white/30"
                : "rounded-lg bg-[var(--text)] px-6 py-3 text-sm font-semibold text-[#05070a] hover:opacity-90"
            }
          >
            ⌘ macOS (.dmg)
          </a>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className={
              os === "windows"
                ? "rounded-lg bg-[var(--text)] px-6 py-3 text-sm font-semibold text-[#05070a] hover:opacity-90"
                : "rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-[var(--text)] hover:border-white/30"
            }
          >
            ⊞ Windows (.msi)
          </a>
        </div>

        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#111318] p-5">
            <div className="font-mono text-xs text-[var(--accent-blue)]">macOS</div>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              Right-click the app → <span className="text-[var(--text)]">Open</span> → confirm in the
              dialog. Only needed the first time.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#111318] p-5">
            <div className="font-mono text-xs text-[var(--accent-blue)]">Windows</div>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              Click <span className="text-[var(--text)]">More info</span> on the SmartScreen prompt, then{" "}
              <span className="text-[var(--text)]">Run anyway</span>.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
