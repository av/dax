use serde::{Deserialize, Serialize};

use super::Vector3;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CameraState {
    pub position: Vector3,
    pub target: Vector3,
    pub zoom: f32,
    pub rotation: Vector3,
}

impl Default for CameraState {
    fn default() -> Self {
        Self {
            position: Vector3::new(0.0, 50.0, 50.0),
            target: Vector3::zero(),
            zoom: 1.0,
            rotation: Vector3::new(-std::f32::consts::FRAC_PI_4, 0.0, 0.0),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub grid_visible: bool,
    pub grid_size: u32,
    pub physics_enabled: bool,
    pub auto_save_enabled: bool,
    pub auto_save_interval_ms: u64,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            grid_visible: true,
            grid_size: 100,
            physics_enabled: true,
            auto_save_enabled: true,
            auto_save_interval_ms: 30000,
        }
    }
}

/// Workspace metadata for identification and management
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Full workspace including all objects and state
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub metadata: WorkspaceMetadata,
    pub objects: Vec<serde_json::Value>,
    pub boundaries: Vec<serde_json::Value>,
    pub beacons: Vec<serde_json::Value>,
    pub snippets: Vec<serde_json::Value>,
    pub camera_state: Option<serde_json::Value>,
    pub settings: Option<serde_json::Value>,
}

impl Workspace {
    pub fn new(id: String, name: String, path: String) -> Self {
        let now = chrono::Utc::now().timestamp_millis();

        Self {
            metadata: WorkspaceMetadata {
                id,
                name,
                path,
                created_at: now,
                updated_at: now,
            },
            objects: Vec::new(),
            boundaries: Vec::new(),
            beacons: Vec::new(),
            snippets: Vec::new(),
            camera_state: None,
            settings: None,
        }
    }
}

/// Legacy workspace format for backwards compatibility
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LegacyWorkspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub camera: CameraState,
    pub settings: WorkspaceSettings,
    pub object_ids: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub last_opened_at: u64,
}

impl LegacyWorkspace {
    pub fn new(id: String, name: String, path: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id,
            name,
            path,
            camera: CameraState::default(),
            settings: WorkspaceSettings::default(),
            object_ids: Vec::new(),
            created_at: now,
            updated_at: now,
            last_opened_at: now,
        }
    }
}
