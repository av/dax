import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useAgentStore } from '@/stores/agentStore';
import { getFileColor } from '@/utils/fileClassification';
import { calculateLayout } from '@/scene/layout/spatialLayout';
import { useCameraFocusStore, getCameraLookAt } from '@/scene/CameraController';
import type { FileNode } from '@/types';
import { theme } from '@/theme';

const MINIMAP_SIZE = 200;
const DOT_RADIUS = 3;
const VIEWPORT_COLOR = `${theme.colors.accentPrimary}80`;
const BG_COLOR = `${theme.colors.bgBase}BF`;
const BORDER_COLOR = `${theme.colors.borderDefault}CC`;

function buildRootTree(
  rootChildren: string[],
  nodes: Map<string, FileNode>,
): FileNode[] {
  return rootChildren
    .map((id) => nodes.get(id))
    .filter((n): n is FileNode => n !== undefined);
}

/**
 * 2D HTML Canvas minimap — bottom-left corner.
 * Draws file dots colored by type, camera viewport rect, and click-to-navigate.
 */
export default function Minimap() {
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const nodes = useFileTreeStore((s) => s.nodes);
  const rootChildren = useFileTreeStore((s) => s.rootChildren);

  const layoutResult = useMemo(() => {
    const tree = buildRootTree(rootChildren, nodes);
    return calculateLayout(tree, rootPath);
  }, [nodes, rootChildren, rootPath]);

  const layoutMap = layoutResult.entries;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentPos = useAgentStore((s) => s.currentPosition);

  // Poll camera look-at position every 200ms for viewport indicator
  const [cameraPos, setCameraPos] = useState<[number, number, number]>(() => getCameraLookAt());
  useEffect(() => {
    const id = setInterval(() => {
      setCameraPos(getCameraLookAt());
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Compute world bounds from layout result
  const getBounds = useCallback(() => {
    const b = layoutResult.bounds;
    // Add padding
    const pad = 5;
    return { minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad };
  }, [layoutResult.bounds]);

  // Map world coords to canvas coords
  const worldToCanvas = useCallback(
    (wx: number, wz: number, bounds: ReturnType<typeof getBounds>): [number, number] => {
      const rangeX = bounds.maxX - bounds.minX || 1;
      const rangeZ = bounds.maxZ - bounds.minZ || 1;
      const cx = ((wx - bounds.minX) / rangeX) * MINIMAP_SIZE;
      const cy = ((wz - bounds.minZ) / rangeZ) * MINIMAP_SIZE;
      return [cx, cy];
    },
    [],
  );

  // Canvas-to-world for click navigation
  const canvasToWorld = useCallback(
    (cx: number, cy: number, bounds: ReturnType<typeof getBounds>): [number, number] => {
      const rangeX = bounds.maxX - bounds.minX || 1;
      const rangeZ = bounds.maxZ - bounds.minZ || 1;
      const wx = (cx / MINIMAP_SIZE) * rangeX + bounds.minX;
      const wz = (cy / MINIMAP_SIZE) * rangeZ + bounds.minZ;
      return [wx, wz];
    },
    [],
  );

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = getBounds();

    // Clear
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw file dots
    for (const [id, entry] of layoutMap) {
      if (id === '__root__') continue;
      const node = nodes.get(id);
      if (!node) continue;

      const [cx, cy] = worldToCanvas(entry.position[0], entry.position[2], bounds);

      const isDir = node.type === 'directory';
      ctx.beginPath();
      ctx.arc(cx, cy, isDir ? DOT_RADIUS + 1 : DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isDir ? `${theme.colors.textSecondary}99` : (getFileColor(node.extension) ?? theme.colors.textSecondary);
      ctx.fill();
    }

    // Draw agent position
    const [ax, ay] = worldToCanvas(agentPos[0], agentPos[2], bounds);
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fillStyle = theme.colors.statusSuccess;
    ctx.fill();

    // Draw viewport indicator centered on camera look-at position
    const viewHalf = 15;
    const [v1x, v1y] = worldToCanvas(cameraPos[0] - viewHalf, cameraPos[2] - viewHalf, bounds);
    const [v2x, v2y] = worldToCanvas(cameraPos[0] + viewHalf, cameraPos[2] + viewHalf, bounds);
    ctx.strokeStyle = VIEWPORT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(v1x, v1y, v2x - v1x, v2y - v1y);
  }, [layoutMap, nodes, agentPos, cameraPos, getBounds, worldToCanvas]);

  // Click handler — navigate camera to clicked position
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const bounds = getBounds();
      const [wx, wz] = canvasToWorld(cx, cy, bounds);
      useCameraFocusStore.getState().setFocusTarget([wx, 0, wz]);
    },
    [getBounds, canvasToWorld],
  );

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_SIZE}
      height={MINIMAP_SIZE}
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: 48,
        left: 16,
        width: `${MINIMAP_SIZE}px`,
        height: `${MINIMAP_SIZE}px`,
        borderRadius: '8px',
        border: `1px solid ${BORDER_COLOR}`,
        cursor: 'crosshair',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    />
  );
}
