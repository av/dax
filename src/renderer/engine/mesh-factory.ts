/**
 * Mesh factory — creates 3D meshes for files and folders.
 *
 * - Files: rounded box with PBR material colored by file category, filename label
 * - Folders: open-top container box (slightly transparent) with folder name label
 * - Labels: Babylon.js GUI AdvancedDynamicTexture on a plane above the mesh
 * - Physics bodies: dynamic for files, kinematic for folders
 * - Shadow casting and receiving on all objects
 */
import {
  MeshBuilder,
  Vector3,
  type Scene,
  type Mesh,
  TransformNode,
  Color3,
  type AbstractMesh,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Rectangle } from '@babylonjs/gui';
import { getMaterial, getCategoryColor3 } from './materials';
import { addFilePhysicsBody, addFolderPhysicsBody } from './physics';
import { enableShadows } from './lighting';
import { setupLOD } from './lod';
import type { FileEntry, FileCategory } from '@shared/file-types';

/** File box dimensions */
const FILE_WIDTH = 1.2;
const FILE_HEIGHT = 0.8;
const FILE_DEPTH = 0.8;

/** Folder container dimensions */
const FOLDER_WIDTH = 2.0;
const FOLDER_HEIGHT = 0.3;
const FOLDER_DEPTH = 2.0;
const FOLDER_WALL_THICKNESS = 0.05;

/** Label plane height offset above the mesh */
const LABEL_Y_OFFSET = 0.6;

/** Map to track mesh→path and path→mesh relationships */
const meshByPath = new Map<string, TransformNode>();

/**
 * Create a 3D mesh for a file entry.
 * Returns a TransformNode that contains the box mesh and label plane.
 */
export function createFileMesh(
  entry: FileEntry,
  scene: Scene,
  position?: Vector3,
): TransformNode {
  // Root transform node
  const root = new TransformNode(`file_${entry.path}`, scene);

  // File box mesh
  const box = MeshBuilder.CreateBox(
    `filebox_${entry.path}`,
    { width: FILE_WIDTH, height: FILE_HEIGHT, depth: FILE_DEPTH },
    scene,
  );
  box.parent = root;
  box.position.y = FILE_HEIGHT / 2; // Sit on the ground

  // Apply material based on file category
  box.material = getMaterial(scene, entry.category);

  // Store path as metadata
  box.metadata = { path: entry.path, type: 'file', category: entry.category };

  // Enable shadow casting and receiving
  enableShadows(box);

  // Setup LOD levels based on file category
  setupLOD(box, entry.category, scene);

  // Add dynamic physics body (files fall under gravity)
  addFilePhysicsBody(box, scene);

  // Create label
  createLabel(entry.name, root, scene, FILE_HEIGHT + LABEL_Y_OFFSET, entry.category);

  // Set position
  if (position) {
    root.position = position;
  }

  // Track in map
  meshByPath.set(entry.path, root);

  return root;
}

/**
 * Create a 3D mesh for a folder entry.
 * Open-top container box with folder name label.
 */
export function createFolderMesh(
  entry: FileEntry,
  scene: Scene,
  position?: Vector3,
): TransformNode {
  const root = new TransformNode(`folder_${entry.path}`, scene);

  // Floor of the container
  const floor = MeshBuilder.CreateBox(
    `folderfloor_${entry.path}`,
    { width: FOLDER_WIDTH, height: FOLDER_WALL_THICKNESS, depth: FOLDER_DEPTH },
    scene,
  );
  floor.parent = root;
  floor.position.y = FOLDER_WALL_THICKNESS / 2;

  const folderMat = getMaterial(scene, 'folder');
  floor.material = folderMat;
  floor.metadata = { path: entry.path, type: 'folder' };

  // Enable shadow casting and receiving on floor
  enableShadows(floor);

  // Add kinematic physics body to floor (folders don't fall)
  addFolderPhysicsBody(floor, scene);

  // Four walls (open top)
  const wallPositions = [
    { w: FOLDER_WIDTH, h: FOLDER_HEIGHT, d: FOLDER_WALL_THICKNESS, x: 0, z: FOLDER_DEPTH / 2 },
    { w: FOLDER_WIDTH, h: FOLDER_HEIGHT, d: FOLDER_WALL_THICKNESS, x: 0, z: -FOLDER_DEPTH / 2 },
    { w: FOLDER_WALL_THICKNESS, h: FOLDER_HEIGHT, d: FOLDER_DEPTH, x: FOLDER_WIDTH / 2, z: 0 },
    { w: FOLDER_WALL_THICKNESS, h: FOLDER_HEIGHT, d: FOLDER_DEPTH, x: -FOLDER_WIDTH / 2, z: 0 },
  ];

  wallPositions.forEach((wp, i) => {
    const wall = MeshBuilder.CreateBox(
      `folderwall_${entry.path}_${i}`,
      { width: wp.w, height: wp.h, depth: wp.d },
      scene,
    );
    wall.parent = root;
    wall.position.set(wp.x, FOLDER_WALL_THICKNESS + wp.h / 2, wp.z);
    wall.material = folderMat;
    wall.visibility = 0.6; // Semi-transparent walls
    enableShadows(wall);
  });

  // Create label
  createLabel(entry.name, root, scene, FOLDER_HEIGHT + LABEL_Y_OFFSET, 'folder');

  if (position) {
    root.position = position;
  }

  meshByPath.set(entry.path, root);
  return root;
}

