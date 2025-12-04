//! System commands - capabilities check and system information

use serde::{Deserialize, Serialize};
use tauri::command;
use std::env;
use std::path::PathBuf;
use std::process::Command;

/// System information returned by get_system_info
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    /// Operating system name
    pub os: String,
    /// Operating system version
    pub os_version: String,
    /// CPU architecture
    pub arch: String,
    /// Number of CPU cores
    pub cpu_count: usize,
    /// Total system memory in bytes (if available)
    pub total_memory: Option<u64>,
    /// User's home directory
    pub home_dir: Option<String>,
    /// Current working directory
    pub current_dir: Option<String>,
    /// Tauri version
    pub tauri_version: String,
    /// Available runtimes for sandbox
    pub available_runtimes: Vec<RuntimeCapability>,
}

/// Runtime capability information
#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimeCapability {
    /// Runtime name (python, node, deno, shell)
    pub name: String,
    /// Whether the runtime is available
    pub available: bool,
    /// Version string if available
    pub version: Option<String>,
    /// Path to the executable
    pub path: Option<String>,
}

/// Check if a command is available and get its version
fn check_runtime(command: &str, version_args: &[&str]) -> RuntimeCapability {
    let result = Command::new(command)
        .args(version_args)
        .output();
    
    match result {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .to_string();
            
            // Try to get the path
            let path = which_command(command);
            
            RuntimeCapability {
                name: command.to_string(),
                available: true,
                version: Some(version.trim().to_string()),
                path,
            }
        }
        _ => RuntimeCapability {
            name: command.to_string(),
            available: false,
            version: None,
            path: None,
        },
    }
}

/// Get the path to a command using 'which' (Unix) or 'where' (Windows)
fn which_command(command: &str) -> Option<String> {
    #[cfg(unix)]
    let result = Command::new("which").arg(command).output();
    
    #[cfg(windows)]
    let result = Command::new("where").arg(command).output();
    
    match result {
        Ok(output) if output.status.success() => {
            Some(
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string(),
            )
        }
        _ => None,
    }
}

/// Get total system memory (platform-specific)
fn get_total_memory() -> Option<u64> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
            for line in content.lines() {
                if line.starts_with("MemTotal:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        if let Ok(kb) = parts[1].parse::<u64>() {
                            return Some(kb * 1024);
                        }
                    }
                }
            }
        }
        None
    }
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()?;
        
        if output.status.success() {
            let mem_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            mem_str.parse().ok()
        } else {
            None
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows memory detection would require winapi
        None
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

/// Get system information and available capabilities
#[command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    // Check available runtimes
    let runtimes = vec![
        check_runtime("python3", &["--version"]),
        check_runtime("python", &["--version"]),
        check_runtime("node", &["--version"]),
        check_runtime("deno", &["--version"]),
        check_runtime("bash", &["--version"]),
        check_runtime("sh", &["--version"]),
    ];
    
    // Filter to unique available runtimes
    let mut available_runtimes: Vec<RuntimeCapability> = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    
    for runtime in runtimes {
        // Normalize python3/python to "python"
        let normalized_name = if runtime.name == "python3" || runtime.name == "python" {
            "python".to_string()
        } else if runtime.name == "sh" {
            "shell".to_string()
        } else if runtime.name == "bash" {
            "shell".to_string()
        } else {
            runtime.name.clone()
        };
        
        if runtime.available && !seen_names.contains(&normalized_name) {
            seen_names.insert(normalized_name.clone());
            available_runtimes.push(RuntimeCapability {
                name: normalized_name,
                available: runtime.available,
                version: runtime.version,
                path: runtime.path,
            });
        }
    }
    
    Ok(SystemInfo {
        os: env::consts::OS.to_string(),
        os_version: get_os_version(),
        arch: env::consts::ARCH.to_string(),
        cpu_count: std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(1),
        total_memory: get_total_memory(),
        home_dir: dirs::home_dir().map(|p| p.to_string_lossy().to_string()),
        current_dir: env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
        tauri_version: "2.0".to_string(),
        available_runtimes,
    })
}

/// Get OS version string
fn get_os_version() -> String {
    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
            for line in content.lines() {
                if line.starts_with("PRETTY_NAME=") {
                    return line
                        .trim_start_matches("PRETTY_NAME=")
                        .trim_matches('"')
                        .to_string();
                }
            }
        }
        "Linux".to_string()
    }
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("sw_vers")
            .args(["-productVersion"])
            .output();
        
        match output {
            Ok(out) if out.status.success() => {
                format!("macOS {}", String::from_utf8_lossy(&out.stdout).trim())
            }
            _ => "macOS".to_string(),
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        "Windows".to_string()
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        "Unknown".to_string()
    }
}

/// Check if a specific capability is available
#[command]
pub async fn check_capability(capability: String) -> Result<bool, String> {
    match capability.as_str() {
        "python" => Ok(check_runtime("python3", &["--version"]).available
            || check_runtime("python", &["--version"]).available),
        "node" | "javascript" => Ok(check_runtime("node", &["--version"]).available),
        "deno" => Ok(check_runtime("deno", &["--version"]).available),
        "shell" | "bash" => Ok(check_runtime("bash", &["--version"]).available
            || check_runtime("sh", &["--version"]).available),
        _ => Err(format!("Unknown capability: {}", capability)),
    }
}

/// Get the data directory for DAX
#[command]
pub async fn get_data_directory() -> Result<String, String> {
    let data_dir = dirs::data_dir()
        .map(|p| p.join("dax"))
        .unwrap_or_else(|| PathBuf::from(".dax"));
    
    // Ensure directory exists
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    
    Ok(data_dir.to_string_lossy().to_string())
}
