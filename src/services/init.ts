import { initializeDatabase } from './database';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electron !== undefined;
}

export interface AppConfig {
  tursoUrl?: string;
  tursoAuthToken?: string;
}

export async function initializeApp(config: AppConfig = {}): Promise<void> {
  try {
    console.log('Initializing DAX application...');

    // Check if running in Electron
    if (isElectron()) {
      console.log('Running in Electron mode - database handled by main process');
      await initializeDatabase(); // No config needed for Electron
      console.log('Electron database initialized successfully');
      return;
    }

    // Web mode - requires Turso URL
    const tursoUrl = config.tursoUrl || import.meta.env.VITE_TURSO_URL;
    const tursoAuthToken = config.tursoAuthToken || import.meta.env.VITE_TURSO_AUTH_TOKEN;

    if (!tursoUrl) {
      const errorMsg = 'No database URL configured. Set VITE_TURSO_URL environment variable to use the application.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('Database URL:', tursoUrl);

    // Initialize Turso database
    await initializeDatabase({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    throw error;
  }
}

export function getConfig(): AppConfig {
  return {
    tursoUrl: import.meta.env.VITE_TURSO_URL || '',
    tursoAuthToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
  };
}
