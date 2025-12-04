pub mod file_object;
pub mod workspace;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vector3 {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self::default()
    }

    pub fn one() -> Self {
        Self::new(1.0, 1.0, 1.0)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DataObjectType {
    File,
    Snippet,
    Boundary,
    Beacon,
}

pub use file_object::{FileCategory, FileObject};
pub use workspace::{CameraState, Workspace, WorkspaceSettings};
