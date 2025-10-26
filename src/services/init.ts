import { initializeDatabase } from './database';

export interface AppConfig {
  tursoUrl: string;
  tursoAuthToken?: string;
}

// Default configuration for local development
const DEFAULT_CONFIG: AppConfig = {
  tursoUrl: process.env.TURSO_URL || 'file:dax.db',
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
};

export async function initializeApp(config: AppConfig = DEFAULT_CONFIG): Promise<void> {
  try {
    console.log('Initializing DAX application...');
    
    // Initialize Turso database
    await initializeDatabase({
      url: config.tursoUrl,
      authToken: config.tursoAuthToken,
    });
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    throw error;
  }
}

export function getConfig(): AppConfig {
  return {
    tursoUrl: process.env.TURSO_URL || 'file:dax.db',
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
  };
}
