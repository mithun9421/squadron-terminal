import { motion } from "framer-motion";
import { SpotlightCard } from "../components/SpotlightCard";

const FEATURES = [
  {
    title: "Run shells and agents side by side",
    description:
      "Spawn plain shells or real Claude Code agents from the sidebar. Every session's terminal stays mounted in the background — switching never loses scrollback, even mid fan-out.",
  },
  {
    title: "Live state, straight from Claude Code's hooks",
    description:
      "A local, loopback-only hook server drives each agent's status — idle, thinking, running a tool, needs input — with zero polling and zero screen-scraping.",
  },
  {
    title: "Animated ASCII avatars",
    description:
      "Every session gets a small, fixed-width, animated glyph reflecting its state — one shared timer drives every avatar in lockstep, not a timer per row.",
  },
  {
    title: "Keyboard-first switching",
    description:
      "Cmd/Alt+1–9 jumps straight to a session, Cmd/Alt+] and [ cycle, and Cmd/Alt+K opens a fuzzy quick-switcher — never Ctrl, which your shell already owns.",
  },
  {
    title: "Fan out into a live grid",
    description:
      "One keystroke tiles every running session into a CSS grid so you can watch several agents at once, then click any tile to pop it back to full focus.",
  },
  {
    title: "Genuinely isolated agents",
    description:
      "Spawned sessions never inherit this app's own launch environment, your personal Claude Code plugins, or a stray global model override — each agent starts clean.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="max-w-xl"
      >
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          Built around the agent, not the pane.
        </h2>
        <p className="mt-4 text-[var(--text-dim)]">
          Every terminal treats a session as a rectangle of text. This one treats it as a thing with a
          lifecycle you're supervising.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: (index % 3) * 0.08 }}
          >
            <SpotlightCard index={index + 1} title={feature.title} description={feature.description} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
