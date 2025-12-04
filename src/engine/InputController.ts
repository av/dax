import * as THREE from 'three';
import { sceneEvents } from './events';
import type { ObjectManager } from './ObjectManager';
import type { Vector3 } from '@/types';

export type ToolMode = 'select' | 'pan' | 'boundary' | 'beacon';

export interface InputState {
  mousePosition: THREE.Vector2;
  isLeftDown: boolean;
  isMiddleDown: boolean;
  isRightDown: boolean;
  keysDown: Set<string>;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}

interface SelectionBox {
  startScreen: { x: number; y: number };
  endScreen: { x: number; y: number };
  isActive: boolean;
}

interface DragState {
  isActive: boolean;
  objectIds: string[];
  startPosition: Vector3 | null;
  dragPlane: THREE.Plane;
}

interface BoundaryDrawState {
  isActive: boolean;
  vertices: Vector3[];
  currentCursorPosition: Vector3 | null;
}

interface BeaconPlaceState {
  isActive: boolean;
  position: Vector3 | null;
}

const CLICK_THRESHOLD = 5; // pixels
const DRAG_THRESHOLD = 10; // pixels
const BOUNDARY_CLOSE_THRESHOLD = 1.5; // world units - distance to close polygon

export class InputController {
  private container: HTMLElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private state: InputState = {
    mousePosition: new THREE.Vector2(),
    isLeftDown: false,
    isMiddleDown: false,
    isRightDown: false,
    keysDown: new Set(),
    modifiers: { shift: false, ctrl: false, alt: false },
  };

  // Tool mode
  private toolMode: ToolMode = 'select';

  // Selection state
  private mouseDownPosition: { x: number; y: number } | null = null;
  private selectionBox: SelectionBox = {
    startScreen: { x: 0, y: 0 },
    endScreen: { x: 0, y: 0 },
    isActive: false,
  };
  private clickedObjectId: string | null = null;

  // Drag state
  private dragState: DragState = {
    isActive: false,
    objectIds: [],
    startPosition: null,
    dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  };

  // Boundary drawing state
  private boundaryDrawState: BoundaryDrawState = {
    isActive: false,
    vertices: [],
    currentCursorPosition: null,
  };

  // Beacon placement state
  private beaconPlaceState: BeaconPlaceState = {
    isActive: false,
    position: null,
  };

  // External references
  private objectManager: ObjectManager | null = null;
  private camera: THREE.Camera | null = null;
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private onMouseDownHandler: (e: MouseEvent) => void;
  private onMouseUpHandler: (e: MouseEvent) => void;
  private onMouseMoveHandler: (e: MouseEvent) => void;
  private onWheelHandler: (e: WheelEvent) => void;
  private onContextMenuHandler: (e: Event) => void;
  private onKeyDownHandler: (e: KeyboardEvent) => void;
  private onKeyUpHandler: (e: KeyboardEvent) => void;
  private onDoubleClickHandler: (e: MouseEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.raycaster = new THREE.Raycaster();

    this.onMouseDownHandler = this.onMouseDown.bind(this);
    this.onMouseUpHandler = this.onMouseUp.bind(this);
    this.onMouseMoveHandler = this.onMouseMove.bind(this);
    this.onWheelHandler = this.onWheel.bind(this);
    this.onContextMenuHandler = (e) => e.preventDefault();
    this.onKeyDownHandler = this.onKeyDown.bind(this);
    this.onKeyUpHandler = this.onKeyUp.bind(this);
    this.onDoubleClickHandler = this.onDoubleClick.bind(this);

    this.attach();
  }

