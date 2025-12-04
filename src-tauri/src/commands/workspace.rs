//! Workspace Tauri commands
//!
//! Manages workspace creation, loading, saving, and exporting

use crate::models::workspace::{Workspace, WorkspaceMetadata};
use crate::persistence::Database;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;

/// Workspace manager state
pub struct WorkspaceManager {
    pub current_workspace: Option<Workspace>,
    pub database: Option<Database>,
}

impl Default for WorkspaceManager {
    fn default() -> Self {
        Self {
            current_workspace: None,
            database: None,
        }
    }
}

/// Workspace creation request
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub path: Option<String>,
}

/// Workspace save request
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkspaceRequest {
    pub objects: Vec<serde_json::Value>,
    pub boundaries: Vec<serde_json::Value>,
    pub beacons: Vec<serde_json::Value>,
    pub snippets: Vec<serde_json::Value>,
    pub camera_state: Option<serde_json::Value>,
    pub settings: Option<serde_json::Value>,
}

/// Workspace export format
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedWorkspace {
    pub metadata: WorkspaceMetadata,
    pub objects: Vec<serde_json::Value>,
    pub boundaries: Vec<serde_json::Value>,
    pub beacons: Vec<serde_json::Value>,
    pub snippets: Vec<serde_json::Value>,
    pub camera_state: Option<serde_json::Value>,
    pub settings: Option<serde_json::Value>,
}

/// Create a new workspace
#[tauri::command]
pub async fn create_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
    request: CreateWorkspaceRequest,
) -> Result<WorkspaceMetadata, String> {
    let mut manager = state.lock().await;

    // Determine workspace path
    let workspace_path = if let Some(path) = request.path {
        PathBuf::from(path)
    } else {
        // Use default path in user's documents
        let base = dirs::document_dir()
            .ok_or("Could not determine documents directory")?;
        base.join("dax-workspaces").join(&request.name)
    };

    // Create directory if needed
    std::fs::create_dir_all(&workspace_path)
        .map_err(|e| format!("Failed to create workspace directory: {}", e))?;

    // Create workspace metadata
    let metadata = WorkspaceMetadata {
        id: uuid::Uuid::new_v4().to_string(),
        name: request.name,
        path: workspace_path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().timestamp_millis(),
        updated_at: chrono::Utc::now().timestamp_millis(),
    };

    // Initialize database
    let db_path = workspace_path.join("workspace.db");
    let database = Database::new(&db_path)
        .await
        .map_err(|e| format!("Failed to create database: {}", e))?;

    // Create workspace
    let workspace = Workspace {
        metadata: metadata.clone(),
        objects: Vec::new(),
        boundaries: Vec::new(),
        beacons: Vec::new(),
        snippets: Vec::new(),
        camera_state: None,
        settings: None,
    };

    manager.current_workspace = Some(workspace);
    manager.database = Some(database);

    Ok(metadata)
}

/// Save the current workspace
#[tauri::command]
pub async fn save_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
    request: SaveWorkspaceRequest,
) -> Result<(), String> {
    let mut manager = state.lock().await;

    // First, update the workspace data
    {
        let workspace = manager.current_workspace.as_mut()
            .ok_or("No workspace is currently open")?;

        workspace.objects = request.objects;
        workspace.boundaries = request.boundaries;
        workspace.beacons = request.beacons;
        workspace.snippets = request.snippets;
        workspace.camera_state = request.camera_state;
        workspace.settings = request.settings;
        workspace.metadata.updated_at = chrono::Utc::now().timestamp_millis();
    }

    // Now save to database (after the mutable borrow is dropped)
    if let Some(ref database) = &manager.database {
        let workspace = manager.current_workspace.as_ref()
            .ok_or("No workspace is currently open")?;
        database.save_workspace(workspace)
            .await
            .map_err(|e| format!("Failed to save workspace: {}", e))?;
    }

    Ok(())
}

/// Load a workspace from a path
#[tauri::command]
pub async fn load_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
    path: String,
) -> Result<ExportedWorkspace, String> {
    let mut manager = state.lock().await;

    let workspace_path = PathBuf::from(&path);
    
    if !workspace_path.exists() {
        return Err(format!("Workspace path does not exist: {}", path));
    }

    let db_path = workspace_path.join("workspace.db");
    
    if !db_path.exists() {
        return Err("No workspace database found at the specified path".to_string());
    }

    // Open database
    let database = Database::new(&db_path)
        .await
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Load workspace
    let workspace = database.load_workspace()
        .await
        .map_err(|e| format!("Failed to load workspace: {}", e))?;

    let exported = ExportedWorkspace {
        metadata: workspace.metadata.clone(),
        objects: workspace.objects.clone(),
        boundaries: workspace.boundaries.clone(),
        beacons: workspace.beacons.clone(),
        snippets: workspace.snippets.clone(),
        camera_state: workspace.camera_state.clone(),
        settings: workspace.settings.clone(),
    };

    manager.current_workspace = Some(workspace);
    manager.database = Some(database);

    Ok(exported)
}

/// Export workspace to a portable format
#[tauri::command]
pub async fn export_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
    export_path: String,
) -> Result<(), String> {
    let manager = state.lock().await;

    let workspace = manager.current_workspace.as_ref()
        .ok_or("No workspace is currently open")?;

    let exported = ExportedWorkspace {
        metadata: workspace.metadata.clone(),
        objects: workspace.objects.clone(),
        boundaries: workspace.boundaries.clone(),
        beacons: workspace.beacons.clone(),
        snippets: workspace.snippets.clone(),
        camera_state: workspace.camera_state.clone(),
        settings: workspace.settings.clone(),
    };

    let json = serde_json::to_string_pretty(&exported)
        .map_err(|e| format!("Failed to serialize workspace: {}", e))?;

    std::fs::write(&export_path, json)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

/// Get current workspace metadata
#[tauri::command]
pub async fn get_current_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
) -> Result<Option<WorkspaceMetadata>, String> {
    let manager = state.lock().await;
    Ok(manager.current_workspace.as_ref().map(|w| w.metadata.clone()))
}

/// Close the current workspace
#[tauri::command]
pub async fn close_workspace(
    state: State<'_, Mutex<WorkspaceManager>>,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    manager.current_workspace = None;
    manager.database = None;
    Ok(())
}
