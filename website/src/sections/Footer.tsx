const GITHUB_URL = "https://github.com/mithun9421/squadron-terminal";
const PRD_URL = "https://claude.ai/code/artifact/07e1a0af-b097-41bd-9ce2-0a7c93407a1d";

export function Footer() {
  return (
    <footer className="relative mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-[var(--text-dim)] sm:flex-row">
        <span className="font-mono">squadron terminal — MIT licensed</span>
        <div className="flex gap-6">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">
            GitHub
          </a>
          <a href={PRD_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">
            PRD
          </a>
          <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">
            Releases
          </a>
        </div>
      </div>
    </footer>
  );
}
