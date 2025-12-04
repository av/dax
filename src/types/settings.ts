/**
 * Settings Types
 * Type definitions for application-level settings
 */

/**
 * Application settings stored in Zustand.
 * The API key itself is never stored here—only a flag indicating whether one exists.
 */
export interface AppSettings {
  /** OpenAI-compatible API base URL (must end with /v1) */
  apiUrl: string;
  /** Whether an API key is stored in the OS keychain (read-only, derived from backend) */
  hasApiKey: boolean;
  /** Whether app launches on system boot */
  startOnStartup: boolean;
}

/**
 * Response from get_app_settings Tauri command
 */
export interface AppSettingsResponse {
  apiUrl: string;
  hasApiKey: boolean;
  startOnStartup: boolean;
}

/**
 * Request for save_app_settings Tauri command
 */
export interface SaveAppSettingsRequest {
  apiUrl: string;
  startOnStartup: boolean;
}

/**
 * Result of testing API connection
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/**
 * Validation result for settings fields
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Settings store state
 */
export interface SettingsState {
  /** Current settings values */
  apiUrl: string;
  hasApiKey: boolean;
  startOnStartup: boolean;
  
  /** Loading/error states */
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  /** Dirty tracking */
  isDirty: boolean;
  
  /** API key input (temporary, for form state - never persisted) */
  pendingApiKey: string;
  showApiKey: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: '',
  hasApiKey: false,
  startOnStartup: false,
};
