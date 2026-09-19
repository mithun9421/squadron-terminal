mod commands;

use agentd::SessionManager;
use commands::{close_session, resize_session, spawn_session, write_to_session};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            spawn_session,
            write_to_session,
            resize_session,
            close_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
