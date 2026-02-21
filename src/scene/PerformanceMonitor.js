import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
export const usePerformanceStore = create((set) => ({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    update: (stats) => set(stats),
}));
// ── PerformanceMonitor (mount inside Canvas) ───────────
const SAMPLE_SIZE = 60;
const UPDATE_INTERVAL = 0.25; // seconds between store updates
export default function PerformanceMonitor() {
    const { gl } = useThree();
    const fpsBuffer = useRef([]);
    const elapsed = useRef(0);
    useFrame((_state, delta) => {
        // Clamp delta to avoid outlier spikes (e.g. tab switch)
        const clampedDelta = Math.min(delta, 0.5);
        const instantFps = clampedDelta > 0 ? 1 / clampedDelta : 0;
        const buf = fpsBuffer.current;
        buf.push(instantFps);
        if (buf.length > SAMPLE_SIZE) {
            buf.shift();
        }
        elapsed.current += clampedDelta;
        if (elapsed.current < UPDATE_INTERVAL)
            return;
        elapsed.current = 0;
        // Compute smoothed FPS (rolling average)
        const avgFps = buf.length > 0
            ? buf.reduce((sum, v) => sum + v, 0) / buf.length
            : 0;
        const { render, memory } = gl.info;
        usePerformanceStore.getState().update({
            fps: Math.round(avgFps),
            drawCalls: render.calls,
            triangles: render.triangles,
            geometries: memory.geometries,
            textures: memory.textures,
        });
    });
    return null;
}
