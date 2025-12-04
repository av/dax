/**
 * Settings Service
 * Frontend service for interacting with settings Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  AppSettingsResponse,
  TestConnectionResult,
  ValidationResult,
} from '@/types/settings';

/**
 * Retrieves all application settings from the backend.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const response = await invoke<AppSettingsResponse>('get_app_settings');
  return {
    apiUrl: response.apiUrl,
    hasApiKey: response.hasApiKey,
    startOnStartup: response.startOnStartup,
  };
}

/**
 * Saves non-sensitive application settings.
 * Note: API key is saved separately via setApiKey.
 */
export async function saveAppSettings(
  apiUrl: string,
  startOnStartup: boolean
): Promise<void> {
  await invoke('save_app_settings', { apiUrl, startOnStartup });
}

/**
 * Stores an API key in the OS keychain.
 */
export async function setApiKey(key: string): Promise<void> {
  await invoke('set_api_key', { key });
}

/**
 * Checks if an API key exists in the keychain.
 */
export async function hasApiKey(): Promise<boolean> {
  return invoke<boolean>('has_api_key');
}

/**
 * Removes the API key from the OS keychain.
 */
export async function deleteApiKey(): Promise<void> {
  await invoke('delete_api_key');
}

/**
 * Tests connectivity to the configured API endpoint.
 * @param apiUrl The API URL to test
 * @param apiKey Optional API key to use for testing (if not yet saved to keychain)
 */
export async function testApiConnection(apiUrl: string, apiKey?: string): Promise<TestConnectionResult> {
  return invoke<TestConnectionResult>('test_api_connection', { apiUrl, apiKey: apiKey || null });
}

/**
 * Validates an API URL.
 * URL must be valid HTTP(S) and end with /v1.
 */
export function validateApiUrl(url: string): ValidationResult {
  if (!url) {
    return { valid: true }; // Empty is allowed (clears setting)
  }

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }

    if (!parsed.pathname.endsWith('/v1')) {
      return { valid: false, error: 'URL must end with /v1' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates an API key.
 */
export function validateApiKey(key: string): ValidationResult {
  if (!key) {
    return { valid: true }; // Empty is allowed (no change)
  }

  if (key.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty whitespace' };
  }

  return { valid: true };
}
