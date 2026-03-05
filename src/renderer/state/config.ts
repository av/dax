/**
 * App configuration signal store.
 * Reactive store for workspace path, theme, and other preferences.
 */
import { createStore } from 'solid-js/store';
import { SETTINGS_DEFAULTS } from '@shared/constants';

export interface AppConfig {
  /** The workspace directory path, or null if not yet selected */
  workspacePath: string | null;
  /** Whether the workspace path has been verified to exist */
  workspaceVerified: boolean;
  /** UI theme */
  theme: 'dark' | 'light';
  /** Whether edge scrolling is enabled */
  edgeScrollEnabled: boolean;
  /** Edge scroll speed */
  edgeScrollSpeed: number;
  /** Camera movement speed multiplier */
  cameraSpeed: number;
  /** Camera zoom min */
  zoomMin: number;
  /** Camera zoom max */
  zoomMax: number;
  /** Whether the agent is enabled */
  agentEnabled: boolean;
  /** BDI loop interval (ms) */
  bdiLoopIntervalMs: number;
  /** Agent animation speed multiplier */
  agentAnimationSpeed: number;
  /** Agent auto-learn toggle */
  agentAutoLearn: boolean;
  /** LLM API URL */
  llmApiUrl: string;
  /** LLM API Key (encrypted in DB, masked in UI) */
  llmApiKey: string;
  /** LLM model name */
  llmModel: string;
  /** Embeddings API URL */
  embeddingsUrl: string;
  /** Embeddings API Key */
  embeddingsKey: string;
  /** Embeddings model name */
  embeddingsModel: string;
  /** Maximum rendered objects */
  maxRenderedObjects: number;
  /** Shadow quality */
  shadowQuality: 'low' | 'medium' | 'high';
  /** Physics quality */
  physicsQuality: 'low' | 'medium' | 'high';
  /** Reduced motion mode */
  reducedMotion: boolean;
}

const defaultConfig: AppConfig = {
  workspacePath: null,
  workspaceVerified: false,
  theme: SETTINGS_DEFAULTS.theme,
  edgeScrollEnabled: SETTINGS_DEFAULTS.edgeScrollEnabled,
  edgeScrollSpeed: SETTINGS_DEFAULTS.edgeScrollSpeed,
  cameraSpeed: SETTINGS_DEFAULTS.cameraSpeed,
  zoomMin: SETTINGS_DEFAULTS.zoomMin,
  zoomMax: SETTINGS_DEFAULTS.zoomMax,
  agentEnabled: SETTINGS_DEFAULTS.agentEnabled,
  bdiLoopIntervalMs: SETTINGS_DEFAULTS.bdiLoopIntervalMs,
  agentAnimationSpeed: SETTINGS_DEFAULTS.agentAnimationSpeed,
  agentAutoLearn: SETTINGS_DEFAULTS.agentAutoLearn,
  llmApiUrl: SETTINGS_DEFAULTS.llmApiUrl,
  llmApiKey: SETTINGS_DEFAULTS.llmApiKey,
  llmModel: SETTINGS_DEFAULTS.llmModel,
  embeddingsUrl: SETTINGS_DEFAULTS.embeddingsUrl,
  embeddingsKey: SETTINGS_DEFAULTS.embeddingsKey,
  embeddingsModel: SETTINGS_DEFAULTS.embeddingsModel,
  maxRenderedObjects: SETTINGS_DEFAULTS.maxRenderedObjects,
  shadowQuality: SETTINGS_DEFAULTS.shadowQuality,
  physicsQuality: SETTINGS_DEFAULTS.physicsQuality,
  reducedMotion: SETTINGS_DEFAULTS.reducedMotion,
};

const [appConfig, setAppConfig] = createStore<AppConfig>(defaultConfig);

export { appConfig, setAppConfig, defaultConfig };
