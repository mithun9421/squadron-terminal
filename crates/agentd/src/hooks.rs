use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

/// Hook payloads are small JSON objects; anything past this is either not a
/// real Claude Code hook or a bug, and either way isn't worth buffering.
const MAX_HOOK_BODY_BYTES: u64 = 64 * 1024;

use serde::Serialize;

use crate::session::SessionId;

/// A Claude Code agent's lifecycle state, as observed through its hooks.
/// Deliberately not a 1:1 mirror of every hook event: `Stop` means "finished
/// this turn, waiting on the user" (mapped to `Idle`), not "process exited" —
/// process exit is tracked separately via `Session::is_finished`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentState {
    Idle,
    Thinking,
    RunningTool,
    NeedsInput,
}

/// Maps a Claude Code hook event name to the agent state it implies, or
/// `None` for an event we don't track (or don't recognize — new hook events
/// should degrade to "no state change" rather than erroring).
pub fn derive_state(hook_event_name: &str) -> Option<AgentState> {
    match hook_event_name {
        "SessionStart" | "Stop" => Some(AgentState::Idle),
        "UserPromptSubmit" => Some(AgentState::Thinking),
        "PreToolUse" => Some(AgentState::RunningTool),
        "PostToolUse" | "PostToolUseFailure" => Some(AgentState::Thinking),
        "Notification" => Some(AgentState::NeedsInput),
        _ => None,
    }
}

/// Generates an unpredictable-enough local routing token for one agent
/// session's hooks. This is not a cryptographic secret — the real trust
/// boundary is "loopback + same OS user", same as any other local dev
/// tool — it just keeps one session's hook traffic from being trivially
/// guessable by another local process.
pub fn generate_token(id: SessionId) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    id.hash(&mut hasher);
    SystemTime::now().hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// A local, loopback-only HTTP server that Claude Code's `http`-type hooks
/// POST to. One server instance is shared by every agent session for the
/// life of the app; each session gets its own routing token rather than its
/// own port.
pub struct HookServer {
    port: u16,
    routes: Arc<Mutex<HashMap<String, SessionId>>>,
}

impl HookServer {
    /// Starts the server on an OS-assigned loopback port and returns
    /// immediately; the listen loop runs on its own thread. Returns `None`
    /// if the loopback bind itself fails (sandboxed environment, restrictive
    /// local security software, etc.) — that disables agent-session spawning
    /// but must never take down an app whose user only wants a plain shell.
    pub fn start(on_event: impl Fn(SessionId, AgentState) + Send + Sync + 'static) -> Option<Self> {
        let server = tiny_http::Server::http("127.0.0.1:0").ok()?;
        let port = server.server_addr().to_ip()?.port();
        let routes: Arc<Mutex<HashMap<String, SessionId>>> = Arc::new(Mutex::new(HashMap::new()));
        let handler_routes = Arc::clone(&routes);

        std::thread::spawn(move || {
            for mut request in server.incoming_requests() {
                let mut body = String::new();
                let _ = request
                    .as_reader()
                    .take(MAX_HOOK_BODY_BYTES)
                    .read_to_string(&mut body);

                if let Some(token) = token_from_path(request.url()) {
                    handle_hook_event(&handler_routes, &token, &body, &on_event);
                }

                let response = tiny_http::Response::empty(200);
                let _ = request.respond(response);
            }
        });

        Some(Self { port, routes })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Registers a session as the target for hook events carrying `token`.
    pub fn register(&self, token: String, id: SessionId) {
        self.routes
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(token, id);
    }

    /// Stops routing hook events for this token (called when a session closes).
    pub fn unregister(&self, token: &str) {
        self.routes
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(token);
    }
}

fn token_from_path(url: &str) -> Option<String> {
    url.strip_prefix("/hook/")
        .map(|rest| rest.trim_end_matches('/').to_string())
}

fn handle_hook_event(
    routes: &Mutex<HashMap<String, SessionId>>,
    token: &str,
    body: &str,
    on_event: &(impl Fn(SessionId, AgentState) + Send + Sync + 'static),
) {
    let Some(&id) = routes.lock().unwrap_or_else(|p| p.into_inner()).get(token) else {
        return;
    };
    let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) else {
        return;
    };
    let Some(event_name) = payload.get("hook_event_name").and_then(|v| v.as_str()) else {
        return;
    };
    if let Some(state) = derive_state(event_name) {
        on_event(id, state);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_events_to_expected_states() {
        assert_eq!(derive_state("SessionStart"), Some(AgentState::Idle));
        assert_eq!(derive_state("Stop"), Some(AgentState::Idle));
        assert_eq!(derive_state("UserPromptSubmit"), Some(AgentState::Thinking));
        assert_eq!(derive_state("PreToolUse"), Some(AgentState::RunningTool));
        assert_eq!(derive_state("PostToolUse"), Some(AgentState::Thinking));
        assert_eq!(
            derive_state("PostToolUseFailure"),
            Some(AgentState::Thinking)
        );
        assert_eq!(derive_state("Notification"), Some(AgentState::NeedsInput));
    }

    #[test]
    fn unrecognized_events_map_to_no_state_change() {
        assert_eq!(derive_state("SubagentStart"), None);
        assert_eq!(derive_state("SomeFutureHookEvent"), None);
    }

    #[test]
    fn tokens_are_unique_per_call() {
        let a = generate_token(1);
        let b = generate_token(1);
        assert_ne!(
            a, b,
            "tokens should not collide across separate spawns of the same session id"
        );
    }

    #[test]
    fn extracts_token_from_hook_path() {
        assert_eq!(token_from_path("/hook/abc123"), Some("abc123".to_string()));
        assert_eq!(token_from_path("/hook/abc123/"), Some("abc123".to_string()));
        assert_eq!(token_from_path("/other"), None);
    }
}
