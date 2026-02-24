import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';
import { Physics, CuboidCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import type { FileNode } from '@/types';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { calculateLayout } from '@/scene/layout/spatialLayout';
import FileInstances from '@/scene/FileInstances';
import DirectoryPlatform from '@/scene/DirectoryPlatform';
import CameraController from '@/scene/CameraController';
import AgentEntity from '@/scene/AgentEntity';
import SelectionBox from '@/scene/SelectionBox';
import FileDragger, { useDragStore } from '@/scene/FileDragger';
import PerformanceMonitor from '@/scene/PerformanceMonitor';
import { theme } from '@/theme';

// ── Helpers ──────────────────────────────

/**
 * Collect all file nodes (type === 'file') from the flat map.
 */
function collectFiles(nodes: Map<string, FileNode>): FileNode[] {
  const files: FileNode[] = [];
  for (const node of nodes.values()) {
    if (node.type === 'file') {
      files.push(node);
    }
  }
  return files;
}

/**
 * Collect all directory nodes from the flat map.
 */
function collectDirectories(nodes: Map<string, FileNode>): FileNode[] {
  const dirs: FileNode[] = [];
  for (const node of nodes.values()) {
    if (node.type === 'directory') {
      dirs.push(node);
    }
  }
  return dirs;
}

/**
 * Compute the depth of a directory relative to rootPath.
 */
function getDepth(dirPath: string, rootPath: string): number {
  const relative = dirPath.startsWith(rootPath)
    ? dirPath.slice(rootPath.length)
    : dirPath;
  return relative.split('/').filter(Boolean).length;
}

/**
 * Build tree from the flat store for layout calculation.
 */
function buildRootTree(
  rootChildren: string[],
  nodes: Map<string, FileNode>,
): FileNode[] {
  return rootChildren
    .map((id) => nodes.get(id))
    .filter((n): n is FileNode => n !== undefined);
}

// ── Dynamic Camera Far Clip ──────────────

function DynamicCamera({ farClip }: { farClip: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.far = farClip;
    camera.updateProjectionMatrix();
  }, [camera, farClip]);
  return null;
}

// ── Component ────────────────────────────

export default function Workspace() {
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const dropTargetDirId = useDragStore((s) => s.dropTargetDirId);
  const nodes = useFileTreeStore((s) => s.nodes);
  const rootChildren = useFileTreeStore((s) => s.rootChildren);

  // Compute layout from the tree structure
  const layoutResult = useMemo(() => {
    const tree = buildRootTree(rootChildren, nodes);
    return calculateLayout(tree, rootPath);
  }, [nodes, rootChildren, rootPath]);

  const layoutMap = layoutResult.entries;
  const workspaceBounds = layoutResult.bounds;

  // Store workspace bounds for CameraController and Minimap
  useEffect(() => {
    useFileTreeStore.getState().setWorkspaceBounds(workspaceBounds);
  }, [workspaceBounds]);

  // Merge user-defined position overrides into the layout
  const positionOverrides = useFileTreeStore((s) => s.positionOverrides);

  const mergedLayoutMap = useMemo(() => {
    if (positionOverrides.size === 0) return layoutMap;
    const merged = new Map(layoutMap);
    for (const [id, pos] of positionOverrides) {
      const existing = merged.get(id);
      if (existing) {
        merged.set(id, { ...existing, position: pos });
      }
    }
    return merged;
  }, [layoutMap, positionOverrides]);

  // Separate files and directories
  const files = useMemo(() => collectFiles(nodes), [nodes]);
  const directories = useMemo(() => collectDirectories(nodes), [nodes]);

  // Physics rigid body refs — passed to FileInstances for imperative access
  const rigidBodyRef = useRef<(RapierRigidBody | null)[] | null>(null);
  const fileIdToIndex = useMemo(
    () => new Map(files.map((f, i) => [f.id, i])),
    [files],
  );

  // Dynamic fog, clip, and floor based on workspace bounds
  const fogNear = Math.max(workspaceBounds.extent * 0.3, 50);
  const fogEnd = Math.max(workspaceBounds.extent * 2.5, 250);
  const farClip = Math.max(workspaceBounds.extent * 4, 500);
  const floorSize = Math.max(workspaceBounds.extent * 2, 500);

  return (
    <Canvas
      camera={{ position: [0, 15, 25], fov: 55, near: 0.1, far: 500 }}
      style={{ width: '100vw', height: '100vh', background: theme.colors.sceneBackground }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[theme.colors.sceneBackground]} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={0.8}
        castShadow={false}
      />
      <directionalLight
        position={[-10, 20, -10]}
        intensity={0.3}
      />

      {/* Dynamic fog for depth cue */}
      <fog attach="fog" args={[theme.colors.sceneBackground, fogNear, fogEnd]} />

      {/* Dynamic far clip plane */}
      <DynamicCamera farClip={farClip} />

      {/* Subtle environment lighting (self-contained, no external fetch) */}
      <hemisphereLight
        args={[theme.colors.bgSurface, theme.colors.bgBase, 0.4]}
      />
      <pointLight
        position={[-20, 40, -20]}
        intensity={0.15}
        color={theme.colors.accentPrimary}
        decay={2}
      />

      {/* Camera controls */}
      <CameraController />

      <Suspense fallback={null}>
        <Physics gravity={[0, -4, 0]} timeStep="vary" debug={import.meta.env.DEV}>
          {/* Dynamic world floor — prevents escaped cards */}
          <CuboidCollider args={[floorSize, 0.1, floorSize]} position={[0, -20, 0]} />

          {/* Root platform */}
          {mergedLayoutMap.has('__root__') && (
            <DirectoryPlatform
              name={rootPath?.split('/').pop() ?? 'root'}
              entry={mergedLayoutMap.get('__root__')!}
              depth={0}
              isDropTarget={dropTargetDirId === '__root__'}
            />
          )}

          {/* Directory platforms */}
          {directories.map((dir) => {
            const entry = mergedLayoutMap.get(dir.id);
            if (!entry || !entry.platformSize) return null;
            return (
              <DirectoryPlatform
                key={dir.id}
                name={dir.name}
                entry={entry}
                depth={getDepth(dir.path, rootPath ?? '')}
                isDropTarget={dropTargetDirId === dir.id}
              />
            );
          })}

          {/* File instances (batched rendering with Rapier physics) */}
          {files.length > 0 && (
            <FileInstances
              files={files}
              layoutMap={mergedLayoutMap}
              rigidBodyRef={rigidBodyRef}
              fileIdToIndex={fileIdToIndex}
            />
          )}

          {/* AI Agent entity */}
          <AgentEntity />

          {/* Drag-box selection overlay */}
          <SelectionBox
            layoutMap={mergedLayoutMap}
            rigidBodyRef={rigidBodyRef}
            fileIdToIndex={fileIdToIndex}
          />

          {/* Drag-to-reposition for selected files */}
          <FileDragger
            layoutMap={mergedLayoutMap}
            rigidBodyRef={rigidBodyRef}
            fileIdToIndex={fileIdToIndex}
            directories={directories}
            rootPath={rootPath}
          />

          {/* Performance monitor (dev mode stats collection) */}
          {import.meta.env.DEV && <PerformanceMonitor />}
        </Physics>
      </Suspense>

      {/* Performance: auto DPR + preload assets */}
      <AdaptiveDpr pixelated />
      <Preload all />
    </Canvas>
  );
}
