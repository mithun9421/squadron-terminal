import { useEffect, useState } from "react";

/** One shared tick counter, incrementing every `intervalMs`. Call this once
 * per list (not once per row) so every avatar animates off the same timer
 * instead of N independent `setInterval`s drifting out of phase. */
export function useAnimationFrame(intervalMs: number): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((current) => current + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tick;
}
