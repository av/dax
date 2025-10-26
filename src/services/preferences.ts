import { Preferences } from '@/types';

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  autostart: false,
  dataDir: './data',
  backup: {
    enabled: false,
    interval: 3600000, // 1 hour
    location: './backups',
  },
  sync: {
    enabled: false,
  },
  language: 'en',
  hotkeys: {
    newNode: 'Ctrl+N',
    save: 'Ctrl+S',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
  },
};

export class PreferencesService {
  private preferences: Preferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  private loadPreferences(): Preferences {
    // In Electron, this would load from storage
    const stored = localStorage.getItem('preferences');
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    }
    return DEFAULT_PREFERENCES;
  }

  savePreferences(preferences: Partial<Preferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('preferences', JSON.stringify(this.preferences));
  }

  getPreferences(): Preferences {
    return this.preferences;
  }

  getTheme(): 'light' | 'dark' | 'system' {
    return this.preferences.theme;
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.savePreferences({ theme });
  }

  getHotkey(action: string): string | undefined {
    return this.preferences.hotkeys[action];
  }

  setHotkey(action: string, key: string): void {
    const hotkeys = { ...this.preferences.hotkeys, [action]: key };
    this.savePreferences({ hotkeys });
  }

  resetToDefaults(): void {
    this.preferences = DEFAULT_PREFERENCES;
    localStorage.setItem('preferences', JSON.stringify(this.preferences));
  }
}

export const preferencesService = new PreferencesService();
