//! Security module for sandbox execution
//!
//! Validates permissions, sanitizes code, and enforces security policies

use super::SandboxPermissions;
use std::path::Path;

/// Security validator for sandbox executions
pub struct SecurityValidator;

impl SecurityValidator {
    /// Validate execution request permissions
    pub fn validate_permissions(permissions: &SandboxPermissions) -> Result<(), String> {
        // Maximum execution time: 5 minutes
        if permissions.max_execution_ms > 300_000 {
            return Err("Maximum execution time cannot exceed 5 minutes".to_string());
        }
        
        // Maximum memory: 1GB
        if permissions.max_memory_mb > 1024 {
            return Err("Maximum memory cannot exceed 1GB".to_string());
        }
        
        Ok(())
    }
    
    /// Check if a path is allowed for file operations
    pub fn validate_path(path: &Path, _permissions: &SandboxPermissions) -> Result<(), String> {
        // Block access to sensitive directories
        let blocked_patterns = [
            "/etc/",
            "/var/",
            "/usr/",
            "/bin/",
            "/sbin/",
            "/root/",
            "/.ssh/",
            "/.gnupg/",
            "/Windows/",
            "/System32/",
        ];
        
        let path_str = path.to_string_lossy().to_lowercase();
        
        for pattern in blocked_patterns {
            if path_str.contains(&pattern.to_lowercase()) {
                return Err(format!("Access to {} is not allowed", pattern));
            }
        }
        
        Ok(())
    }
    
    /// Validate code for obvious security issues
    pub fn validate_code(code: &str, language: &str) -> Result<(), String> {
        // Block obvious dangerous patterns
        let dangerous_patterns = [
            "os.system",
            "subprocess.call",
            "subprocess.run",
            "subprocess.Popen",
            "__import__",
            "eval(",
            "exec(",
            "compile(",
            "child_process",
            "require('child_process')",
            "require(\"child_process\")",
            "Deno.run",
            "rm -rf",
            "del /f /s /q",
            "format c:",
            ":(){ :|:& };:",  // Fork bomb
        ];
        
        let code_lower = code.to_lowercase();
        
        for pattern in dangerous_patterns {
            if code_lower.contains(&pattern.to_lowercase()) {
                return Err(format!(
                    "Potentially dangerous code pattern detected: {}",
                    pattern
                ));
            }
        }
        
        // Language-specific validation
        match language {
            "python" => Self::validate_python_code(code)?,
            "javascript" => Self::validate_javascript_code(code)?,
            "shell" => Self::validate_shell_code(code)?,
            _ => {}
        }
        
        Ok(())
    }
    
    /// Validate Python-specific patterns
    fn validate_python_code(code: &str) -> Result<(), String> {
        // Block import of dangerous modules
        let dangerous_imports = [
            "import os",
            "from os import",
            "import subprocess",
            "from subprocess import",
            "import shutil",
            "from shutil import",
            "import socket",
            "from socket import",
            "import ctypes",
            "from ctypes import",
        ];
        
        for pattern in dangerous_imports {
            if code.contains(pattern) {
                return Err(format!(
                    "Import of restricted module not allowed: {}",
                    pattern
                ));
            }
        }
        
        Ok(())
    }
    
    /// Validate JavaScript-specific patterns
    fn validate_javascript_code(code: &str) -> Result<(), String> {
        let dangerous_patterns = [
            "process.exit",
            "require('fs')",
            "require(\"fs\")",
            "require('net')",
            "require(\"net\")",
            "require('http')",
            "require(\"http\")",
        ];
        
        for pattern in dangerous_patterns {
            if code.contains(pattern) {
                return Err(format!(
                    "Restricted Node.js pattern not allowed: {}",
                    pattern
                ));
            }
        }
        
        Ok(())
    }
    
    /// Validate shell-specific patterns
    fn validate_shell_code(code: &str) -> Result<(), String> {
        let dangerous_patterns = [
            "sudo ",
            "su ",
            "> /dev/",
            "| sh",
            "| bash",
            "curl | ",
            "wget | ",
            "chmod 777",
            "chown root",
        ];
        
        let code_lower = code.to_lowercase();
        
        for pattern in dangerous_patterns {
            if code_lower.contains(&pattern.to_lowercase()) {
                return Err(format!(
                    "Restricted shell pattern not allowed: {}",
                    pattern
                ));
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_permissions() {
        let valid = SandboxPermissions::default();
        assert!(SecurityValidator::validate_permissions(&valid).is_ok());
        
        let too_long = SandboxPermissions {
            max_execution_ms: 600_000,
            ..Default::default()
        };
        assert!(SecurityValidator::validate_permissions(&too_long).is_err());
    }

    #[test]
    fn test_validate_dangerous_code() {
        assert!(SecurityValidator::validate_code("import os", "python").is_err());
        assert!(SecurityValidator::validate_code("print('hello')", "python").is_ok());
        assert!(SecurityValidator::validate_code("rm -rf /", "shell").is_err());
        assert!(SecurityValidator::validate_code("echo hello", "shell").is_ok());
    }
}
