import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useAgentStore } from '@/stores/agentStore';
import { getFileColor } from '@/utils/fileClassification';
import { calculateLayout } from '@/scene/layout/spatialLayout';
import { useCameraFocusStore } from '@/scene/CameraController';
const MINIMAP_SIZE = 200;
const DOT_RADIUS = 3;
const VIEWPORT_COLOR = 'rgba(122, 162, 247, 0.5)';
const BG_COLOR = 'rgba(10, 10, 15, 0.75)';
const BORDER_COLOR = 'rgba(41, 46, 66, 0.8)';
function buildRootTree(rootChildren, nodes) {
    return rootChildren
        .map((id) => nodes.get(id))
        .filter((n) => n !== undefined);
}
/**
 * 2D HTML Canvas minimap — bottom-left corner.
 * Draws file dots colored by type, camera viewport rect, and click-to-navigate.
 */
export default function Minimap() {
    const rootPath = useFileTreeStore((s) => s.rootPath);
    const nodes = useFileTreeStore((s) => s.nodes);
    const rootChildren = useFileTreeStore((s) => s.rootChildren);
    const layoutMap = useMemo(() => {
        const tree = buildRootTree(rootChildren, nodes);
        return calculateLayout(tree, rootPath);
    }, [nodes, rootChildren, rootPath]);
    const canvasRef = useRef(null);
    const agentPos = useAgentStore((s) => s.currentPosition);
    // Compute world bounds from layout entries
    const getBounds = useCallback(() => {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const entry of layoutMap.values()) {
            const [x, , z] = entry.position;
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (z < minZ)
                minZ = z;
            if (z > maxZ)
                maxZ = z;
        }
        // Fallback for empty layouts
        if (!isFinite(minX)) {
            return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
        }
        // Add padding
        const pad = 5;
        return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
    }, [layoutMap]);
    // Map world coords to canvas coords
    const worldToCanvas = useCallback((wx, wz, bounds) => {
        const rangeX = bounds.maxX - bounds.minX || 1;
        const rangeZ = bounds.maxZ - bounds.minZ || 1;
        const cx = ((wx - bounds.minX) / rangeX) * MINIMAP_SIZE;
        const cy = ((wz - bounds.minZ) / rangeZ) * MINIMAP_SIZE;
        return [cx, cy];
    }, []);
    // Canvas-to-world for click navigation
    const canvasToWorld = useCallback((cx, cy, bounds) => {
        const rangeX = bounds.maxX - bounds.minX || 1;
        const rangeZ = bounds.maxZ - bounds.minZ || 1;
        const wx = (cx / MINIMAP_SIZE) * rangeX + bounds.minX;
        const wz = (cy / MINIMAP_SIZE) * rangeZ + bounds.minZ;
        return [wx, wz];
    }, []);
    // Draw minimap
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const bounds = getBounds();
        // Clear
        ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
        // Background
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
        // Draw file dots
        for (const [id, entry] of layoutMap) {
            if (id === '__root__')
                continue;
            const node = nodes.get(id);
            if (!node)
                continue;
            const [cx, cy] = worldToCanvas(entry.position[0], entry.position[2], bounds);
            const isDir = node.type === 'directory';
            ctx.beginPath();
            ctx.arc(cx, cy, isDir ? DOT_RADIUS + 1 : DOT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = isDir ? 'rgba(86, 95, 137, 0.6)' : (getFileColor(node.extension) ?? '#565f89');
            ctx.fill();
        }
        // Draw agent position
        const [ax, ay] = worldToCanvas(agentPos[0], agentPos[2], bounds);
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#9ece6a';
        ctx.fill();
        // Draw viewport indicator — a small rectangle centered on origin
        // Approximation: use a 30x30 unit viewport centered on the agent
        const viewHalf = 15;
        const [v1x, v1y] = worldToCanvas(agentPos[0] - viewHalf, agentPos[2] - viewHalf, bounds);
        const [v2x, v2y] = worldToCanvas(agentPos[0] + viewHalf, agentPos[2] + viewHalf, bounds);
        ctx.strokeStyle = VIEWPORT_COLOR;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(v1x, v1y, v2x - v1x, v2y - v1y);
    }, [layoutMap, nodes, agentPos, getBounds, worldToCanvas]);
    // Click handler — navigate camera to clicked position
    const handleClick = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const bounds = getBounds();
        const [wx, wz] = canvasToWorld(cx, cy, bounds);
        useCameraFocusStore.getState().setFocusTarget([wx, 0, wz]);
    }, [getBounds, canvasToWorld]);
    return (_jsx("canvas", { ref: canvasRef, width: MINIMAP_SIZE, height: MINIMAP_SIZE, onClick: handleClick, style: {
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
        } }));
}
