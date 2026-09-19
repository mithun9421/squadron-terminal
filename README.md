# Squadron Terminal

A terminal emulator purpose-built for running and supervising multiple Claude Code
agents at once. See the [product PRD](https://claude.ai/code/artifact/07e1a0af-b097-41bd-9ce2-0a7c93407a1d)
for the full requirements, competitive landscape, and architecture rationale.

This repo currently implements **Phase 0** of the roadmap: a real, GPU-rendered
terminal emulator (Tauri 2 + Rust PTY/VT core + xterm.js), with nothing
agent-specific yet. The agent sidebar, ASCII avatars, and fan-out grid are later
phases.

## Stack

- **`crates/agentd`** — Rust library, no Tauri dependency: owns PTY sessions via
  `portable-pty` and headless virtual-terminal state via `tattoy-wezterm-term`.
  Designed to be extracted into a standalone daemon process (per the PRD) in a
  later phase without rewriting this logic.
- **`src-tauri`** — Tauri 2 app shell exposing `agentd` over Tauri commands/events.
- **`src`** — React + TypeScript frontend rendering the terminal with
  `@xterm/xterm` (WebGL-accelerated).

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

## Known Phase 0 limitations

- Session state lives in-process in the Tauri app, not yet a separate `agentd`
  daemon process — an app crash currently takes running sessions down with it.
  The `agentd` crate has no Tauri dependency specifically so this can be
  extracted later without a rewrite.
- No agent sidebar, ASCII avatars, agent-state detection, or fan-out grid yet.
- macOS/Linux only for now; Windows (ConPTY) is a later phase.
