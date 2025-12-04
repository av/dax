//! Sandbox Tauri commands
//!
//! Exposes sandbox functionality to the frontend

use crate::sandbox::{
    ExecutionRequest, ExecutionResult, RuntimeInfo, SandboxLanguage, SandboxPermissions,
    runtime::Runtime, security::SecurityValidator,
};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Sandbox state managed by Tauri
pub struct SandboxState {
    pub runtime: Arc<Mutex<Runtime>>,
}

impl Default for SandboxState {
    fn default() -> Self {
        Self {
            runtime: Arc::new(Mutex::new(Runtime::new())),
        }
    }
}

/// Execute code in the sandbox
#[tauri::command]
pub async fn execute_code(
    state: State<'_, SandboxState>,
    code: String,
    language: String,
    permissions: Option<SandboxPermissions>,
    working_dir: Option<String>,
) -> Result<ExecutionResult, String> {
    // Parse language
    let lang = match language.to_lowercase().as_str() {
        "python" => SandboxLanguage::Python,
        "javascript" | "js" => SandboxLanguage::JavaScript,
        "shell" | "sh" | "bash" => SandboxLanguage::Shell,
        _ => return Err(format!("Unsupported language: {}", language)),
    };
    
    // Use default permissions if not provided
    let perms = permissions.unwrap_or_default();
    
    // Validate permissions
    SecurityValidator::validate_permissions(&perms)?;
    
    // Validate code for security issues
    SecurityValidator::validate_code(&code, &language)?;
    
    // Build execution request
    let request = ExecutionRequest {
        code,
        language: lang,
        permissions: perms,
        working_dir: working_dir.map(PathBuf::from),
    };
    
    // Execute
    let runtime = state.runtime.lock().await;
    runtime.execute(request).await
}

/// Cancel an active execution
#[tauri::command]
pub async fn cancel_execution(
    state: State<'_, SandboxState>,
    execution_id: String,
) -> Result<(), String> {
    let runtime = state.runtime.lock().await;
    runtime.cancel(&execution_id).await
}

/// List available runtimes
#[tauri::command]
pub async fn list_available_runtimes(
    state: State<'_, SandboxState>,
) -> Result<Vec<RuntimeInfo>, String> {
    let runtime = state.runtime.lock().await;
    Ok(runtime.list_available_runtimes())
}
