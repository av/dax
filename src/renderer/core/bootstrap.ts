/**
 * App bootstrap service.
 * Handles the initialization sequence after a workspace directory is selected:
 * 1. Initialize 3D scene (physics, camera, lighting)
 * 2. Scan the directory
 * 3. Load persisted scene objects from DB
 * 4. Populate the file tree signal
 * 5. Create 3D meshes in the scene
 * 6. Start the filesystem watcher
 * 7. Wire up watcher events to update the scene
 * 8. Persist camera state changes to DB
 */
import { getScene, initScene, sceneReady } from '../engine/scene';
import { onCameraStateChange, restoreCameraState } from '../engine/camera';
import { populateScene, handleFSEventBatch } from '../engine/scene-bridge';
import type { SceneBridgeCallbacks } from '../engine/scene-bridge';
import { initSelectionSystem } from '../engine/selection';
import { initInteractionSystem } from '../engine/interaction';
import { ipcClient } from './ipc-client';
import { replaceTree, fileTree, addEntry, removeEntry, updateEntry } from '../state/file-tree';
import { replaceSceneObjects, upsertSceneObject, removeSceneObject } from '../state/scene-objects';
import { onWatcherEvents } from '../fs/fs-service';
import { getFileCategory } from '@shared/file-types';
import type { FileEntry } from '@shared/file-types';
import type { FSEventBatch } from '@shared/events';
import { MAX_SCAN_DEPTH, AGENT_LOG_RETENTION_DAYS } from '@shared/constants';
import type { CameraState } from '../state/camera';
import { initBDIEngine } from '../agent/bdi';
import { loadChatHistory, loadInstructions, checkLLMHealth } from '../agent/chat-handler';
import { CHAT_HISTORY_LIMIT } from '@shared/constants';
import { applyCustomShortcuts } from './keyboard';
import { setAppConfig } from '../state/config';
import type { AppConfig } from '../state/config';

let watcherUnsubscribe: (() => void) | null = null;

/**
 * Bootstrap the workspace after directory selection.
 * This is the main initialization sequence for M3/M4.
 */
