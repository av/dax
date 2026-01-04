// Application constants

// Single-user desktop app - always use admin user
export const DEFAULT_USER_ID = 'admin';

// Default agent configuration
export const DEFAULT_AGENT_TEMPERATURE = 0.7;
export const DEFAULT_AGENT_MAX_TOKENS = 2000;

// Canvas defaults
export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 150;

// Validation constraints
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_API_KEY_LENGTH = 10;
export const MAX_TEMPERATURE = 2;
export const MIN_TEMPERATURE = 0;

// Database
export const DB_FILE_NAME = 'dax.db';

// UI
export const DEFAULT_ITEMS_PER_PAGE = 30;
export const MAX_ITEMS_PER_PAGE = 100;

// Backup intervals (milliseconds)
export const ONE_HOUR_MS = 3600000;
export const ONE_DAY_MS = 86400000;
export const ONE_WEEK_MS = 604800000;
