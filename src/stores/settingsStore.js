import { create } from 'zustand';
const defaultLLMConfig = {
    apiEndpoint: '',
    apiKey: '',
    modelName: '',
    temperature: 0.7,
    maxTokens: 4096,
    systemPromptOverride: null,
};
const defaultSettings = {
    llm: defaultLLMConfig,
    theme: 'dark',
    cameraSpeed: 1.0,
    lastOpenedFolder: null,
};
export const useSettingsStore = create((set, get) => ({
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
        }
        catch {
            set({ settings: defaultSettings, isLoaded: true });
        }
    },
    saveSettings: async (settings) => {
        set({ settings });
        await window.electronAPI.saveSettings(settings);
    },
    updateSettings: async (partial) => {
        const merged = { ...get().settings, ...partial };
        set({ settings: merged });
        await window.electronAPI.saveSettings(merged);
    },
    updateLLMConfig: (partial) => {
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
        }
        catch (err) {
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
