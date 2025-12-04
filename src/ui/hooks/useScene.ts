import { useRef, useEffect, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { Engine } from '@/engine';
import { sceneEvents, type DroppedFile } from '@/engine/events';
import { getFileDropHandler } from '@/services/fileDrop';
import { useSceneStore } from '@/ui/stores/sceneStore';
import type { Vector3 } from '@/types';

export interface UseSceneResult {
  engine: Engine | null;
  fps: number;
  isReady: boolean;
  error: string | null;
}

// Stable selectors for individual actions to avoid infinite loop
const selectAddObject = (state: ReturnType<typeof useSceneStore.getState>) => state.addObject;
const selectUpdateObject = (state: ReturnType<typeof useSceneStore.getState>) => state.updateObject;
const selectRemoveObject = (state: ReturnType<typeof useSceneStore.getState>) => state.removeObject;
const selectSelect = (state: ReturnType<typeof useSceneStore.getState>) => state.select;
const selectClearSelection = (state: ReturnType<typeof useSceneStore.getState>) => state.clearSelection;
const selectSetHovered = (state: ReturnType<typeof useSceneStore.getState>) => state.setHovered;

export function useScene(containerRef: RefObject<HTMLElement | null>): UseSceneResult {
  const engineRef = useRef<Engine | null>(null);
  const [fps, setFps] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store actions - use individual selectors to avoid creating new objects on each render
  const addObject = useSceneStore(selectAddObject);
  const updateObject = useSceneStore(selectUpdateObject);
  const removeObject = useSceneStore(selectRemoveObject);
  const select = useSceneStore(selectSelect);
  const clearSelection = useSceneStore(selectClearSelection);
  const setHovered = useSceneStore(selectSetHovered);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    const fileDropHandler = getFileDropHandler();

    const handleFps = (data: { fps: number }) => {
      if (mounted) {
        setFps(data.fps);
      }
    };

    const handleReady = () => {
      if (mounted) {
        setIsReady(true);
      }
    };

    const handleError = (data: { error: string; recoverable: boolean }) => {
      if (mounted && !data.recoverable) {
        setError(data.error);
      }
    };

    // Handle file drops
    const handleFileDrop = async (data: { files: DroppedFile[]; position: Vector3 }) => {
      const engine = engineRef.current;
      if (!engine?.objectManager) return;

      // Hide drop indicator
      engine.scene.hideDropIndicator();

      // Create file objects from dropped files
      await engine.objectManager.createFromDroppedFiles(data.files, data.position);
    };

    // Handle drop hover
    const handleDropHover = (data: { position: Vector3; fileCount: number }) => {
      const engine = engineRef.current;
      if (!engine) return;

      // Show drop indicator at position
      engine.scene.showDropIndicator(data.position.x, data.position.z);
    };

    // Handle drop cancel
    const handleDropCancel = () => {
      const engine = engineRef.current;
      if (!engine) return;

      engine.scene.hideDropIndicator();
    };

    // Sync object creation with store
    const handleObjectCreated = (data: { object: import('@/types').DataObject }) => {
      addObject(data.object as import('@/types').AnyDataObject);
    };

    // Sync object updates with store
    const handleObjectUpdated = (data: { id: string; changes: Partial<import('@/types').DataObject> }) => {
      updateObject(data.id, data.changes as Partial<import('@/types').AnyDataObject>);
    };

    // Sync object deletion with store
    const handleObjectDeleted = (data: { id: string }) => {
      removeObject(data.id);
    };

    // Sync selection with store
    const handleSelectionChanged = (data: { selected: string[]; added: string[]; removed: string[] }) => {
      select(data.selected, false);
    };

    const handleSelectionCleared = () => {
      clearSelection();
    };

    // Sync hover with store
    const handleObjectHovered = (data: { id: string | null }) => {
      setHovered(data.id);
    };

    // Handle spawn object command
    const handleSpawnObject = (data: { type: string; position: Vector3; data: object }) => {
      const engine = engineRef.current;
      if (!engine?.objectManager) return;

      switch (data.type) {
        case 'snippet':
          engine.objectManager.createSnippet(data.position, data.data as {
            title?: string;
            content?: string;
            tags?: string[];
            color?: string;
          });
          break;
        // Add more object types as needed
      }
    };

    const initEngine = async () => {
      try {
        const engine = await Engine.create(container, {
          targetFPS: 60,
          physicsEnabled: true,
        });

        if (!mounted) {
          engine.dispose();
          return;
        }

        engineRef.current = engine;

        sceneEvents.on('scene:fps', handleFps);
        sceneEvents.on('scene:ready', handleReady);
        sceneEvents.on('scene:error', handleError);
        sceneEvents.on('drop:files', handleFileDrop);
        sceneEvents.on('drop:hover', handleDropHover);
        sceneEvents.on('drop:cancel', handleDropCancel);
        sceneEvents.on('object:created', handleObjectCreated);
        sceneEvents.on('object:updated', handleObjectUpdated);
        sceneEvents.on('object:deleted', handleObjectDeleted);
        sceneEvents.on('selection:changed', handleSelectionChanged);
        sceneEvents.on('selection:cleared', handleSelectionCleared);
        sceneEvents.on('object:hovered', handleObjectHovered);
        sceneEvents.on('command:spawn-object', handleSpawnObject);

        // Start file drop handler with screen-to-world conversion
        const getDropPosition = (screenX: number, screenY: number): Vector3 | null => {
          const rect = container.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((screenX - rect.left) / rect.width) * 2 - 1,
            -((screenY - rect.top) / rect.height) * 2 + 1
          );
          
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, engine.camera.camera);
          
          const point = engine.scene.raycastGround(raycaster);
          if (point) {
            return { x: point.x, y: point.y, z: point.z };
          }
          return null;
        };

        await fileDropHandler.start(getDropPosition);

        engine.start();
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize engine');
        }
      }
    };

    initEngine();

    return () => {
      mounted = false;
      fileDropHandler.stop();
      sceneEvents.off('scene:fps', handleFps);
      sceneEvents.off('scene:ready', handleReady);
      sceneEvents.off('scene:error', handleError);
      sceneEvents.off('drop:files', handleFileDrop);
      sceneEvents.off('drop:hover', handleDropHover);
      sceneEvents.off('drop:cancel', handleDropCancel);
      sceneEvents.off('object:created', handleObjectCreated);
      sceneEvents.off('object:updated', handleObjectUpdated);
      sceneEvents.off('object:deleted', handleObjectDeleted);
      sceneEvents.off('selection:changed', handleSelectionChanged);
      sceneEvents.off('selection:cleared', handleSelectionCleared);
      sceneEvents.off('object:hovered', handleObjectHovered);
      sceneEvents.off('command:spawn-object', handleSpawnObject);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [containerRef, addObject, updateObject, removeObject, select, clearSelection, setHovered]);

  return {
    engine: engineRef.current,
    fps,
    isReady,
    error,
  };
}
