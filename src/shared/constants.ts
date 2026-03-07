/** Maximum recursive directory depth for scanning */
export const MAX_SCAN_DEPTH = 5;

/** Debounce window for filesystem watcher events (ms) */
export const WATCHER_DEBOUNCE_MS = 100;

/** Physics engine fixed timestep (Hz) */
export const PHYSICS_TIMESTEP_HZ = 60;

/** Physics gravity (m/s²) */
export const PHYSICS_GRAVITY = -9.81;

/** Physics body default restitution (bounciness) */
export const PHYSICS_DEFAULT_RESTITUTION = 0.3;

/** Physics body default friction */
export const PHYSICS_DEFAULT_FRICTION = 0.5;

/** Physics body default linear damping (helps objects settle) */
export const PHYSICS_LINEAR_DAMPING = 0.4;

/** Physics body default angular damping */
export const PHYSICS_ANGULAR_DAMPING = 0.6;

/** Camera zoom bounds */
export const CAMERA_ZOOM_MIN = 5;
export const CAMERA_ZOOM_MAX = 200;

/** Default camera position */
export const CAMERA_DEFAULT_ALPHA = -Math.PI / 2;
export const CAMERA_DEFAULT_BETA = Math.PI / 3;
export const CAMERA_DEFAULT_RADIUS = 50;

/** Ground plane size */
export const GROUND_SIZE = 500;

/** Boundary wall height */
export const BOUNDARY_WALL_HEIGHT = 20;

/** Boundary wall thickness */
export const BOUNDARY_WALL_THICKNESS = 1;

/** Hemispheric light intensity */
export const HEMI_LIGHT_INTENSITY = 0.4;

/** Directional light intensity */
export const DIR_LIGHT_INTENSITY = 0.8;

/** Shadow map resolution */
export const SHADOW_MAP_SIZE = 2048;

/** LOD distances */
export const LOD1_DISTANCE = 100;
export const LOD2_DISTANCE = 200;

/** Performance monitoring */
export const PERF_FRAME_TIME_THRESHOLD_MS = 33;
export const PERF_CONSECUTIVE_SLOW_FRAMES = 10;

/** Target render FPS — caps the render loop to avoid wasting CPU/GPU */
export const TARGET_RENDER_FPS = 60;

/** Edge scroll configuration */
export const EDGE_SCROLL_ZONE_PX = 30;
export const EDGE_SCROLL_SPEED = 0.5;

/** Camera pan speed for keyboard */
export const CAMERA_PAN_SPEED = 1.0;

/** Camera rotation speed for keyboard */
export const CAMERA_ROTATE_SPEED = 0.03;

/** Camera inertia (0 = no inertia, 1 = full inertia) */
export const CAMERA_INERTIA = 0.85;

/** IPC timeout (ms) */
export const IPC_TIMEOUT_MS = 10_000;

/** App name */
export const APP_NAME = 'DAX';

/** Search debounce delay (ms) for name search */
export const SEARCH_DEBOUNCE_MS = 150;

/** Maximum search results */
export const MAX_SEARCH_RESULTS = 100;

/** Layout animation duration (ms) — how long objects glide to new positions */
export const LAYOUT_TRANSITION_MS = 800;

/** Lazy loading: depth at which subdirectories are loaded on-demand */
export const LAZY_LOAD_DEPTH = 3;

// ── Agent constants ──

/** BDI loop default interval (ms) — how often the agent re-evaluates */
export const BDI_LOOP_INTERVAL_MS = 30_000;

/** Agent avatar movement speed (arbitrary units — lower = slower) */
export const AGENT_WALK_SPEED = 3;

/** Agent action log retention period (days) */
export const AGENT_LOG_RETENTION_DAYS = 90;

// ── Learning system constants ──

/** Maximum stored instructions */
export const MAX_INSTRUCTIONS = 1000;

/** Similarity threshold for trigger matching (0-1) */
export const TRIGGER_MATCH_THRESHOLD = 0.85;

/** Days after which unused instructions (usageCount=0) are flagged for review */
export const INSTRUCTION_REVIEW_DAYS = 30;

/** Maximum chat messages to load on startup */
export const CHAT_HISTORY_LIMIT = 100;

/** Maximum action log entries shown in Agent Mind panel */
export const AGENT_MIND_ACTION_LOG_LIMIT = 20;

/** Maximum beliefs shown in Agent Mind panel */
export const AGENT_MIND_BELIEFS_LIMIT = 10;

/** Agent action animation base duration (ms) */
export const AGENT_ANIMATION_BASE_MS = 800;

/** Agent default speed multiplier */
export const AGENT_DEFAULT_SPEED = 1;

/** Agent avatar spawn offset from world origin */
export const AGENT_SPAWN_OFFSET_X = -5;
export const AGENT_SPAWN_OFFSET_Z = -5;

// ── Settings defaults ──

/** Default settings for the Settings panel. All settings are persisted via config:set. */
export const SETTINGS_DEFAULTS = {
  // General
  theme: 'dark' as 'dark' | 'light',
  // Camera
  edgeScrollEnabled: true,
  edgeScrollSpeed: 0.5,
  cameraSpeed: 1.0,
  zoomMin: 5,
  zoomMax: 200,
  // Agent
  agentEnabled: true,
  bdiLoopIntervalMs: 30_000,
  agentAnimationSpeed: 1,
  agentAutoLearn: true,
  // AI
  llmApiUrl: '',
  llmApiKey: '',
  llmModel: '',
  embeddingsUrl: '',
  embeddingsKey: '',
  embeddingsModel: '',
  // Performance
  maxRenderedObjects: 5000,
  shadowQuality: 'medium' as 'low' | 'medium' | 'high',
  physicsQuality: 'medium' as 'low' | 'medium' | 'high',
  // Accessibility
  reducedMotion: false,
} as const;

/** Default keyboard shortcuts (action → keyCombo) */
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  'delete': 'Delete',
  'rename': 'F2',
  'open-file': 'Enter',
  'view-file': 'Space',
  'new-file': 'Ctrl+N',
  'new-folder': 'Ctrl+Shift+N',
  'select-all': 'Ctrl+A',
  'cancel': 'Escape',
  'search': 'Ctrl+F',
  'chat': '/',
  'reset-camera': 'Home',
  'toggle-agent-mind': 'Space',
  'settings': 'Ctrl+,',
};
