# Squadron Terminal

A terminal emulator purpose-built for running and supervising multiple Claude Code
agents at once. See the [product PRD](https://claude.ai/code/artifact/07e1a0af-b097-41bd-9ce2-0a7c93407a1d)
for the full requirements, competitive landscape, and architecture rationale.

This repo currently implements **Phase 0 and Phase 1** of the roadmap: a real,
GPU-rendered terminal emulator (Tauri 2 + Rust PTY/VT core + xterm.js) with a
sidebar for running several sessions at once — plain shells or actual Claude
Code agents, whose live lifecycle state (idle/thinking/running a tool/needs
input) is detected via Claude Code's own hooks. ASCII-art avatars and the
fan-out grid view are later phases (the sidebar today shows a plain colored
status dot per session, not an avatar).

## Stack

- **`crates/agentd`** — Rust library, no Tauri dependency: owns PTY sessions via
  `portable-pty`, headless virtual-terminal state via `tattoy-wezterm-term`, and
  (in `hooks.rs`) a local loopback-only HTTP server that Claude Code's native
  `"type": "http"` hooks POST to, driving each agent session's live state.
  Designed to be extracted into a standalone daemon process (per the PRD) in a
  later phase without rewriting this logic.
- **`src-tauri`** — Tauri 2 app shell exposing `agentd` over Tauri commands/events.
- **`src`** — React + TypeScript frontend: a `Sidebar` listing every session plus
  one `TerminalView` (`@xterm/xterm`, WebGL-accelerated) per session, kept
  mounted-but-hidden in the background so switching never loses scrollback.

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
- No ASCII-art avatars or fan-out grid yet (Phases 2–3) — the sidebar shows a
  plain status dot per session.
- Every active session's xterm.js instance stays mounted simultaneously (just
  hidden when not focused); there's no render throttling for background panes
  yet. Fine at a handful of sessions, revisit once fan-out drives up pane counts.
- A hook event that fires in the brief window between a new agent session's
  process starting and its id being registered in `SessionManager` is silently
  dropped — self-healing (the next hook event applies normally), so this is
  accepted rather than closed with a two-phase spawn.
- macOS/Linux only for now; Windows (ConPTY) is a later phase.
