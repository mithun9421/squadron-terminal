# Squadron Terminal

A terminal emulator purpose-built for running and supervising multiple Claude Code
agents at once. See the [product PRD](https://claude.ai/code/artifact/07e1a0af-b097-41bd-9ce2-0a7c93407a1d)
for the full requirements, competitive landscape, and architecture rationale.

This repo currently implements **Phases 0–3** of the roadmap: a real,
GPU-rendered terminal emulator (Tauri 2 + Rust PTY/VT core + xterm.js) with a
sidebar for running several sessions at once — plain shells or actual Claude
Code agents, whose live lifecycle state (idle/thinking/running a tool/needs
input) is detected via Claude Code's own hooks and shown as an animated ASCII
avatar per session. Switch sessions by clicking, with `Cmd/Alt+1`–`9`,
`Cmd/Alt+]`/`[` to cycle, or `Cmd/Alt+K` for a fuzzy quick-switcher — or fan
every running session out into a live grid at once with `Cmd/Alt+G`, and
click any tile to pop it back to full focus.

## Demo

See the experience — features, screenshots, and what it's like to run —
at **[mithun9421.github.io/squadron-terminal](https://mithun9421.github.io/squadron-terminal/)**.
This is a static site (`website/`), separate from the app below; it doesn't
launch or require the terminal itself.

## Download

Prebuilt macOS and Windows installers are published on the
[Releases page](https://github.com/mithun9421/squadron-terminal/releases/latest). Builds are
**unsigned** for now:

- **macOS**: right-click the app → **Open** → confirm in the dialog (only needed the first time).
- **Windows**: click **More info** on the SmartScreen prompt, then **Run anyway**.

See [`RELEASING.md`](./RELEASING.md) for how releases are built and cut.

## Stack

- **`crates/agentd`** — Rust library, no Tauri dependency: owns PTY sessions via
  `portable-pty`, headless virtual-terminal state via `tattoy-wezterm-term`, and
  (in `hooks.rs`) a local loopback-only HTTP server that Claude Code's native
  `"type": "http"` hooks POST to, driving each agent session's live state.
  Designed to be extracted into a standalone daemon process (per the PRD) in a
  later phase without rewriting this logic.
- **`src-tauri`** — Tauri 2 app shell exposing `agentd` over Tauri commands/events.
- **`src`** — React + TypeScript frontend: a `Sidebar` (with animated
  `AsciiAvatar`s and a `QuickSwitcher`) listing every session, and a
  `PaneArea` rendering one `TerminalView` (`@xterm/xterm`, WebGL-accelerated)
  per session — always mounted, never unmounted on a mode switch, just shown
  full-size (focus mode) or tiled into a CSS grid (fan-out mode) so switching
  or fanning out never loses scrollback.

## Setup

Requires Node.js and Rust (`rustup`). Install dependencies:

```bash
npm install
```

## Run

```bash
npm run tauri dev
```

This opens a window running a live shell (`$SHELL`) — a working daily-driver
terminal, with full ANSI/color support, resizing, and scrollback.

## Test

```bash
cargo test --workspace   # agentd's PTY/VT unit tests
npm run build            # frontend typecheck + build
cargo clippy --workspace --all-targets -- -D warnings
```

## Known limitations

- Session state lives in-process in the Tauri app, not yet a separate `agentd`
  daemon process — an app crash currently takes running sessions down with it.
  The `agentd` crate has no Tauri dependency specifically so this can be
  extracted later without a rewrite.
- Every session's xterm.js instance stays mounted simultaneously (just hidden
  when not shown); there's no render throttling for large fan-out grids yet —
  every tile is a full live WebGL-rendered terminal. Fine at a handful of
  sessions; the PRD's own architecture doc calls throttling beyond ~9 panes a
  later optimization, not required for this phase.
- Fan-out tiles are view-only by design (click a tile to pop it to full focus
  and interact) — `inert` while fanned out keeps a backgrounded tile's
  terminal out of the keyboard tab order, so Tab-ing through the grid can't
  land you typing into the wrong session's PTY.
- A hook event that fires in the brief window between a new agent session's
  process starting and its id being registered in `SessionManager` is silently
  dropped — self-healing (the next hook event applies normally), so this is
  accepted rather than closed with a two-phase spawn.
- Every spawned session (shell or agent) has Claude Code's own session-identity
  env vars (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, the inter-agent messaging
  socket/token, ...) scrubbed before launch — otherwise, if this app's own
  process is ever launched from inside a Claude Code session (a dev terminal,
  an editor's integrated terminal, ...), a spawned agent (or anything run
  inside a spawned shell) would silently inherit that identity and attach to
  the *outer* session instead of starting independent.
- macOS/Linux only for now; Windows (ConPTY) is a later phase.
