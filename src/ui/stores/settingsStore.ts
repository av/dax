/**
 * Settings Store
 * Zustand store for application-level settings
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SettingsState } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import {
  getAppSettings,
  saveAppSettings,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  testApiConnection,
  validateApiUrl,
} from '@/services/settings';

export interface SettingsActions {
  /** Load settings from backend */
  loadSettings: () => Promise<void>;
  
  /** Update a setting value (marks as dirty) */
  setApiUrl: (url: string) => void;
  setStartOnStartup: (enabled: boolean) => void;
  setPendingApiKey: (key: string) => void;
  
  /** Toggle API key visibility */
  toggleShowApiKey: () => void;
  
  /** Save all settings to backend */
  saveSettings: () => Promise<void>;
  
  /** Clear the pending API key from OS keychain */
  clearApiKey: () => Promise<void>;
  
  /** Test the API connection */
  testConnection: () => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  
  /** Reset dirty state (e.g., after discarding changes) */
  resetDirty: () => void;
  
  /** Clear any error */
  clearError: () => void;
  
  /** Check if there are unsaved changes */
  hasUnsavedChanges: () => boolean;
}

export type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    apiUrl: DEFAULT_SETTINGS.apiUrl,
    hasApiKey: DEFAULT_SETTINGS.hasApiKey,
    startOnStartup: DEFAULT_SETTINGS.startOnStartup,
    isLoading: false,
    isSaving: false,
    error: null,
    isDirty: false,
    pendingApiKey: '',
    showApiKey: false,
    
    // Original values for dirty checking
    _originalApiUrl: '',
    _originalStartOnStartup: false,
    
    loadSettings: async () => {
      set({ isLoading: true, error: null });
      
      try {
        const settings = await getAppSettings();
        set({
          apiUrl: settings.apiUrl,
          hasApiKey: settings.hasApiKey,
          startOnStartup: settings.startOnStartup,
          isLoading: false,
          isDirty: false,
          pendingApiKey: '',
          // Store original values for dirty tracking
          _originalApiUrl: settings.apiUrl,
          _originalStartOnStartup: settings.startOnStartup,
        } as Partial<SettingsStore>);
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load settings',
        });
      }
    },
    
    setApiUrl: (url) => {
      set((state) => ({
        apiUrl: url,
        isDirty: url !== (state as SettingsStore & { _originalApiUrl: string })._originalApiUrl ||
                 state.startOnStartup !== (state as SettingsStore & { _originalStartOnStartup: boolean })._originalStartOnStartup ||
                 state.pendingApiKey.length > 0,
      }));
    },
    
    setStartOnStartup: (enabled) => {
      set((state) => ({
        startOnStartup: enabled,
        isDirty: state.apiUrl !== (state as SettingsStore & { _originalApiUrl: string })._originalApiUrl ||
                 enabled !== (state as SettingsStore & { _originalStartOnStartup: boolean })._originalStartOnStartup ||
                 state.pendingApiKey.length > 0,
      }));
    },
    
    setPendingApiKey: (key) => {
      set((state) => ({
        pendingApiKey: key,
        isDirty: state.apiUrl !== (state as SettingsStore & { _originalApiUrl: string })._originalApiUrl ||
                 state.startOnStartup !== (state as SettingsStore & { _originalStartOnStartup: boolean })._originalStartOnStartup ||
                 key.length > 0,
      }));
    },
    
    toggleShowApiKey: () => {
      set((state) => ({ showApiKey: !state.showApiKey }));
    },
    
    saveSettings: async () => {
      const state = get();
      
      // Validate API URL
      const urlValidation = validateApiUrl(state.apiUrl);
      if (!urlValidation.valid) {
        set({ error: urlValidation.error ?? 'Invalid API URL' });
        return;
      }
      
      set({ isSaving: true, error: null });
      
      try {
        // Save app settings
        await saveAppSettings(state.apiUrl, state.startOnStartup);
        
        // Save API key if pending
        if (state.pendingApiKey) {
          await setApiKey(state.pendingApiKey);
        }
        
        // Check if API key exists after save
        const keyExists = await hasApiKey();
        
        set({
          isSaving: false,
          isDirty: false,
          hasApiKey: keyExists,
          pendingApiKey: '',
          showApiKey: false,
          _originalApiUrl: state.apiUrl,
          _originalStartOnStartup: state.startOnStartup,
        } as Partial<SettingsStore>);
      } catch (error) {
        set({
          isSaving: false,
          error: error instanceof Error ? error.message : 'Failed to save settings',
        });
      }
    },
    
    clearApiKey: async () => {
      set({ isSaving: true, error: null });
      
      try {
        await deleteApiKey();
        set({
          isSaving: false,
          hasApiKey: false,
          pendingApiKey: '',
          showApiKey: false,
        });
      } catch (error) {
        set({
          isSaving: false,
          error: error instanceof Error ? error.message : 'Failed to clear API key',
        });
      }
    },
    
    testConnection: async () => {
      const state = get();
      
      // Validate URL first
      const urlValidation = validateApiUrl(state.apiUrl);
      if (!urlValidation.valid) {
        return {
          success: false,
          message: urlValidation.error ?? 'Invalid API URL',
        };
      }
      
      if (!state.apiUrl) {
        return {
          success: false,
          message: 'API URL is required',
        };
      }
      
      // Use pending key if available, otherwise backend will use stored key
      const keyToTest = state.pendingApiKey || undefined;
      
      try {
        const result = await testApiConnection(state.apiUrl, keyToTest);
        return result;
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
        };
      }
    },
    
    resetDirty: () => {
      const state = get();
      set({
        apiUrl: (state as SettingsStore & { _originalApiUrl: string })._originalApiUrl,
        startOnStartup: (state as SettingsStore & { _originalStartOnStartup: boolean })._originalStartOnStartup,
        pendingApiKey: '',
        isDirty: false,
        showApiKey: false,
        error: null,
      });
    },
    
    clearError: () => {
      set({ error: null });
    },
    
    hasUnsavedChanges: () => {
      return get().isDirty;
    },
  }))
);
