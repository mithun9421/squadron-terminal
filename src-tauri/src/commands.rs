use std::path::PathBuf;
use std::time::Duration;

use agentd::{SessionId, SessionManager, SessionSummary};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast::error::RecvError;

/// How often the output-forwarding task checks whether a session's process has
/// exited on its own, so the session can be pruned (and its process reaped)
/// without the frontend ever having to call `close_session`.
const FINISHED_POLL_INTERVAL: Duration = Duration::from_millis(500);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionOutputPayload {
    session_id: SessionId,
    data: Vec<u8>,
}

/// Spawns the background task that forwards one session's raw output bytes to
/// the frontend as `session-output` events, and prunes the session once its
/// process exits on its own. Shared by every "spawn a session" command,
/// regardless of session kind.
fn start_output_forwarding(
    app: AppHandle,
    id: SessionId,
    mut output_rx: tokio::sync::broadcast::Receiver<Vec<u8>>,
) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                result = output_rx.recv() => match result {
                    Ok(data) => {
                        let payload = SessionOutputPayload { session_id: id, data };
                        if app.emit("session-output", payload).is_err() {
                            break;
                        }
                    }
                    Err(RecvError::Lagged(_)) => continue,
                    Err(RecvError::Closed) => break,
                },
                _ = tokio::time::sleep(FINISHED_POLL_INTERVAL) => {
                    let manager = app.state::<SessionManager>();
                    if manager.is_finished(id).unwrap_or(true) {
                        let _ = manager.close(id);
                        break;
                    }
                }
            }
        }
    });
}

#[tauri::command]
pub fn spawn_shell_session(
    state: State<'_, SessionManager>,
    app: AppHandle,
    rows: u16,
    cols: u16,
) -> Result<SessionId, String> {
    let id = state.spawn(rows, cols).map_err(|e| e.to_string())?;
    let output_rx = state.subscribe(id).map_err(|e| e.to_string())?;
    start_output_forwarding(app, id, output_rx);
    Ok(id)
}

#[tauri::command]
pub fn spawn_agent_session(
    state: State<'_, SessionManager>,
    app: AppHandle,
    rows: u16,
    cols: u16,
    label: String,
    cwd: Option<String>,
) -> Result<SessionId, String> {
    let id = state
        .spawn_agent(rows, cols, label, cwd.map(PathBuf::from))
        .map_err(|e| e.to_string())?;
    let output_rx = state.subscribe(id).map_err(|e| e.to_string())?;
    start_output_forwarding(app, id, output_rx);
    Ok(id)
}

#[tauri::command]
pub fn list_sessions(state: State<'_, SessionManager>) -> Vec<SessionSummary> {
    state.list()
}

#[tauri::command]
pub fn write_to_session(
    state: State<'_, SessionManager>,
    session_id: SessionId,
    data: Vec<u8>,
) -> Result<(), String> {
    state.write(session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_session(
    state: State<'_, SessionManager>,
    session_id: SessionId,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state
        .resize(session_id, rows, cols)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_session(
    state: State<'_, SessionManager>,
    session_id: SessionId,
) -> Result<(), String> {
    state.close(session_id).map_err(|e| e.to_string())
}