  public setObjectManager(objectManager: ObjectManager): void {
    this.objectManager = objectManager;
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public setToolMode(mode: ToolMode): void {
    // Cancel any ongoing drawing when switching modes
    if (this.boundaryDrawState.isActive) {
      this.cancelBoundaryDraw();
    }
    if (this.beaconPlaceState.isActive) {
      this.cancelBeaconPlace();
    }
    
    this.toolMode = mode;
    
    // Start boundary or beacon mode
    if (mode === 'boundary') {
      this.startBoundaryDraw();
    } else if (mode === 'beacon') {
      this.startBeaconPlace();
    }
  }

  public getToolMode(): ToolMode {
    return this.toolMode;
  }

  private startBoundaryDraw(): void {
    this.boundaryDrawState = {
      isActive: true,
      vertices: [],
      currentCursorPosition: null,
    };
    sceneEvents.emit('boundary:draw:start', {});
  }

  private cancelBoundaryDraw(): void {
    if (this.boundaryDrawState.isActive) {
      this.boundaryDrawState = {
        isActive: false,
        vertices: [],
        currentCursorPosition: null,
      };
      sceneEvents.emit('boundary:draw:cancel', {});
    }
  }

  private completeBoundaryDraw(): void {
    if (this.boundaryDrawState.vertices.length >= 3) {
      sceneEvents.emit('boundary:draw:complete', {
        vertices: [...this.boundaryDrawState.vertices],
      });
    }
    
    // Reset state but stay in boundary mode for drawing more
    this.boundaryDrawState = {
      isActive: true,
      vertices: [],
      currentCursorPosition: null,
    };
  }

  private addBoundaryVertex(position: Vector3): void {
    const vertices = this.boundaryDrawState.vertices;
    
    // Check if clicking near the first vertex to close the polygon
    if (vertices.length >= 3) {
      const firstVertex = vertices[0];
      if (firstVertex) {
        const distance = Math.sqrt(
          Math.pow(position.x - firstVertex.x, 2) +
          Math.pow(position.z - firstVertex.z, 2)
        );
        
        if (distance < BOUNDARY_CLOSE_THRESHOLD) {
          this.completeBoundaryDraw();
          return;
        }
      }
    }
    
    vertices.push(position);
    sceneEvents.emit('boundary:draw:vertex', {
      vertex: position,
      vertices: [...vertices],
    });
  }

  private startBeaconPlace(): void {
    this.beaconPlaceState = {
      isActive: true,
      position: null,
    };
    sceneEvents.emit('beacon:place:start', {});
  }

  private cancelBeaconPlace(): void {
    if (this.beaconPlaceState.isActive) {
      this.beaconPlaceState = {
        isActive: false,
        position: null,
      };
      sceneEvents.emit('beacon:place:cancel', {});
    }
  }

  private placeBeacon(position: Vector3): void {
    sceneEvents.emit('beacon:place:complete', { position });
    
    // Stay in beacon mode for placing more
    this.beaconPlaceState = {
      isActive: true,
      position: null,
    };
  }

  private attach(): void {
    this.container.addEventListener('mousedown', this.onMouseDownHandler);
    this.container.addEventListener('mouseup', this.onMouseUpHandler);
    this.container.addEventListener('mousemove', this.onMouseMoveHandler);
    this.container.addEventListener('wheel', this.onWheelHandler, { passive: false });
    this.container.addEventListener('contextmenu', this.onContextMenuHandler);
    this.container.addEventListener('dblclick', this.onDoubleClickHandler);
    window.addEventListener('keydown', this.onKeyDownHandler);
    window.addEventListener('keyup', this.onKeyUpHandler);
  }

  public detach(): void {
    this.container.removeEventListener('mousedown', this.onMouseDownHandler);
    this.container.removeEventListener('mouseup', this.onMouseUpHandler);
    this.container.removeEventListener('mousemove', this.onMouseMoveHandler);
    this.container.removeEventListener('wheel', this.onWheelHandler);
    this.container.removeEventListener('contextmenu', this.onContextMenuHandler);
    this.container.removeEventListener('dblclick', this.onDoubleClickHandler);
    window.removeEventListener('keydown', this.onKeyDownHandler);
    window.removeEventListener('keyup', this.onKeyUpHandler);
  }

  private updateModifiers(e: MouseEvent | KeyboardEvent): void {
    this.state.modifiers.shift = e.shiftKey;
    this.state.modifiers.ctrl = e.ctrlKey || e.metaKey;
    this.state.modifiers.alt = e.altKey;
  }

  private getNormalizedMousePosition(e: MouseEvent): THREE.Vector2 {
    const rect = this.container.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private getWorldPosition(e: MouseEvent): Vector3 | null {
    if (!this.camera) return null;

    const normalized = this.getNormalizedMousePosition(e);
    this.raycaster.setFromCamera(normalized, this.camera);

    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);

    if (hit) {
      return { x: intersection.x, y: intersection.y, z: intersection.z };
    }
    return null;
  }

  private onMouseDown(e: MouseEvent): void {
    this.updateModifiers(e);
    this.state.mousePosition.set(e.clientX, e.clientY);
    this.mouseDownPosition = { x: e.clientX, y: e.clientY };

    switch (e.button) {
      case 0: // Left click
        this.state.isLeftDown = true;
        this.handleLeftMouseDown(e);
        break;
      case 1:
        this.state.isMiddleDown = true;
        break;
      case 2: // Right click
        this.state.isRightDown = true;
        this.handleRightClick(e);
        break;
    }
  }

  private handleLeftMouseDown(e: MouseEvent): void {
    // Handle tool-specific actions
    if (this.toolMode === 'boundary' && this.boundaryDrawState.isActive) {
      const worldPos = this.getWorldPosition(e);
      if (worldPos) {
        this.addBoundaryVertex(worldPos);
      }
      return;
    }

    if (this.toolMode === 'beacon' && this.beaconPlaceState.isActive) {
      const worldPos = this.getWorldPosition(e);
      if (worldPos) {
        this.placeBeacon(worldPos);
      }
      return;
    }

    // Default select mode handling
    if (!this.objectManager || !this.camera) return;

    // Check if clicking on an object
    const normalized = this.getNormalizedMousePosition(e);
    this.raycaster.setFromCamera(normalized, this.camera);
    const hits = this.objectManager.raycastObjects(this.raycaster);

    if (hits.length > 0 && hits[0]) {
      this.clickedObjectId = hits[0].id;

      // If clicking on a selected object, start drag
      const selectedIds = this.objectManager.getSelectedIds();
      if (selectedIds.includes(this.clickedObjectId)) {
        this.startDrag(e, selectedIds);
      }
    } else {
      this.clickedObjectId = null;

      // Start box selection if not clicking on object
      this.selectionBox = {
        startScreen: { x: e.clientX, y: e.clientY },
        endScreen: { x: e.clientX, y: e.clientY },
        isActive: false, // Will become active after threshold
      };
    }
  }

  private startDrag(e: MouseEvent, objectIds: string[]): void {
    const worldPos = this.getWorldPosition(e);
    if (!worldPos) return;

    this.dragState = {
      isActive: true,
      objectIds: [...objectIds],
      startPosition: worldPos,
      dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPos.y),
    };

    sceneEvents.emit('input:drag:start', {
      objectIds: this.dragState.objectIds,
      startPosition: worldPos,
    });
  }

