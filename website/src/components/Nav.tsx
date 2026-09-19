const GITHUB_URL = "https://github.com/mithun9421/squadron-terminal";

export function Nav() {
  return (
    <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <a href="#top" className="font-mono flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="text-[var(--accent-blue)]">▎</span>
        squadron terminal
      </a>
      <div className="flex items-center gap-6 text-sm text-[var(--text-dim)]">
        <a href="#features" className="hover:text-[var(--text)]">
          Features
        </a>
        <a href="#how-its-built" className="hover:text-[var(--text)]">
          How it's built
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/15 px-3 py-1.5 hover:border-white/30 hover:text-[var(--text)]"
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
