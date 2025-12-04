/**
 * Sandbox service for code execution
 * 
 * Provides frontend interface to the Rust sandbox backend
 */

import { invoke } from '@tauri-apps/api/core';

/** Supported sandbox languages */
export type SandboxLanguage = 'python' | 'javascript' | 'shell';

/** Execution status */
export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

/** Sandbox permissions */
export interface SandboxPermissions {
  readFiles: boolean;
  writeFiles: boolean;
  networkAccess: boolean;
  maxExecutionMs: number;
  maxMemoryMb: number;
}

/** Default permissions for sandbox execution */
export const DEFAULT_PERMISSIONS: SandboxPermissions = {
  readFiles: true,
  writeFiles: false,
  networkAccess: false,
  maxExecutionMs: 30000,
  maxMemoryMb: 256,
};

/** Execution result from the sandbox */
export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionMs: number;
}

/** Runtime information */
export interface RuntimeInfo {
  language: string;
  version: string;
  available: boolean;
  path: string | null;
}

/**
 * Execute code in the sandbox
 */
export async function executeCode(
  code: string,
  language: SandboxLanguage,
  options?: {
    permissions?: Partial<SandboxPermissions>;
    workingDir?: string;
  }
): Promise<ExecutionResult> {
  const permissions = options?.permissions
    ? { ...DEFAULT_PERMISSIONS, ...options.permissions }
    : DEFAULT_PERMISSIONS;

  return invoke<ExecutionResult>('execute_code', {
    code,
    language,
    permissions,
    workingDir: options?.workingDir ?? null,
  });
}

/**
 * Cancel an active execution
 */
export async function cancelExecution(executionId: string): Promise<void> {
  return invoke('cancel_execution', { executionId });
}

/**
 * List available runtimes
 */
export async function listAvailableRuntimes(): Promise<RuntimeInfo[]> {
  return invoke<RuntimeInfo[]>('list_available_runtimes');
}

/**
 * Check if a specific runtime is available
 */
export async function isRuntimeAvailable(language: SandboxLanguage): Promise<boolean> {
  const runtimes = await listAvailableRuntimes();
  const runtime = runtimes.find(r => r.language === language);
  return runtime?.available ?? false;
}

/**
 * Get runtime info for a specific language
 */
export async function getRuntimeInfo(language: SandboxLanguage): Promise<RuntimeInfo | null> {
  const runtimes = await listAvailableRuntimes();
  return runtimes.find(r => r.language === language) ?? null;
}
