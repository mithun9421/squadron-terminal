import { useEffect, useState } from "react";

/** One shared tick counter incrementing every `intervalMs` — mirrors the
 * real app's src/sidebar/useAnimationFrame.ts so every avatar on this page
 * animates off one timer instead of drifting independently. */
export function useAnimationFrame(intervalMs: number): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((current) => current + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tick;
}
