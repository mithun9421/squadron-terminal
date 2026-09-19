/** A layered, slowly-drifting radial-gradient backdrop — pure CSS, no
 * canvas/WebGL, so it stays cheap on low-end machines. Three blurred blobs in
 * the app's own state colors (blue/orange/red — see lib/avatarStates.ts)
 * drift on independent keyframe loops so the pattern never visibly repeats. */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="aurora-blob aurora-blob--a" />
      <div className="aurora-blob aurora-blob--b" />
      <div className="aurora-blob aurora-blob--c" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0b0e_75%)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#e4e6eb 1px, transparent 1px), linear-gradient(90deg, #e4e6eb 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
