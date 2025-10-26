import { Preferences } from '@/types';
import { getDatabaseInstance } from './database';

// Single-user desktop app - always use admin user
const USER_ID = 'admin';

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
    this.preferences = DEFAULT_PREFERENCES;
  }

  async loadPreferences(): Promise<Preferences> {
    try {
      const db = getDatabaseInstance();
      const prefs = await db.getPreferences(USER_ID);
      
      if (prefs) {
        this.preferences = prefs;
        return prefs;
      }
    } catch (error) {
      console.error('Error loading preferences from database:', error);
      // Fall back to localStorage
      const stored = localStorage.getItem('preferences');
      if (stored) {
        try {
          this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
          return this.preferences;
        } catch (e) {
          console.error('Error parsing localStorage preferences:', e);
        }
      }
    }
    
    this.preferences = DEFAULT_PREFERENCES;
    return this.preferences;
  }

  async savePreferences(preferences: Partial<Preferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences };
    
    try {
      const db = getDatabaseInstance();
      await db.savePreferences(USER_ID, this.preferences);
    } catch (error) {
      console.error('Error saving preferences to database:', error);
      // Fall back to localStorage
      localStorage.setItem('preferences', JSON.stringify(this.preferences));
    }
  }

  getPreferences(): Preferences {
    return this.preferences;
  }

  getTheme(): 'light' | 'dark' | 'system' {
    return this.preferences.theme;
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.savePreferences({ theme });
  }

  getHotkey(action: string): string | undefined {
    return this.preferences.hotkeys[action];
  }

  async setHotkey(action: string, key: string): Promise<void> {
    const hotkeys = { ...this.preferences.hotkeys, [action]: key };
    await this.savePreferences({ hotkeys });
  }

  async resetToDefaults(): Promise<void> {
    this.preferences = DEFAULT_PREFERENCES;
    
    try {
      const db = getDatabaseInstance();
      await db.savePreferences(USER_ID, this.preferences);
    } catch (error) {
      console.error('Error resetting preferences:', error);
      localStorage.setItem('preferences', JSON.stringify(this.preferences));
    }
  }
}

export const preferencesService = new PreferencesService();

