//! Runtime execution module
//!
//! Handles actual execution of code in isolated subprocesses

use super::{ExecutionRequest, ExecutionResult, ExecutionStatus, SandboxLanguage, RuntimeInfo};
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Active execution tracking
pub struct ActiveExecution {
    pub id: String,
    pub start_time: Instant,
    pub cancelled: bool,
}

/// Runtime executor
pub struct Runtime {
    active_executions: Arc<Mutex<HashMap<String, ActiveExecution>>>,
}

impl Runtime {
    pub fn new() -> Self {
        Self {
            active_executions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Execute code in the appropriate runtime
    pub async fn execute(&self, request: ExecutionRequest) -> Result<ExecutionResult, String> {
        let id = Uuid::new_v4().to_string();
        let start_time = Instant::now();

        // Register execution
        {
            let mut executions = self.active_executions.lock().await;
            executions.insert(id.clone(), ActiveExecution {
                id: id.clone(),
                start_time,
                cancelled: false,
            });
        }

        // Execute based on language
        let result = match request.language {
            SandboxLanguage::Python => self.execute_python(&id, &request).await,
            SandboxLanguage::JavaScript => self.execute_javascript(&id, &request).await,
            SandboxLanguage::Shell => self.execute_shell(&id, &request).await,
        };

        // Unregister execution
        {
            let mut executions = self.active_executions.lock().await;
            executions.remove(&id);
        }

        let execution_ms = start_time.elapsed().as_millis() as u64;

        match result {
            Ok((stdout, stderr, exit_code, status)) => Ok(ExecutionResult {
                id,
                status,
                stdout,
                stderr,
                exit_code,
                execution_ms,
            }),
            Err(e) => Ok(ExecutionResult {
                id,
                status: ExecutionStatus::Failed,
                stdout: String::new(),
                stderr: e,
                exit_code: None,
                execution_ms,
            }),
        }
    }

    /// Cancel an active execution
    pub async fn cancel(&self, execution_id: &str) -> Result<(), String> {
        let mut executions = self.active_executions.lock().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.cancelled = true;
            Ok(())
        } else {
            Err(format!("Execution {} not found", execution_id))
        }
    }

    /// Execute Python code
    async fn execute_python(
        &self,
        id: &str,
        request: &ExecutionRequest,
    ) -> Result<(String, String, Option<i32>, ExecutionStatus), String> {
        let python_path = self.find_python()?;
        
        // Create temp file for code
        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join(format!("dax_sandbox_{}.py", id));
        
        // Write code to temp file
        let mut file = std::fs::File::create(&script_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        file.write_all(request.code.as_bytes())
            .map_err(|e| format!("Failed to write code: {}", e))?;
        
        // Build command
        let mut cmd = Command::new(&python_path);
        cmd.arg("-u"); // Unbuffered output
        cmd.arg(&script_path);
        
        // Set working directory
        if let Some(ref working_dir) = request.working_dir {
            cmd.current_dir(working_dir);
        }
        
        // Set up isolated environment
        cmd.env_clear();
        cmd.env("PATH", std::env::var("PATH").unwrap_or_default());
        cmd.env("PYTHONIOENCODING", "utf-8");
        cmd.env("PYTHONDONTWRITEBYTECODE", "1");
        
        // Execute with timeout
        let result = self.run_with_timeout(
            cmd,
            Duration::from_millis(request.permissions.max_execution_ms),
        ).await;
        
        // Clean up temp file
        let _ = std::fs::remove_file(&script_path);
        
        result
    }

    /// Execute JavaScript code (using Node.js or Deno)
    async fn execute_javascript(
        &self,
        id: &str,
        request: &ExecutionRequest,
    ) -> Result<(String, String, Option<i32>, ExecutionStatus), String> {
        // Try Deno first (better sandboxing), then Node.js
        let (runtime_path, use_deno) = self.find_javascript_runtime()?;
        
        // Create temp file for code
        let temp_dir = std::env::temp_dir();
        let ext = if use_deno { "ts" } else { "js" };
        let script_path = temp_dir.join(format!("dax_sandbox_{}.{}", id, ext));
        
        // Write code to temp file
        let mut file = std::fs::File::create(&script_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        file.write_all(request.code.as_bytes())
            .map_err(|e| format!("Failed to write code: {}", e))?;
        
        // Build command
        let mut cmd = Command::new(&runtime_path);
        
        if use_deno {
            cmd.arg("run");
            // Apply permissions
            if !request.permissions.network_access {
                // Deno denies network by default
            }
            if request.permissions.read_files {
                cmd.arg("--allow-read");
            }
            if request.permissions.write_files {
                cmd.arg("--allow-write");
            }
        }
        
        cmd.arg(&script_path);
        
        // Set working directory
        if let Some(ref working_dir) = request.working_dir {
            cmd.current_dir(working_dir);
        }
        
        // Execute with timeout
        let result = self.run_with_timeout(
            cmd,
            Duration::from_millis(request.permissions.max_execution_ms),
        ).await;
        
        // Clean up temp file
        let _ = std::fs::remove_file(&script_path);
        
        result
    }

    /// Execute shell commands
    async fn execute_shell(
        &self,
        _id: &str,
        request: &ExecutionRequest,
    ) -> Result<(String, String, Option<i32>, ExecutionStatus), String> {
        #[cfg(unix)]
        let shell = "sh";
        #[cfg(windows)]
        let shell = "cmd";
        
        let mut cmd = Command::new(shell);
        
        #[cfg(unix)]
        cmd.arg("-c").arg(&request.code);
        #[cfg(windows)]
        cmd.arg("/C").arg(&request.code);
        
        // Set working directory
        if let Some(ref working_dir) = request.working_dir {
            cmd.current_dir(working_dir);
        }
        
        // Execute with timeout
        self.run_with_timeout(
            cmd,
            Duration::from_millis(request.permissions.max_execution_ms),
        ).await
    }

    /// Run a command with timeout
    async fn run_with_timeout(
        &self,
        mut cmd: Command,
        timeout: Duration,
    ) -> Result<(String, String, Option<i32>, ExecutionStatus), String> {
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        
        let child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;
        
        // Wait with timeout using tokio
        let result = tokio::time::timeout(
            timeout,
            tokio::task::spawn_blocking(move || {
                child.wait_with_output()
            }),
        ).await;
        
        match result {
            Ok(Ok(Ok(output))) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code();
                let status = if output.status.success() {
                    ExecutionStatus::Completed
                } else {
                    ExecutionStatus::Failed
                };
                Ok((stdout, stderr, exit_code, status))
            }
            Ok(Ok(Err(e))) => Err(format!("Process error: {}", e)),
            Ok(Err(e)) => Err(format!("Task join error: {}", e)),
            Err(_) => {
                // Timeout occurred
                Ok((
                    String::new(),
                    "Execution timed out".to_string(),
                    None,
                    ExecutionStatus::Timeout,
                ))
            }
        }
    }

    /// Find Python interpreter
    fn find_python(&self) -> Result<PathBuf, String> {
        // Try python3 first, then python
        for cmd in &["python3", "python"] {
            if let Ok(output) = Command::new(cmd).arg("--version").output() {
                if output.status.success() {
                    return Ok(PathBuf::from(cmd));
                }
            }
        }
        Err("Python not found. Please install Python 3.".to_string())
    }

    /// Find JavaScript runtime (Deno preferred, Node.js fallback)
    fn find_javascript_runtime(&self) -> Result<(PathBuf, bool), String> {
        // Try Deno first (better sandboxing)
        if let Ok(output) = Command::new("deno").arg("--version").output() {
            if output.status.success() {
                return Ok((PathBuf::from("deno"), true));
            }
        }
        
        // Fallback to Node.js
        if let Ok(output) = Command::new("node").arg("--version").output() {
            if output.status.success() {
                return Ok((PathBuf::from("node"), false));
            }
        }
        
        Err("No JavaScript runtime found. Please install Deno or Node.js.".to_string())
    }

    /// List available runtimes
    pub fn list_available_runtimes(&self) -> Vec<RuntimeInfo> {
        let mut runtimes = Vec::new();
        
        // Check Python
        if let Ok(output) = Command::new("python3").arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                runtimes.push(RuntimeInfo {
                    language: "python".to_string(),
                    version: version.replace("Python ", ""),
                    available: true,
                    path: Some("python3".to_string()),
                });
            }
        } else {
            runtimes.push(RuntimeInfo {
                language: "python".to_string(),
                version: String::new(),
                available: false,
                path: None,
            });
        }
        
        // Check Deno
        if let Ok(output) = Command::new("deno").arg("--version").output() {
            if output.status.success() {
                let version_str = String::from_utf8_lossy(&output.stdout);
                let version = version_str.lines().next()
                    .map(|s| s.replace("deno ", ""))
                    .unwrap_or_default();
                runtimes.push(RuntimeInfo {
                    language: "javascript".to_string(),
                    version: format!("Deno {}", version),
                    available: true,
                    path: Some("deno".to_string()),
                });
            }
        } else if let Ok(output) = Command::new("node").arg("--version").output() {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                runtimes.push(RuntimeInfo {
                    language: "javascript".to_string(),
                    version: format!("Node.js {}", version),
                    available: true,
                    path: Some("node".to_string()),
                });
            }
        } else {
            runtimes.push(RuntimeInfo {
                language: "javascript".to_string(),
                version: String::new(),
                available: false,
                path: None,
            });
        }
        
        // Shell is always available
        #[cfg(unix)]
        let shell_info = RuntimeInfo {
            language: "shell".to_string(),
            version: "sh".to_string(),
            available: true,
            path: Some("/bin/sh".to_string()),
        };
        #[cfg(windows)]
        let shell_info = RuntimeInfo {
            language: "shell".to_string(),
            version: "cmd".to_string(),
            available: true,
            path: Some("cmd.exe".to_string()),
        };
        runtimes.push(shell_info);
        
        runtimes
    }
}

impl Default for Runtime {
    fn default() -> Self {
        Self::new()
    }
}
