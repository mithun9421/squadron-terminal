use std::time::Duration;

use agentd::{SessionId, SessionManager};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::broadcast::error::RecvError;

/// How often the output-forwarding task checks whether a session's shell has
/// exited on its own, so the session can be pruned (and its process reaped)
/// without the frontend ever having to call `close_session`.
const FINISHED_POLL_INTERVAL: Duration = Duration::from_millis(500);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionOutputPayload {
    session_id: SessionId,
    data: Vec<u8>,
}

#[tauri::command]
pub fn spawn_session(
    state: State<'_, SessionManager>,
    app: AppHandle,
    rows: u16,
    cols: u16,
) -> Result<SessionId, String> {
    let id = state.spawn(rows, cols).map_err(|e| e.to_string())?;
    let mut output_rx = state.subscribe(id).map_err(|e| e.to_string())?;

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

    Ok(id)
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
