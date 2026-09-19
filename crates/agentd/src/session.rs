use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tattoy_wezterm_term::color::ColorPalette;
use tattoy_wezterm_term::{Terminal, TerminalConfiguration, TerminalSize};
use tokio::sync::broadcast;

use crate::hooks::{self, AgentState, HookServer};

pub type SessionId = u64;

/// The current visible screen, rendered as plain text, one entry per row.
pub type ScreenSnapshot = Vec<String>;

#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("pty error: {0}")]
    Pty(String),
    #[error("session {0} not found")]
    NotFound(SessionId),
    #[error("agent sessions are unavailable: the local hook server failed to start")]
    HookServerUnavailable,
}

/// Whether a session is a plain shell or a Claude Code agent (hook-instrumented).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionKind {
    Shell,
    Agent,
}

/// A lightweight, frontend-facing view of one session — everything the
/// sidebar needs, without exposing the session's PTY/terminal internals.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: SessionId,
    pub label: String,
    pub kind: SessionKind,
    pub agent_state: Option<AgentState>,
    pub finished: bool,
}

#[derive(Debug)]
struct DefaultTerminalConfig;

impl TerminalConfiguration for DefaultTerminalConfig {
    fn color_palette(&self) -> ColorPalette {
        ColorPalette::default()
    }
}

/// Shares one underlying pty writer behind a mutex, so both user keystrokes and
/// the terminal engine's own autonomous responses (cursor position reports,
/// answerback, etc.) write to the same pty input.
#[derive(Clone)]
struct SharedWriter(Arc<Mutex<Box<dyn Write + Send>>>);

impl Write for SharedWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        lock(&self.0).write(buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        lock(&self.0).flush()
    }
}

fn pty_err(e: impl std::fmt::Display) -> SessionError {
    SessionError::Pty(e.to_string())
}

/// Locks a mutex, recovering the inner value if a previous holder panicked
/// while it was locked. `panic = "abort"` is set for release builds, so a
/// poisoned lock here would otherwise mean *no* recovery is possible; treating
/// a poisoned session mutex as merely "possibly inconsistent" beats taking the
/// whole process down with every other running session in it.
fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn resolved_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
}

/// A sensible default working directory for a session nobody gave an
/// explicit one. Never leave the pty's cwd unset: an unset cwd makes
/// `portable_pty` inherit *this app's own process* working directory, which
/// is an implementation detail (in dev builds, literally this repo's own
/// checkout) — not something a spawned shell or agent should ever land in
/// silently.
fn default_session_cwd() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/"))
}

/// Session-identity env vars Claude Code itself sets (`CLAUDECODE`,
/// `CLAUDE_CODE_SESSION_ID`, the inter-agent `CLAUDE_CODE_MESSAGING_*`
/// socket/token, ...). `portable_pty::CommandBuilder` inherits the parent
/// process's full environment by default, and this app's own process may
/// itself have been launched from inside a Claude Code session (a dev
/// terminal, an editor's integrated terminal, ...) — without scrubbing these,
/// a spawned session (and anything run inside it, including a manually-typed
/// `claude`) would silently inherit them and attach to *that* session's
/// identity/messaging channel instead of starting genuinely independent.
const SESSION_IDENTITY_ENV_VARS: &[&str] = &[
    "CLAUDECODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_SESSION_ATTENDED",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
    "CLAUDE_PID",
    "CLAUDE_EFFORT",
];

/// A `CommandBuilder` for `program` with every session-identity env var
/// removed, so every session this app spawns — shell or agent — starts as an
/// independent process regardless of what launched this app itself.
fn isolated_command(program: impl AsRef<std::ffi::OsStr>) -> CommandBuilder {
    let mut command = CommandBuilder::new(program);
    for var in SESSION_IDENTITY_ENV_VARS {
        command.env_remove(var);
    }
    command
}

