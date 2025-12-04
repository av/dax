pub mod files;
pub mod llm;
pub mod sandbox;
pub mod settings;
pub mod system;
pub mod workspace;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Dax.", name)
}

pub use files::{generate_preview, get_file_metadata, read_file, write_file, watch_file, unwatch_file, save_file};
pub use llm::{call_llm, cancel_llm_stream, stream_llm};
pub use sandbox::{execute_code, cancel_execution, list_available_runtimes, SandboxState};
pub use settings::{get_app_settings, save_app_settings, set_api_key, has_api_key, delete_api_key, test_api_connection};
pub use system::{get_system_info, check_capability, get_data_directory};
pub use workspace::{
    create_workspace, save_workspace, load_workspace, export_workspace,
    get_current_workspace, close_workspace, WorkspaceManager,
};
