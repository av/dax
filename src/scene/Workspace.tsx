import { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';
import type { FileNode } from '@/types';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { calculateLayout } from '@/scene/layout/spatialLayout';
import FileInstances from '@/scene/FileInstances';
import DirectoryPlatform from '@/scene/DirectoryPlatform';
import CameraController from '@/scene/CameraController';
import AgentEntity from '@/scene/AgentEntity';
import SelectionBox from '@/scene/SelectionBox';
import FileDragger from '@/scene/FileDragger';
import PerformanceMonitor from '@/scene/PerformanceMonitor';
import { theme } from '@/theme';

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

export default function Workspace() {
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const nodes = useFileTreeStore((s) => s.nodes);
  const rootChildren = useFileTreeStore((s) => s.rootChildren);

  // Compute layout from the tree structure
  const layoutMap = useMemo(() => {
    const tree = buildRootTree(rootChildren, nodes);
    return calculateLayout(tree, rootPath);
  }, [nodes, rootChildren, rootPath]);

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

  // ── Staggered file entrance animation ────────────────
  // 20ms per file, max 2s total
  const [visibleFileCount, setVisibleFileCount] = useState(0);
  const hasAnimated = useRef(false);
  const filesCount = files.length;

  useEffect(() => {
    // Only animate once, and only when we have files
    if (filesCount === 0 || hasAnimated.current) {
      setVisibleFileCount(filesCount);
      return;
    }
    hasAnimated.current = true;

    const delayPerFile = Math.min(20, filesCount > 0 ? 2000 / filesCount : 20);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleFileCount(count);
      if (count >= filesCount) {
        clearInterval(interval);
      }
    }, delayPerFile);

    return () => clearInterval(interval);
  }, [filesCount]);

  // Only show the first N files during stagger
  const visibleFiles = useMemo(() => {
    if (visibleFileCount >= files.length) return files;
    return files.slice(0, visibleFileCount);
  }, [files, visibleFileCount]);

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

      {/* Fog for depth cue */}
      <fog attach="fog" args={[theme.colors.sceneBackground, 50, 250]} />

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

      {/* Root platform */}
      {mergedLayoutMap.has('__root__') && (
        <DirectoryPlatform
          name={rootPath?.split('/').pop() ?? 'root'}
          entry={mergedLayoutMap.get('__root__')!}
          depth={0}
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
          />
        );
      })}

      {/* File instances (batched rendering) */}
      {visibleFiles.length > 0 && (
        <FileInstances files={visibleFiles} layoutMap={mergedLayoutMap} />
      )}

      {/* AI Agent entity */}
      <AgentEntity />

      {/* Drag-box selection overlay */}
      <SelectionBox layoutMap={mergedLayoutMap} />

      {/* Drag-to-reposition for selected files */}
      <FileDragger layoutMap={mergedLayoutMap} />

      {/* Performance monitor (dev mode stats collection) */}
      {import.meta.env.DEV && <PerformanceMonitor />}

      {/* Performance: auto DPR + preload assets */}
      <AdaptiveDpr pixelated />
      <Preload all />
    </Canvas>
  );
}