export async function bootstrapWorkspace(dirPath: string): Promise<void> {
  // Wait for the 3D scene (incl. Havok WASM) to finish initializing
  await sceneReady;

  const scene = getScene();
  if (!scene) {
    throw new Error('Scene not initialized. Call initScene() before bootstrapWorkspace().');
  }

  // M5: Initialize selection highlighting and interaction system
  initSelectionSystem(scene);
  initInteractionSystem(scene);

  // 1. Scan the directory
  const entries = await ipcClient.fsScan(dirPath, MAX_SCAN_DEPTH);

  // 2. Load persisted scene objects from DB
  const persistedObjects = await ipcClient.dbSceneGetAll();

  // 3. Populate the file tree signal
  replaceTree(entries);

  // 4. Create persistence callbacks
  const callbacks: SceneBridgeCallbacks = {
    persistBatch: async (objs) => {
      await ipcClient.dbSceneUpsertBatch(objs);
      for (const obj of objs) {
        upsertSceneObject(obj);
      }
    },
    persistDelete: async (path) => {
      await ipcClient.dbSceneDelete(path);
      removeSceneObject(path);
    },
    loadPersistedObjects: () => ipcClient.dbSceneGetAll(),
  };

  // 5. Populate the scene with meshes (batched with rAF)
  const sceneObjects = await populateScene(entries, scene, callbacks, persistedObjects);

  // 6. Update scene objects signal with final state
  replaceSceneObjects(sceneObjects);

  // 7. Clean up orphaned DB entries (files that no longer exist)
  const validPaths = entries.map((e) => e.path);
  await ipcClient.dbSceneDeleteOrphans(validPaths);

  // 8. Start the filesystem watcher
  await ipcClient.watcherStart(dirPath);

  // 9. Wire up watcher events
  if (watcherUnsubscribe) {
    watcherUnsubscribe();
  }
  watcherUnsubscribe = onWatcherEvents((batch: FSEventBatch) => {
    // Update file tree signal
    for (const event of batch.events) {
      switch (event.type) {
        case 'add':
        case 'addDir': {
          const isFolder = event.type === 'addDir';
          const ext = isFolder ? '' : (event.path.split('.').pop() ?? '');
          const name = event.path.split('/').pop() ?? event.path;
          const parentPath = event.path.includes('/')
            ? event.path.slice(0, event.path.lastIndexOf('/'))
            : null;

          if (event.renameFrom) {
            // Rename: remove old, add new
            removeEntry(event.renameFrom);
          }

          const entry: FileEntry = {
            path: event.path,
            name,
            extension: isFolder ? '' : ext,
            type: isFolder ? 'folder' : 'file',
            category: isFolder ? 'unknown' : getFileCategory(ext),
            parentPath,
          };
          addEntry(entry);
          break;
        }
        case 'unlink':
        case 'unlinkDir':
          removeEntry(event.path);
          break;
        case 'change':
          updateEntry(event.path, { path: event.path });
          break;
      }
    }

    // Update 3D scene
    handleFSEventBatch(
      batch,
      scene,
      callbacks,
      () => fileTree.entries,
    );
  });

  // 10. Wire up camera state persistence to DB
  onCameraStateChange((state: CameraState) => {
    ipcClient.configSet('camera_state', JSON.stringify(state)).catch(console.error);
  });

  // 10b. Restore saved camera state from DB
  try {
    const savedCameraJson = await ipcClient.configGet('camera_state');
    if (savedCameraJson) {
      const parsed: CameraState = JSON.parse(savedCameraJson);
      restoreCameraState(parsed);
    }
  } catch (err) {
    console.error('[bootstrap] Failed to restore camera state (non-fatal):', err);
  }

  // 11. Initialize the agent BDI engine
  try {
    await initBDIEngine();
  } catch (err) {
    console.error('[bootstrap] Agent BDI init failed (non-fatal):', err);
  }

  // 12. Load chat history and instructions
  try {
    await Promise.all([
      loadChatHistory(CHAT_HISTORY_LIMIT),
      loadInstructions(),
    ]);
  } catch (err) {
    console.error('[bootstrap] Chat/instruction load failed (non-fatal):', err);
  }

  // 13. Check LLM health
  try {
    await checkLLMHealth();
  } catch {
    // Non-critical
  }

  // 14. Prune action log (fire-and-forget, 90 days)
  ipcClient.dbAgentPruneLog(AGENT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).catch((err) => {
    console.error('[bootstrap] Action log prune failed (non-fatal):', err);
  });

  // 15. Load custom keyboard shortcuts from DB
  try {
    const shortcuts = await ipcClient.dbShortcutsGetAll();
    applyCustomShortcuts(shortcuts);
  } catch (err) {
    console.error('[bootstrap] Failed to load shortcuts (non-fatal):', err);
  }

  // 16. Load persisted settings into appConfig store
  try {
    const settingsKeys = [
      'theme', 'edgeScrollEnabled', 'edgeScrollSpeed', 'cameraSpeed',
      'zoomMin', 'zoomMax', 'agentEnabled', 'bdiLoopIntervalMs',
      'agentAnimationSpeed', 'agentAutoLearn', 'llmApiUrl', 'llmModel',
      'embeddingsUrl', 'embeddingsModel', 'maxRenderedObjects',
      'shadowQuality', 'physicsQuality', 'reducedMotion',
    ];
    for (const key of settingsKeys) {
      const stored = await ipcClient.configGet(key);
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          setAppConfig(key as keyof AppConfig, parsed);
        } catch {
          // Not JSON, use as string
          setAppConfig(key as keyof AppConfig, stored as never);
        }
      }
    }
    // Apply theme on load
    document.documentElement.dataset.theme = (await ipcClient.configGet('theme'))?.replace(/"/g, '') ?? 'dark';
  } catch (err) {
    console.error('[bootstrap] Failed to load settings (non-fatal):', err);
  }
}

/**
 * Tear down the workspace (stop watcher, clean up).
 */
export async function teardownWorkspace(): Promise<void> {
  if (watcherUnsubscribe) {
    watcherUnsubscribe();
    watcherUnsubscribe = null;
  }
  try {
    await ipcClient.watcherStop();
  } catch {
    // Watcher might not be running — ignore
  }
}
