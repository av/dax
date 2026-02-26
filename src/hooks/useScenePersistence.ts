import { useEffect, useRef, useCallback } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useSceneStore } from '@/stores/sceneStore';
import type { SaveSceneObject } from '@/types';

// ── Helpers ──────────────────────────────────────────────

function basename(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(lastSep + 1) : filePath;
}

// ── Hook ─────────────────────────────────────────────────

export function useScenePersistence(): void {
  const rootPath = useFileTreeStore((s) => s.rootPath);
  // Keep workspaceId in a ref so saveScene can access it without re-creating
  const workspaceIdRef = useRef<number | null>(null);

  // ── Open workspace & load scene on rootPath change ────

  useEffect(() => {
    if (!rootPath) return;

    let cancelled = false;

    async function openAndLoad(): Promise<void> {
      try {
        const { workspaceId } = await window.electronAPI.workspaceOpen(rootPath!, basename(rootPath!));
        if (cancelled) return;

        workspaceIdRef.current = workspaceId;
        useSceneStore.getState().reset();

        const snapshot = await window.electronAPI.workspaceLoadScene(workspaceId);
        if (cancelled) return;

        useSceneStore.getState().loadSnapshot(snapshot);

        // Apply position overrides to fileTreeStore
        const positionOverrides = useSceneStore.getState().getPositionOverridesFromSnapshot();
        if (positionOverrides.size === 0) return;

        const { nodes } = useFileTreeStore.getState();
        for (const node of nodes.values()) {
          const pos = positionOverrides.get(node.path);
          if (pos !== undefined) {
            useFileTreeStore.getState().setPositionOverride(node.id, pos);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useScenePersistence] Failed to open/load workspace:', msg);
      }
    }

    void openAndLoad();

    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  // ── Save scene ───────────────────────────────────────

  const saveScene = useCallback(async (): Promise<void> => {
    const workspaceId = workspaceIdRef.current;
    if (workspaceId === null) return;

    const { nodes, positionOverrides } = useFileTreeStore.getState();

    const objects: SaveSceneObject[] = [];
    for (const node of nodes.values()) {
      if (node.type !== 'file') continue;
      const pos = positionOverrides.get(node.id) ?? node.position;
      objects.push({
        fileNodeId: node.id,
        filePath: node.path,
        objectType: 'file',
        pos_x: pos[0],
        pos_y: pos[1],
        pos_z: pos[2],
        rot_x: 0, rot_y: 0, rot_z: 0, rot_w: 1,
        scale_x: 1, scale_y: 1, scale_z: 1,
        lin_vel_x: 0, lin_vel_y: 0, lin_vel_z: 0,
        ang_vel_x: 0, ang_vel_y: 0, ang_vel_z: 0,
        is_sleeping: 1,
        is_pinned: 0,
      });
    }

    if (objects.length === 0) return;

    try {
      await window.electronAPI.workspaceSaveScene(workspaceId, objects);
      useSceneStore.getState().markSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useScenePersistence] Failed to save scene:', msg);
    }
  }, []);

  // ── Mark dirty when positionOverrides change ─────────

  useEffect(() => {
    const unsubscribe = useFileTreeStore.subscribe((state, prev) => {
      if (state.positionOverrides !== prev.positionOverrides) {
        useSceneStore.getState().markDirty();
      }
    });
    return unsubscribe;
  }, []);

  // ── Auto-save every 5 seconds when dirty ─────────────

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (useSceneStore.getState().isDirty) {
        void saveScene();
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [saveScene]);

  // ── Save on beforeunload ──────────────────────────────

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      void saveScene();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveScene]);
}
