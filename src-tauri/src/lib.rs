mod commands;

use std::time::Duration;

use agentd::SessionManager;
use commands::{
    close_session, list_sessions, resize_session, spawn_agent_session, spawn_shell_session,
    write_to_session,
};
use tauri::{Emitter, Manager};

/// How often the sidebar's session list is refreshed. One task for the whole
/// app (not one per session) polling `SessionManager::list()` — each poll is
/// just a fast map lock + clone of small summaries.
const SESSION_LIST_POLL_INTERVAL: Duration = Duration::from_millis(400);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            spawn_shell_session,
            spawn_agent_session,
            list_sessions,
            write_to_session,
            resize_session,
            close_session
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(SESSION_LIST_POLL_INTERVAL).await;
                    let sessions = app_handle.state::<SessionManager>().list();
                    if app_handle.emit("sessions-changed", sessions).is_err() {
                        break;
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