/**
 * Create a floating text label above a mesh.
 * Uses Babylon.js GUI AdvancedDynamicTexture on a plane.
 */
function createLabel(
  text: string,
  parent: TransformNode,
  scene: Scene,
  yOffset: number,
  category: FileCategory | 'folder',
): void {
  // Create a plane for the label
  const labelPlane = MeshBuilder.CreatePlane(
    `label_${parent.name}`,
    { width: 2, height: 0.4 },
    scene,
  );
  labelPlane.parent = parent;
  labelPlane.position.y = yOffset;
  labelPlane.billboardMode = 7; // BILLBOARDMODE_ALL

  // Create GUI texture on the plane
  const advancedTexture = AdvancedDynamicTexture.CreateForMesh(
    labelPlane as Mesh,
    512,
    128,
  );

  // Background rectangle
  const bg = new Rectangle('labelBg');
  bg.width = '100%';
  bg.height = '100%';
  bg.cornerRadius = 12;
  bg.thickness = 0;
  bg.background = 'rgba(20, 20, 30, 0.75)';
  advancedTexture.addControl(bg);

  // Text block
  const textBlock = new TextBlock('labelText', truncateLabel(text));
  textBlock.color = colorToHex(getCategoryColor3(category));
  textBlock.fontSize = 48;
  textBlock.fontFamily = 'monospace';
  textBlock.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
  textBlock.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
  bg.addControl(textBlock);
}

/**
 * Truncate a label to fit visually.
 */
function truncateLabel(text: string, maxLen: number = 20): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 2) + '..';
}

/**
 * Convert a Color3 to a hex string.
 */
function colorToHex(c: Color3): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Create a mesh for a FileEntry (dispatches to file or folder).
 */
export function createMeshForEntry(
  entry: FileEntry,
  scene: Scene,
  position?: Vector3,
): TransformNode {
  if (entry.type === 'folder') {
    return createFolderMesh(entry, scene, position);
  }
  return createFileMesh(entry, scene, position);
}

/**
 * Get a mesh by its filesystem path.
 */
export function getMeshByPath(path: string): TransformNode | undefined {
  return meshByPath.get(path);
}

/**
 * Remove a mesh by its filesystem path.
 * Disposes all child meshes and removes from tracking map.
 */
export function disposeMeshByPath(path: string): TransformNode | undefined {
  const node = meshByPath.get(path);
  if (node) {
    meshByPath.delete(path);
    node.dispose(false, true); // dispose children + materials
  }
  return node;
}

/**
 * Update the label text on a mesh (e.g., after rename).
 */
export function updateMeshLabel(path: string, newName: string, scene: Scene): void {
  const node = meshByPath.get(path);
  if (!node) return;

  // Find the label plane child
  for (const child of node.getChildren()) {
    if (child.name.startsWith('label_')) {
      // Dispose old label and create new one
      child.dispose(false, true);
      break;
    }
  }

  // Get category from the first mesh child
  let category: FileCategory | 'folder' = 'unknown';
  for (const child of node.getChildren()) {
    if ((child as { metadata?: { category?: FileCategory; type?: string } }).metadata?.category) {
      category = (child as { metadata: { category: FileCategory } }).metadata.category;
      break;
    }
    if ((child as { metadata?: { type?: string } }).metadata?.type === 'folder') {
      category = 'folder';
      break;
    }
  }

  const yOffset = category === 'folder'
    ? FOLDER_HEIGHT + LABEL_Y_OFFSET
    : FILE_HEIGHT + LABEL_Y_OFFSET;

  createLabel(newName, node, scene, yOffset, category);
}

/**
 * Rename a mesh entry in the tracking map.
 */
export function renameMesh(oldPath: string, newPath: string): void {
  const node = meshByPath.get(oldPath);
  if (node) {
    meshByPath.delete(oldPath);
    meshByPath.set(newPath, node);
    node.name = node.name.replace(oldPath, newPath);
  }
}

/**
 * Get the total number of tracked meshes.
 */
export function getMeshCount(): number {
  return meshByPath.size;
}

/**
 * Clear all mesh tracking (call on scene dispose).
 */
export function clearMeshTracking(): void {
  meshByPath.clear();
}
