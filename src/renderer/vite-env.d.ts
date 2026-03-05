/// <reference types="vite/client" />

import type { DaxBridge } from '@shared/ipc-api';

declare global {
  interface Window {
    dax: DaxBridge;
  }
}
