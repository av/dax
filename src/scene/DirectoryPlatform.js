import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
const DEPTH_COLORS = [
    '#1a1b26',
    '#1e2030',
    '#222436',
    '#262840',
    '#2a2c4a',
    '#2e3054',
];
/**
 * A flat rectangular platform representing a directory.
 * Slightly transparent with a subtle grid wireframe overlay.
 */
export default function DirectoryPlatform({ name, entry, depth }) {
    const [px, py, pz] = entry.position;
    const [width, platformDepth] = entry.platformSize ?? [10, 10];
    const colorIndex = Math.min(depth, DEPTH_COLORS.length - 1);
    const baseColor = DEPTH_COLORS[colorIndex];
    const gridTexture = useMemo(() => {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, size, size);
            ctx.strokeStyle = 'rgba(122, 162, 247, 0.08)';
            ctx.lineWidth = 1;
            const step = size / 16;
            for (let i = 0; i <= 16; i++) {
                const p = i * step;
                ctx.beginPath();
                ctx.moveTo(p, 0);
                ctx.lineTo(p, size);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, p);
                ctx.lineTo(size, p);
                ctx.stroke();
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(width / 4, platformDepth / 4);
        return tex;
    }, [baseColor, width, platformDepth]);
    return (_jsxs("group", { position: [px, py, pz], children: [_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [width, platformDepth] }), _jsx("meshStandardMaterial", { map: gridTexture, transparent: true, opacity: 0.85, roughness: 0.9, metalness: 0, side: THREE.DoubleSide })] }), _jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, 0.01, 0], children: [_jsx("planeGeometry", { args: [width, platformDepth] }), _jsx("meshBasicMaterial", { color: "#7aa2f7", wireframe: true, transparent: true, opacity: 0.06 })] }), _jsx(Text, { position: [0, 0.3, -platformDepth / 2 - 0.5], fontSize: 0.6, color: "#7aa2f7", anchorX: "center", anchorY: "bottom", font: "/fonts/inter-regular.ttf", children: name })] }));
}
