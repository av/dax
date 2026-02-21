import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';
export const useCameraFocusStore = create((set) => ({
    target: null,
    orbitEnabled: true,
    setFocusTarget: (position) => set({ target: new THREE.Vector3(position[0], position[1], position[2]) }),
    clearFocusTarget: () => set({ target: null }),
    setOrbitEnabled: (enabled) => set({ orbitEnabled: enabled }),
}));
// ── CameraController component ─────────────────────────
const _lerpTarget = new THREE.Vector3();
// Overview position the camera animates to on mount
const OVERVIEW_POSITION = new THREE.Vector3(0, 20, 35);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const INTRO_LERP_SPEED = 0.035;
export default function CameraController() {
    const controlsRef = useRef(null);
    const { camera } = useThree();
    const target = useCameraFocusStore((s) => s.target);
    const clearFocusTarget = useCameraFocusStore((s) => s.clearFocusTarget);
    const orbitEnabled = useCameraFocusStore((s) => s.orbitEnabled);
    // Smooth initial camera intro animation
    const [introComplete, setIntroComplete] = useState(false);
    const handleControlsChange = useCallback(() => {
        // If user manually moves the camera, cancel any in-progress focus animation
        // (only clear if we're very close to the target already)
    }, []);
    useFrame(() => {
        const controls = controlsRef.current;
        if (!controls)
            return;
        // Initial overview fly-in
        if (!introComplete) {
            camera.position.lerp(OVERVIEW_POSITION, INTRO_LERP_SPEED);
            controls.target.lerp(OVERVIEW_TARGET, INTRO_LERP_SPEED);
            controls.update();
            if (camera.position.distanceTo(OVERVIEW_POSITION) < 0.1) {
                setIntroComplete(true);
            }
            return;
        }
        if (!target)
            return;
        // Smooth lerp camera target to the focus position
        _lerpTarget.copy(controls.target);
        _lerpTarget.lerp(target, 0.05);
        controls.target.copy(_lerpTarget);
        // Move camera toward a good viewing position
        const desiredCamPos = target.clone().add(new THREE.Vector3(0, 8, 12));
        camera.position.lerp(desiredCamPos, 0.05);
        controls.update();
        // If close enough, stop the animation
        if (controls.target.distanceTo(target) < 0.05) {
            controls.target.copy(target);
            clearFocusTarget();
        }
    });
    return (_jsx(OrbitControls, { ref: controlsRef, enabled: orbitEnabled, enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 200, maxPolarAngle: Math.PI / 2.1, onChange: handleControlsChange }));
}
