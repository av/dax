pub mod commands;
pub mod models;
pub mod persistence;
pub mod sandbox;

use commands::{
    call_llm, cancel_llm_stream, execute_code, cancel_execution, list_available_runtimes,
    generate_preview, get_file_metadata, greet, read_file,
    save_file, stream_llm, unwatch_file, watch_file, write_file, SandboxState,
    create_workspace, save_workspace, load_workspace, export_workspace,
    get_current_workspace, close_workspace, WorkspaceManager,
    get_system_info, check_capability, get_data_directory,
    get_app_settings, save_app_settings, set_api_key, has_api_key, delete_api_key, test_api_connection,
};
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(SandboxState::default())
        .manage(Mutex::new(WorkspaceManager::default()))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_file_metadata,
            read_file,
            write_file,
            generate_preview,
            call_llm,
            stream_llm,
            cancel_llm_stream,
            watch_file,
            unwatch_file,
            save_file,
            execute_code,
            cancel_execution,
            list_available_runtimes,
            create_workspace,
            save_workspace,
            load_workspace,
            export_workspace,
            get_current_workspace,
            close_workspace,
            get_system_info,
            check_capability,
            get_data_directory,
            get_app_settings,
            save_app_settings,
            set_api_key,
            has_api_key,
            delete_api_key,
            test_api_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
