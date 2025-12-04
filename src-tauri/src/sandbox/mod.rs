//! Sandbox module for isolated code execution
//! 
//! Provides secure execution of Python and JavaScript code using subprocess isolation
//! with resource limits and permission controls.

pub mod runtime;
pub mod security;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Supported sandbox languages
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SandboxLanguage {
    Python,
    JavaScript,
    Shell,
}

impl std::fmt::Display for SandboxLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SandboxLanguage::Python => write!(f, "python"),
            SandboxLanguage::JavaScript => write!(f, "javascript"),
            SandboxLanguage::Shell => write!(f, "shell"),
        }
    }
}

/// Execution status
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Timeout,
    Cancelled,
}

/// Sandbox execution permissions
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxPermissions {
    pub read_files: bool,
    pub write_files: bool,
    pub network_access: bool,
    pub max_execution_ms: u64,
    pub max_memory_mb: u64,
}

impl Default for SandboxPermissions {
    fn default() -> Self {
        Self {
            read_files: true,
            write_files: false,
            network_access: false,
            max_execution_ms: 30000, // 30 seconds
            max_memory_mb: 256,
        }
    }
}

/// Sandbox execution request
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRequest {
    pub code: String,
    pub language: SandboxLanguage,
    pub permissions: SandboxPermissions,
    pub working_dir: Option<PathBuf>,
}

/// Sandbox execution result
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub id: String,
    pub status: ExecutionStatus,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub execution_ms: u64,
}

/// Information about an available runtime
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub language: String,
    pub version: String,
    pub available: bool,
    pub path: Option<String>,
}