/// Writes a `--settings`-scoped Claude Code config wiring every hook we care
/// about to this app's local hook server, keyed by `token`. Never touches the
/// user's own global or project settings.
fn write_hook_settings(token: &str, hook_port: u16) -> Result<PathBuf, SessionError> {
    let dir = std::env::temp_dir().join("squadron-terminal");
    std::fs::create_dir_all(&dir).map_err(pty_err)?;
    // The hook token is not a cryptographic secret (the trust boundary is
    // "loopback + same OS user"), but that boundary is only real if other
    // local users can't just read the token off disk — a shared /tmp is
    // common enough on Linux that this must be enforced, not incidental.
    #[cfg(unix)]
    restrict_to_owner(&dir, 0o700)?;

    let path = dir.join(format!("hooks-{token}.json"));

    let url = format!("http://127.0.0.1:{hook_port}/hook/{token}");
    let hook_action =
        serde_json::json!([{ "hooks": [{ "type": "http", "url": url, "timeout": 5 }] }]);
    let settings = serde_json::json!({
        "hooks": {
            "SessionStart": hook_action,
            "UserPromptSubmit": hook_action,
            "PreToolUse": hook_action,
            "PostToolUse": hook_action,
            "PostToolUseFailure": hook_action,
            "Notification": hook_action,
            "Stop": hook_action,
        }
    });

    let bytes = serde_json::to_vec_pretty(&settings).map_err(pty_err)?;
    std::fs::write(&path, bytes).map_err(pty_err)?;
    #[cfg(unix)]
    restrict_to_owner(&path, 0o600)?;
    Ok(path)
}

#[cfg(unix)]
fn restrict_to_owner(path: &std::path::Path, mode: u32) -> Result<(), SessionError> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).map_err(pty_err)
}

/// A single running session: a PTY-backed child process plus the headless
/// virtual-terminal state that tracks what is currently on screen, independent
/// of whether any UI is watching it.
pub struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: SharedWriter,
    terminal: Arc<Mutex<Terminal>>,
    output_tx: broadcast::Sender<Vec<u8>>,
    finished: Arc<AtomicBool>,
    child: Option<Box<dyn Child + Send + Sync>>,
    kind: SessionKind,
    label: String,
    agent_state: Mutex<Option<AgentState>>,
    settings_path: Option<PathBuf>,
    hook_cleanup: Option<Box<dyn FnOnce() + Send>>,
}

impl Session {
    fn spawn_shell(rows: u16, cols: u16, label: String) -> Result<Self, SessionError> {
        let mut command = isolated_command(resolved_shell());
        command.cwd(default_session_cwd());
        Self::spawn_with_command(rows, cols, SessionKind::Shell, label, command, None, None)
    }

    fn spawn_agent(
        id: SessionId,
        rows: u16,
        cols: u16,
        label: String,
        cwd: Option<PathBuf>,
        hook_server: &Arc<HookServer>,
    ) -> Result<Self, SessionError> {
        let token = hooks::generate_token(id);
        let settings_path = write_hook_settings(&token, hook_server.port())?;
        // Known, accepted race: the token is routable, and the child (spawned
        // below) can in principle fire its SessionStart hook, before `id` is
        // inserted into SessionManager's map — `HookServer`'s callback would
        // silently drop that one event. Self-healing (the very next hook
        // event for this session applies normally) and not worth a two-phase
        // spawn/insert to close for a single possibly-missed Idle transition.
        hook_server.register(token.clone(), id);

        let mut command = isolated_command(resolved_shell());
        // The settings path is passed as a positional argument (`$1`), not
        // interpolated into the command string, so nothing about its content
        // (even an unlikely quote/space in a user's TMPDIR) can change what
        // gets executed. `--` is the conventional placeholder for `$0`.
        command.args([
            "-lc",
            "exec claude --settings \"$1\"",
            "--",
            settings_path.to_string_lossy().as_ref(),
        ]);
        command.cwd(cwd.unwrap_or_else(default_session_cwd));

        let server_for_cleanup = Arc::clone(hook_server);
        let token_for_cleanup = token.clone();
        let hook_cleanup: Box<dyn FnOnce() + Send> =
            Box::new(move || server_for_cleanup.unregister(&token_for_cleanup));

        let result = Self::spawn_with_command(
            rows,
            cols,
            SessionKind::Agent,
            label,
            command,
            Some(settings_path.clone()),
            Some(hook_cleanup),
        );

        // `spawn_with_command` failing means no `Session` was ever
        // constructed, so its `Drop` impl (which would otherwise unregister
        // the token and delete the settings file) never runs — do it here
        // instead, or both leak for the life of the app.
        if result.is_err() {
            hook_server.unregister(&token);
            let _ = std::fs::remove_file(&settings_path);
        }

        result
    }