  private handleRightClick(e: MouseEvent): void {
    const worldPos = this.getWorldPosition(e);
    if (!worldPos) return;

    let objectId: string | undefined;

    if (this.objectManager && this.camera) {
      const normalized = this.getNormalizedMousePosition(e);
      this.raycaster.setFromCamera(normalized, this.camera);
      const hits = this.objectManager.raycastObjects(this.raycaster);
      if (hits.length > 0 && hits[0]) {
        objectId = hits[0].id;
      }
    }

    sceneEvents.emit('input:rightclick', {
      position: worldPos,
      objectId,
    });
  }

  private onMouseUp(e: MouseEvent): void {
    this.updateModifiers(e);

    switch (e.button) {
      case 0: // Left click
        this.state.isLeftDown = false;
        this.handleLeftMouseUp(e);
        break;
      case 1:
        this.state.isMiddleDown = false;
        break;
      case 2:
        this.state.isRightDown = false;
        break;
    }

    this.mouseDownPosition = null;
  }

  private handleLeftMouseUp(e: MouseEvent): void {
    // Handle drag end
    if (this.dragState.isActive) {
      this.endDrag(e);
      return;
    }

    // Handle box selection end
    if (this.selectionBox.isActive) {
      this.endBoxSelection(e);
      return;
    }

    // Handle click (was not a drag or box select)
    if (this.mouseDownPosition) {
      const dx = Math.abs(e.clientX - this.mouseDownPosition.x);
      const dy = Math.abs(e.clientY - this.mouseDownPosition.y);

      if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
        this.handleClick(e);
      }
    }
  }

  private handleClick(e: MouseEvent): void {
    if (!this.objectManager) return;

    const worldPos = this.getWorldPosition(e);
    const previousSelection = this.objectManager.getSelectedIds();

    if (this.clickedObjectId) {
      // Shift-click for additive/toggle selection
      if (this.state.modifiers.shift) {
        if (previousSelection.includes(this.clickedObjectId)) {
          // Toggle off
          const newSelection = previousSelection.filter((id) => id !== this.clickedObjectId);
          this.objectManager.selectObjects(newSelection, false);
          this.emitSelectionChanged(newSelection, previousSelection);
        } else {
          // Add to selection
          this.objectManager.selectObjects([this.clickedObjectId], true);
          this.emitSelectionChanged([...previousSelection, this.clickedObjectId], previousSelection);
        }
      } else {
        // Single select (replace)
        this.objectManager.selectObjects([this.clickedObjectId], false);
        this.emitSelectionChanged([this.clickedObjectId], previousSelection);
      }

      // Emit input:click with object
      sceneEvents.emit('input:click', {
        position: worldPos ?? { x: 0, y: 0, z: 0 },
        screenPosition: { x: e.clientX, y: e.clientY },
        objectId: this.clickedObjectId,
        button: 'left',
        modifiers: { ...this.state.modifiers },
      });
    } else {
      // Click on empty space - clear selection unless shift
      if (!this.state.modifiers.shift) {
        this.objectManager.clearSelection();
        this.emitSelectionChanged([], previousSelection);
      }

      // Emit input:click without object
      sceneEvents.emit('input:click', {
        position: worldPos ?? { x: 0, y: 0, z: 0 },
        screenPosition: { x: e.clientX, y: e.clientY },
        button: 'left',
        modifiers: { ...this.state.modifiers },
      });
    }

    this.clickedObjectId = null;
  }

  private endDrag(e: MouseEvent): void {
    const worldPos = this.getWorldPosition(e);

    sceneEvents.emit('input:drag:end', {
      objectIds: this.dragState.objectIds,
      finalPosition: worldPos ?? { x: 0, y: 0, z: 0 },
    });

    // Release physics
    if (this.objectManager) {
      this.objectManager.releaseDraggedObjects();
    }

    this.dragState = {
      isActive: false,
      objectIds: [],
      startPosition: null,
      dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    };
  }

  private endBoxSelection(_e: MouseEvent): void {
    if (!this.objectManager || !this.camera) return;

    const selected = this.getObjectsInSelectionBox();
    const previousSelection = this.objectManager.getSelectedIds();

    if (this.state.modifiers.shift) {
      // Additive selection
      const newSelection = [...new Set([...previousSelection, ...selected])];
      this.objectManager.selectObjects(newSelection, false);
      this.emitSelectionChanged(newSelection, previousSelection);
    } else {
      // Replace selection
      this.objectManager.selectObjects(selected, false);
      this.emitSelectionChanged(selected, previousSelection);
    }

    this.selectionBox.isActive = false;
    sceneEvents.emit('selection:box:end', {});
  }

  private getObjectsInSelectionBox(): string[] {
    if (!this.objectManager || !this.camera) return [];

    const { startScreen, endScreen } = this.selectionBox;
    const rect = this.container.getBoundingClientRect();

    // Normalize box coordinates
    const minX = Math.min(startScreen.x, endScreen.x) - rect.left;
    const maxX = Math.max(startScreen.x, endScreen.x) - rect.left;
    const minY = Math.min(startScreen.y, endScreen.y) - rect.top;
    const maxY = Math.max(startScreen.y, endScreen.y) - rect.top;

    const selected: string[] = [];
    const objects = this.objectManager.getAllObjects();

    for (const object of objects) {
      // Project object center to screen
      const screenPos = object.position.clone().project(this.camera);
      const x = ((screenPos.x + 1) / 2) * rect.width;
      const y = ((-screenPos.y + 1) / 2) * rect.height;

      // Check if within selection box
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        const data = this.objectManager.getObjectData(object.userData.objectId as string);
        if (data) {
          selected.push(data.id);
        }
      }
    }

    return selected;
  }

  private emitSelectionChanged(newSelection: string[], previousSelection: string[]): void {
    const added = newSelection.filter((id) => !previousSelection.includes(id));
    const removed = previousSelection.filter((id) => !newSelection.includes(id));

    if (added.length > 0 || removed.length > 0) {
      sceneEvents.emit('selection:changed', {
        selected: newSelection,
        added,
        removed,
      });
    }

    if (newSelection.length === 0 && previousSelection.length > 0) {
      sceneEvents.emit('selection:cleared', {});
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.updateModifiers(e);
    this.mouse = this.getNormalizedMousePosition(e);
    this.state.mousePosition.set(e.clientX, e.clientY);

    // Handle boundary drawing preview
    if (this.toolMode === 'boundary' && this.boundaryDrawState.isActive) {
      const worldPos = this.getWorldPosition(e);
      if (worldPos) {
        this.boundaryDrawState.currentCursorPosition = worldPos;
        sceneEvents.emit('boundary:draw:preview', {
          vertices: [...this.boundaryDrawState.vertices],
          cursorPosition: worldPos,
        });
      }
      return;
    }

    // Handle beacon placement preview
    if (this.toolMode === 'beacon' && this.beaconPlaceState.isActive) {
      const worldPos = this.getWorldPosition(e);
      if (worldPos) {
        this.beaconPlaceState.position = worldPos;
        sceneEvents.emit('beacon:place:preview', { position: worldPos });
      }
      return;
    }

    // Handle drag
    if (this.dragState.isActive) {
      this.updateDrag(e);
      return;
    }

    // Handle box selection
    if (this.state.isLeftDown && this.mouseDownPosition && !this.clickedObjectId) {
      const dx = Math.abs(e.clientX - this.mouseDownPosition.x);
      const dy = Math.abs(e.clientY - this.mouseDownPosition.y);

      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        if (!this.selectionBox.isActive) {
          this.selectionBox.isActive = true;
          sceneEvents.emit('selection:box:start', {
            start: this.selectionBox.startScreen,
          });
        }
        this.selectionBox.endScreen = { x: e.clientX, y: e.clientY };
        sceneEvents.emit('selection:box:update', {
          start: this.selectionBox.startScreen,
          end: this.selectionBox.endScreen,
        });
      }
    }

    // Handle drag initiation for selected objects
    if (this.state.isLeftDown && this.clickedObjectId && this.mouseDownPosition) {
      const dx = Math.abs(e.clientX - this.mouseDownPosition.x);
      const dy = Math.abs(e.clientY - this.mouseDownPosition.y);

      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        if (this.objectManager) {
          const selectedIds = this.objectManager.getSelectedIds();
          if (selectedIds.includes(this.clickedObjectId)) {
            this.startDrag(e, selectedIds);
          } else {
            // Select the clicked object and start dragging
            this.objectManager.selectObjects([this.clickedObjectId], false);
            this.startDrag(e, [this.clickedObjectId]);
          }
        }
      }
    }
  }

  private updateDrag(e: MouseEvent): void {
    if (!this.objectManager || !this.camera || !this.dragState.startPosition) return;

    const normalized = this.getNormalizedMousePosition(e);
    this.raycaster.setFromCamera(normalized, this.camera);

    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.dragState.dragPlane, intersection);

    if (hit) {
      const currentPos: Vector3 = {
        x: intersection.x,
        y: intersection.y,
        z: intersection.z,
      };

      const delta: Vector3 = {
        x: currentPos.x - this.dragState.startPosition.x,
        y: 0, // Keep Y constant during drag
        z: currentPos.z - this.dragState.startPosition.z,
      };

      // Move objects
      this.objectManager.moveSelectedObjects(delta);

      // Update start position for next delta
      this.dragState.startPosition = currentPos;

      sceneEvents.emit('input:drag:move', {
        objectIds: this.dragState.objectIds,
        currentPosition: currentPos,
        delta,
      });
    }
  }

  private onDoubleClick(e: MouseEvent): void {
    if (!this.objectManager || !this.camera) return;

    const normalized = this.getNormalizedMousePosition(e);
    this.raycaster.setFromCamera(normalized, this.camera);
    const hits = this.objectManager.raycastObjects(this.raycaster);

    if (hits.length > 0 && hits[0]) {
      sceneEvents.emit('input:doubleclick', { objectId: hits[0].id });
    }
  }

  private onWheel(_e: WheelEvent): void {
    // Handled by Camera
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.updateModifiers(e);
    this.state.keysDown.add(e.key);

    // Delete key handling
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.handleDelete();
    }

    // Chat toggle (Enter or /)
    if (e.key === 'Enter' && !this.state.modifiers.ctrl && !e.repeat) {
      // Only toggle if no input is focused
      const activeElement = document.activeElement;
      if (
        !activeElement ||
        (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')
      ) {
        sceneEvents.emit('command:toggle-chat', { open: true });
      }
    }

    if (e.key === '/' && !e.repeat) {
      const activeElement = document.activeElement;
      if (
        !activeElement ||
        (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        sceneEvents.emit('command:toggle-chat', { open: true });
      }
    }

    // Settings shortcut (Ctrl+,)
    if (e.key === ',' && this.state.modifiers.ctrl) {
      e.preventDefault();
      sceneEvents.emit('command:toggle-settings', { open: true });
    }

    // Escape to cancel selection/drag/boundary/beacon
    if (e.key === 'Escape') {
      if (this.boundaryDrawState.isActive && this.boundaryDrawState.vertices.length > 0) {
        // Cancel boundary drawing
        this.cancelBoundaryDraw();
        // Restart for new drawing
        this.startBoundaryDraw();
        return;
      }
      if (this.beaconPlaceState.isActive) {
        // Switch back to select mode
        this.setToolMode('select');
        sceneEvents.emit('tool:changed', { mode: 'select' });
        return;
      }
      if (this.dragState.isActive) {
        // Cancel drag - restore original positions would need to be tracked
        this.dragState = {
          isActive: false,
          objectIds: [],
          startPosition: null,
          dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        };
      }
      if (this.selectionBox.isActive) {
        this.selectionBox.isActive = false;
        sceneEvents.emit('selection:box:end', {});
      }
    }

    // Select all (Ctrl+A)
    if (e.key === 'a' && this.state.modifiers.ctrl) {
      e.preventDefault();
      this.selectAll();
    }

    // Tool mode shortcuts
    if (!this.state.modifiers.ctrl && !this.state.modifiers.alt) {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && 
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      
      if (!isInputFocused) {
        switch (e.key.toLowerCase()) {
          case 'v':
            this.setToolMode('select');
            sceneEvents.emit('tool:changed', { mode: 'select' });
            break;
          case 'h':
            this.setToolMode('pan');
            sceneEvents.emit('tool:changed', { mode: 'pan' });
            break;
          case 'b':
            this.setToolMode('boundary');
            sceneEvents.emit('tool:changed', { mode: 'boundary' });
            break;
          case 'p':
            this.setToolMode('beacon');
            sceneEvents.emit('tool:changed', { mode: 'beacon' });
            break;
          case 'n':
            // Create new snippet at cursor or center
            this.createSnippetAtCursor();
            break;
        }
      }
    }

    // Enter to complete boundary drawing
    if (e.key === 'Enter' && this.boundaryDrawState.isActive && this.boundaryDrawState.vertices.length >= 3) {
      e.preventDefault();
      this.completeBoundaryDraw();
    }
  }

  private handleDelete(): void {
    if (!this.objectManager) return;

    const selectedIds = this.objectManager.getSelectedIds();
    if (selectedIds.length === 0) return;

    // Emit delete request event - UI will handle confirmation
    sceneEvents.emit('input:delete', { objectIds: selectedIds });
  }

  private selectAll(): void {
    if (!this.objectManager) return;

    const allObjects = this.objectManager.getAllObjectData();
    const allIds = allObjects.map((obj) => obj.id);
    const previousSelection = this.objectManager.getSelectedIds();

    this.objectManager.selectObjects(allIds, false);
    this.emitSelectionChanged(allIds, previousSelection);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.updateModifiers(e);
    this.state.keysDown.delete(e.key);
  }

  public getState(): InputState {
    return { ...this.state };
  }

  public getKeysDown(): Set<string> {
    return this.state.keysDown;
  }

  public getMouse(): THREE.Vector2 {
    return this.mouse.clone();
  }

  public getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  public updateRaycaster(camera: THREE.Camera): void {
    this.raycaster.setFromCamera(this.mouse, camera);
  }

  public getSelectionBox(): SelectionBox | null {
    return this.selectionBox.isActive ? { ...this.selectionBox } : null;
  }

  public isDragging(): boolean {
    return this.dragState.isActive;
  }

  public isDrawingBoundary(): boolean {
    return this.boundaryDrawState.isActive;
  }

  public getBoundaryVertices(): Vector3[] {
    return [...this.boundaryDrawState.vertices];
  }

  public isPlacingBeacon(): boolean {
    return this.beaconPlaceState.isActive;
  }

  /**
   * Create a new snippet at the cursor position or center of view
   */
  private createSnippetAtCursor(): void {
    let position: Vector3;

    // Try to get position from mouse raycast
    if (this.camera) {
      const intersection = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
        position = {
          x: intersection.x,
          y: 0.5,
          z: intersection.z,
        };
      } else {
        // Default to center of view
        position = { x: 0, y: 0.5, z: 0 };
      }
    } else {
      position = { x: 0, y: 0.5, z: 0 };
    }

    // Emit event for ObjectManager to create the snippet
    sceneEvents.emit('command:spawn-object', {
      type: 'snippet',
      position,
      data: {
        title: 'New Snippet',
        content: '',
        tags: [],
      },
    });
  }
}
