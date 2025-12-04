import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { sceneEvents, type DroppedFile } from '@/engine/events';
import type { Vector3 } from '@/types';

export interface FileDropConfig {
  groundPlaneY?: number;
}

/**
 * Service to handle Tauri file drop events and convert them to scene events
 */
export class FileDropHandler {
  private unlistenDrop: UnlistenFn | null = null;
  private unlistenHover: UnlistenFn | null = null;
  private unlistenCancel: UnlistenFn | null = null;
  private getDropPosition: ((screenX: number, screenY: number) => Vector3 | null) | null = null;
  private lastHoverPosition: Vector3 = { x: 0, y: 0, z: 0 };

  constructor(_config: Partial<FileDropConfig> = {}) {
    // Config reserved for future options
  }

  /**
   * Start listening for file drop events
   * @param getDropPosition Function to convert screen position to world position
   */
  public async start(
    getDropPosition: (screenX: number, screenY: number) => Vector3 | null
  ): Promise<void> {
    this.getDropPosition = getDropPosition;

    // Listen for file drop
    this.unlistenDrop = await listen<{ paths?: string[]; position: { x: number; y: number } }>(
      'tauri://drag-drop',
      (event) => {
        const { paths, position } = event.payload;
        
        // Guard against undefined paths
        if (!paths || paths.length === 0) {
          return;
        }
        
        // Convert screen position to world position
        const worldPos = this.getDropPosition?.(position.x, position.y);
        const dropPosition: Vector3 = worldPos ?? this.lastHoverPosition;

        // Create dropped file objects
        const files: DroppedFile[] = paths.map((path) => {
          const parts = path.split(/[\\/]/);
          const name = parts[parts.length - 1] ?? path;
          return { path, name };
        });

        sceneEvents.emit('drop:files', {
          files,
          position: dropPosition,
        });
      }
    );

    // Listen for drag hover (files being dragged over window)
    this.unlistenHover = await listen<{ paths?: string[]; position: { x: number; y: number } }>(
      'tauri://drag-over',
      (event) => {
        const { paths, position } = event.payload;
        
        // Convert screen position to world position
        const worldPos = this.getDropPosition?.(position.x, position.y);
        if (worldPos) {
          this.lastHoverPosition = worldPos;
        }

        sceneEvents.emit('drop:hover', {
          position: this.lastHoverPosition,
          fileCount: paths?.length ?? 0,
        });
      }
    );

    // Listen for drag cancel
    this.unlistenCancel = await listen('tauri://drag-leave', () => {
      sceneEvents.emit('drop:cancel', {});
    });
  }

  /**
   * Stop listening for file drop events
   */
  public stop(): void {
    this.unlistenDrop?.();
    this.unlistenHover?.();
    this.unlistenCancel?.();
    this.unlistenDrop = null;
    this.unlistenHover = null;
    this.unlistenCancel = null;
    this.getDropPosition = null;
  }
}

/**
 * Singleton instance for the file drop handler
 */
let fileDropHandler: FileDropHandler | null = null;

export function getFileDropHandler(): FileDropHandler {
  if (!fileDropHandler) {
    fileDropHandler = new FileDropHandler();
  }
  return fileDropHandler;
}