    fn spawn_with_command(
        rows: u16,
        cols: u16,
        kind: SessionKind,
        label: String,
        command: CommandBuilder,
        settings_path: Option<PathBuf>,
        hook_cleanup: Option<Box<dyn FnOnce() + Send>>,
    ) -> Result<Self, SessionError> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(pty_err)?;

        let child = pair.slave.spawn_command(command).map_err(pty_err)?;

        let raw_writer = pair.master.take_writer().map_err(pty_err)?;
        let writer = SharedWriter(Arc::new(Mutex::new(raw_writer)));

        let terminal_size = TerminalSize {
            rows: rows as usize,
            cols: cols as usize,
            ..Default::default()
        };
        let terminal = Terminal::new(
            terminal_size,
            Arc::new(DefaultTerminalConfig),
            "squadron-terminal",
            env!("CARGO_PKG_VERSION"),
            Box::new(writer.clone()),
        );
        let terminal = Arc::new(Mutex::new(terminal));

        let (output_tx, _initial_rx) = broadcast::channel(1024);
        let finished = Arc::new(AtomicBool::new(false));

        let mut reader = pair.master.try_clone_reader().map_err(pty_err)?;
        let reader_terminal = Arc::clone(&terminal);
        let reader_tx = output_tx.clone();
        let reader_finished = Arc::clone(&finished);
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let chunk = buf[..n].to_vec();
                        lock(&reader_terminal).advance_bytes(&chunk);
                        // Send failing just means nobody is subscribed right now.
                        let _ = reader_tx.send(chunk);
                    }
                    Err(_) => break,
                }
            }
            // Marks the session eligible for pruning once the process exits on
            // its own (as opposed to an explicit close) — see
            // SessionManager::spawn's caller-side reaper, which is what
            // actually removes it from the map.
            reader_finished.store(true, Ordering::SeqCst);
        });

        Ok(Self {
            master: pair.master,
            writer,
            terminal,
            output_tx,
            finished,
            child: Some(child),
            kind,
            label,
            agent_state: Mutex::new(None),
            settings_path,
            hook_cleanup,
        })
    }

    pub fn pid(&self) -> Option<u32> {
        self.child.as_ref().and_then(|child| child.process_id())
    }

    pub fn is_finished(&self) -> bool {
        self.finished.load(Ordering::SeqCst)
    }

    pub fn agent_state(&self) -> Option<AgentState> {
        *lock(&self.agent_state)
    }

    pub fn set_agent_state(&self, state: AgentState) {
        *lock(&self.agent_state) = Some(state);
    }

    pub fn summary(&self, id: SessionId) -> SessionSummary {
        SessionSummary {
            id,
            label: self.label.clone(),
            kind: self.kind,
            agent_state: self.agent_state(),
            finished: self.is_finished(),
        }
    }

    pub fn write(&self, bytes: &[u8]) -> Result<(), SessionError> {
        let mut writer = self.writer.clone();
        writer.write_all(bytes).map_err(pty_err)
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), SessionError> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(pty_err)?;
        lock(&self.terminal).resize(TerminalSize {
            rows: rows as usize,
            cols: cols as usize,
            ..Default::default()
        });
        Ok(())
    }

    pub fn size(&self) -> Result<(u16, u16), SessionError> {
        let size = self.master.get_size().map_err(pty_err)?;
        Ok((size.rows, size.cols))
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Vec<u8>> {
        self.output_tx.subscribe()
    }

    /// Renders the current visible screen as plain text, one entry per row.
    pub fn snapshot(&self) -> ScreenSnapshot {
        let term = lock(&self.terminal);
        let screen = term.screen();
        screen
            .lines_in_phys_range(0..screen.physical_rows)
            .iter()
            .map(|line| line.as_str().trim_end().to_string())
            .collect()
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if let Some(cleanup) = self.hook_cleanup.take() {
            cleanup();
        }
        if let Some(path) = &self.settings_path {
            let _ = std::fs::remove_file(path);
        }
        // Closing a session must never leave a zombie or orphaned process
        // behind, and must never leave one running just because it ignored
        // the pty hangup. `kill` is best-effort (the child may already have
        // exited); reaping happens off this thread so dropping a Session
        // never blocks its caller on the child's exit.
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
}

/// Owns every running session for the app, plus the local hook server every
/// Claude Code agent session's `--settings` file points at. Deliberately free
/// of any Tauri dependency: this is the seam where a standalone `agentd`
/// daemon process (per the PRD's architecture) takes over in a later phase,
/// without rewriting the session/PTY/VT/hook logic itself.
///
/// Sessions are held behind `Arc` so the map lock only ever guards a hashmap
/// lookup + refcount bump, never a session's own I/O (a slow or blocked PTY
/// write on one session must not stall every other session in the app).
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<SessionId, Arc<Mutex<Session>>>>>,
    next_id: AtomicU64,
    // `None` if the loopback bind failed at startup (sandboxed environment,
    // restrictive local security software, ...) — plain shells still work
    // either way; only agent sessions need this.
    hook_server: Option<Arc<HookServer>>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManager {
    pub fn new() -> Self {
        let sessions: Arc<Mutex<HashMap<SessionId, Arc<Mutex<Session>>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        // The hook server's callback needs to reach the same map `spawn`
        // inserts into, so it holds its own clone of the same `Arc` rather
        // than a copy of the map.
        let state_sessions = Arc::clone(&sessions);
        let hook_server = HookServer::start(move |id, state| {
            if let Some(session) = lock(&state_sessions).get(&id) {
                lock(session).set_agent_state(state);
            }
        })
        .map(Arc::new);

        Self {
            sessions,
            next_id: AtomicU64::new(0),
            hook_server,
        }
    }

    pub fn spawn(&self, rows: u16, cols: u16) -> Result<SessionId, SessionError> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let label = format!("Shell {id}");
        let session = Session::spawn_shell(rows, cols, label)?;
        lock(&self.sessions).insert(id, Arc::new(Mutex::new(session)));
        Ok(id)
    }

    pub fn spawn_agent(
        &self,
        rows: u16,
        cols: u16,
        label: String,
        cwd: Option<PathBuf>,
    ) -> Result<SessionId, SessionError> {
        let hook_server = self
            .hook_server
            .as_ref()
            .ok_or(SessionError::HookServerUnavailable)?;
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let session = Session::spawn_agent(id, rows, cols, label, cwd, hook_server)?;
        lock(&self.sessions).insert(id, Arc::new(Mutex::new(session)));
        Ok(id)
    }

    pub fn write(&self, id: SessionId, bytes: &[u8]) -> Result<(), SessionError> {
        let session = self.get(id)?;
        let result = lock(&session).write(bytes);
        result
    }

    pub fn resize(&self, id: SessionId, rows: u16, cols: u16) -> Result<(), SessionError> {
        let session = self.get(id)?;
        let result = lock(&session).resize(rows, cols);
        result
    }

    pub fn size(&self, id: SessionId) -> Result<(u16, u16), SessionError> {
        let session = self.get(id)?;
        let result = lock(&session).size();
        result
    }

    pub fn snapshot(&self, id: SessionId) -> Result<ScreenSnapshot, SessionError> {
        let session = self.get(id)?;
        let snapshot = lock(&session).snapshot();
        Ok(snapshot)
    }

    pub fn pid(&self, id: SessionId) -> Result<Option<u32>, SessionError> {
        let session = self.get(id)?;
        let pid = lock(&session).pid();
        Ok(pid)
    }

    pub fn is_finished(&self, id: SessionId) -> Result<bool, SessionError> {
        let session = self.get(id)?;
        let finished = lock(&session).is_finished();
        Ok(finished)
    }

    pub fn subscribe(&self, id: SessionId) -> Result<broadcast::Receiver<Vec<u8>>, SessionError> {
        let session = self.get(id)?;
        let receiver = lock(&session).subscribe();
        Ok(receiver)
    }

    /// A snapshot of every session's frontend-facing summary, in no
    /// particular order — the sidebar sorts/renders as it sees fit.
    pub fn list(&self) -> Vec<SessionSummary> {
        lock(&self.sessions)
            .iter()
            .map(|(&id, session)| lock(session).summary(id))
            .collect()
    }

    /// Removes and drops the session, killing and reaping its child process
    /// (and, for an agent session, unregistering its hook token and deleting
    /// its temporary `--settings` file).
    pub fn close(&self, id: SessionId) -> Result<(), SessionError> {
        lock(&self.sessions)
            .remove(&id)
            .map(|_| ())
            .ok_or(SessionError::NotFound(id))
    }

    /// Clones out the session's `Arc` under the map lock only long enough for
    /// a hashmap lookup + refcount bump — never for the session's own I/O, so
    /// one session blocked on a slow PTY write can't stall any other session.
    fn get(&self, id: SessionId) -> Result<Arc<Mutex<Session>>, SessionError> {
        lock(&self.sessions)
            .get(&id)
            .cloned()
            .ok_or(SessionError::NotFound(id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn wait_for_snapshot_containing(
        manager: &SessionManager,
        id: SessionId,
        needle: &str,
        timeout: Duration,
    ) -> ScreenSnapshot {
        let deadline = Instant::now() + timeout;
        loop {
            let snapshot = manager.snapshot(id).expect("session should exist");
            if snapshot.iter().any(|line| line.contains(needle)) {
                return snapshot;
            }
            if Instant::now() >= deadline {
                return snapshot;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    fn wait_until(mut predicate: impl FnMut() -> bool, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        loop {
            if predicate() {
                return true;
            }
            if Instant::now() >= deadline {
                return false;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    #[test]
    fn spawns_a_live_shell_process() {
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");
        let pid = manager.pid(id).expect("session should exist");
        assert!(pid.is_some(), "spawned session should report a live pid");
    }

    #[test]
    fn shell_sessions_default_cwd_to_home_not_this_process_cwd() {
        // Regression test: an unset pty cwd previously fell back to *this
        // test binary's own* working directory (the repo checkout) instead
        // of something sensible. Asserts the actual intended fallback
        // ($HOME) is where the session lands — not merely that the old
        // broken value is absent, which a differently-broken fallback could
        // also satisfy.
        let home = std::env::var("HOME").expect("HOME should be set in the test environment");
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");

        manager.write(id, b"pwd\n").expect("write should succeed");

        let snapshot = wait_for_snapshot_containing(&manager, id, &home, Duration::from_secs(3));
        assert!(
            snapshot.iter().any(|line| line.trim() == home),
            "spawned shell's cwd should default to $HOME ({home}), got: {snapshot:?}"
        );
    }

    #[test]
    fn spawned_shells_do_not_inherit_claude_session_identity_env_vars() {
        // This app's own process may itself have been launched from inside a
        // Claude Code session (a dev terminal, an editor's integrated
        // terminal, ...) — spawned sessions must never inherit that
        // session's identity, or anything run inside them (including a
        // manually-typed `claude`) would silently attach to it. The var name
        // is unique to this test, so mutating process env here can't
        // cross-contaminate other tests running in parallel.
        // SAFETY: single-threaded with respect to this variable — nothing
        // else in this crate's test suite reads or writes it.
        unsafe {
            std::env::set_var("CLAUDE_CODE_SESSION_ID", "outer-session-should-not-leak");
        }

        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");
        manager
            .write(id, b"echo \"marker=[$CLAUDE_CODE_SESSION_ID]\"\n")
            .expect("write should succeed");

        let snapshot =
            wait_for_snapshot_containing(&manager, id, "marker=[]", Duration::from_secs(3));

        // SAFETY: see above.
        unsafe {
            std::env::remove_var("CLAUDE_CODE_SESSION_ID");
        }

        assert!(
            snapshot.iter().any(|line| line.contains("marker=[]")),
            "CLAUDE_CODE_SESSION_ID should be unset in the spawned session, got: {snapshot:?}"
        );
    }

    #[test]
    fn writing_input_updates_the_screen_grid() {
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");

        let marker = "SQUADRON_TEST_MARKER_12345";
        manager
            .write(id, format!("echo {marker}\n").as_bytes())
            .expect("write should succeed");

        let snapshot = wait_for_snapshot_containing(&manager, id, marker, Duration::from_secs(3));
        assert!(
            snapshot.iter().any(|line| line.contains(marker)),
            "expected the echoed marker to appear in the screen grid, got: {snapshot:?}"
        );
    }

    #[test]
    fn resize_updates_reported_dimensions() {
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");

        manager.resize(id, 40, 120).expect("resize should succeed");

        let (rows, cols) = manager.size(id).expect("session should exist");
        assert_eq!((rows, cols), (40, 120));
    }

    #[test]
    fn operating_on_unknown_session_returns_not_found() {
        let manager = SessionManager::new();
        let result = manager.write(999, b"hello");
        assert!(matches!(result, Err(SessionError::NotFound(999))));
    }

    #[test]
    fn marks_itself_finished_when_the_shell_exits_on_its_own() {
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");

        assert!(!manager.is_finished(id).expect("session should exist"));

        manager.write(id, b"exit\n").expect("write should succeed");

        let became_finished = wait_until(
            || manager.is_finished(id).unwrap_or(true),
            Duration::from_secs(3),
        );
        assert!(
            became_finished,
            "session should mark itself finished after the shell exits"
        );
    }

    #[test]
    fn list_reports_shell_sessions_with_no_agent_state() {
        let manager = SessionManager::new();
        let id = manager.spawn(24, 80).expect("spawn should succeed");

        let summaries = manager.list();
        let summary = summaries
            .iter()
            .find(|s| s.id == id)
            .expect("session should be listed");
        assert_eq!(summary.kind, SessionKind::Shell);
        assert_eq!(summary.agent_state, None);
        assert!(!summary.finished);
    }

    #[test]
    fn spawn_agent_writes_a_settings_file_pointing_at_the_hook_server() {
        let manager = SessionManager::new();
        // A fake, guaranteed-not-to-exist "claude" won't matter: we're only
        // checking the settings file this call generates before spawning,
        // not the child process's behavior. A real shell always exists.
        let id = manager
            .spawn_agent(24, 80, "Test Agent".to_string(), None)
            .expect("spawn_agent should succeed even if `claude` itself isn't installed here");

        let summaries = manager.list();
        let summary = summaries
            .iter()
            .find(|s| s.id == id)
            .expect("session should be listed");
        assert_eq!(summary.kind, SessionKind::Agent);
        assert_eq!(summary.label, "Test Agent");

        let dir = std::env::temp_dir().join("squadron-terminal");
        let has_settings_file = std::fs::read_dir(&dir)
            .map(|entries| entries.filter_map(Result::ok).count() > 0)
            .unwrap_or(false);
        assert!(
            has_settings_file,
            "expected at least one generated hooks-*.json settings file"
        );

        manager.close(id).expect("close should succeed");
    }
}
