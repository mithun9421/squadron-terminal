import { useEffect, useState } from "react";

export type DetectedOS = "mac" | "windows" | "other";

function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const platform = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  if (platform.includes("mac")) {
    return "mac";
  }
  if (platform.includes("win")) {
    return "windows";
  }
  return "other";
}

/** Detects the visitor's OS client-side so the download CTA can lead with
 * the right platform. Defaults to "other" during SSR/initial render (this
 * site is static-exported, no SSR, but the check still needs a safe first
 * value before the effect runs). */
export function useOS(): DetectedOS {
  const [os, setOS] = useState<DetectedOS>("other");

  useEffect(() => {
    setOS(detectOS());
  }, []);

  return os;
}
