import { create } from 'zustand';
import type { AppSettings, LLMConfig } from '@/types';

const defaultLLMConfig: LLMConfig = {
  apiEndpoint: '',
  apiKey: '',
  modelName: '',
  temperature: 0.7,
  maxTokens: 4096,
  systemPromptOverride: null,
};

const defaultSettings: AppSettings = {
  llm: defaultLLMConfig,
  theme: 'dark',
  cameraSpeed: 1.0,
  lastOpenedFolder: null,
};

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  isSettingsOpen: boolean;
  isTestingConnection: boolean;
  connectionTestResult: 'success' | 'error' | null;
  connectionTestError: string | null;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateLLMConfig: (partial: Partial<LLMConfig>) => void;
  testConnection: () => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,
  isSettingsOpen: false,
  isTestingConnection: false,
  connectionTestResult: null,
  connectionTestError: null,

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      set({ settings, isLoaded: true });
    } catch {
      set({ settings: defaultSettings, isLoaded: true });
    }
  },

  saveSettings: async (settings: AppSettings) => {
    set({ settings });
    await window.electronAPI.saveSettings(settings);
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const merged = { ...get().settings, ...partial };
    set({ settings: merged });
    await window.electronAPI.saveSettings(merged);
  },

  updateLLMConfig: (partial: Partial<LLMConfig>) => {
    const settings = get().settings;
    const llm = { ...settings.llm, ...partial };
    set({ settings: { ...settings, llm } });
  },

  testConnection: async () => {
    set({ isTestingConnection: true, connectionTestResult: null, connectionTestError: null });
    try {
      const { llm } = get().settings;
      await window.electronAPI.testLLMConnection(llm);
      set({ isTestingConnection: false, connectionTestResult: 'success', connectionTestError: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ isTestingConnection: false, connectionTestResult: 'error', connectionTestError: message });
    }
  },

  openSettings: () => {
    set({ isSettingsOpen: true, connectionTestResult: null, connectionTestError: null });
  },

  closeSettings: () => {
    set({ isSettingsOpen: false, connectionTestResult: null, connectionTestError: null });
  },
}));
