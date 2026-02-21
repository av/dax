import type { DaxAPI } from './index';

declare global {
  interface Window {
    electronAPI: DaxAPI;
  }
}

export {};
