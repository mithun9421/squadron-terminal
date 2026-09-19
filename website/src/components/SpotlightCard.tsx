import { useRef, type MouseEvent, type ReactNode } from "react";
import { motion } from "framer-motion";

interface SpotlightCardProps {
  index: number;
  title: string;
  description: string;
  children?: ReactNode;
}

/** A feature card whose border glows toward the cursor (a CSS radial-gradient
 * mask positioned via custom properties updated on mousemove — no extra
 * render on every frame, just a style write) and lifts slightly on hover. */
export function SpotlightCard({ index, title, description, children }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="spotlight-card group relative overflow-hidden rounded-xl border border-white/10 bg-[#111318] p-6"
    >
      <div className="spotlight-card__glow" />
      <div className="relative">
        <span className="font-mono text-xs text-[var(--text-dim)]">{String(index).padStart(2, "0")}</span>
        <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-dim)]">{description}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </motion.div>
  );
}
