import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useCameraFocusStore } from '@/scene/CameraController';
export const useDragStore = create(() => ({
    isDragging: false,
    dragPositions: new Map(),
    dragEndTime: 0,
}));
// ── Constants ──────────────────────────────────────────
/** Minimum pixel distance before a click becomes a drag. */
const DRAG_THRESHOLD = 5;
// ── Reusable temp objects (avoid GC pressure) ──────────
const _ndc = new THREE.Vector2();
const _intersect = new THREE.Vector3();
/**
 * Invisible controller that lets users drag already-selected files
 * to new positions on the XZ plane. Commits position overrides to
 * the file-tree store on release.
 */
export default function FileDragger({ layoutMap }) {
    const { gl, camera, scene, raycaster } = useThree();
    // Drag tracking refs — mutated during pointer events, no React renders
    const potentialDrag = useRef(false);
    const dragActive = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const dragStartHit = useRef(new THREE.Vector3());
    const initialPositions = useRef(new Map());
    // Keep layoutMap ref fresh so event closures always see the latest value
    const layoutRef = useRef(layoutMap);
    layoutRef.current = layoutMap;
    useEffect(() => {
        const canvas = gl.domElement;
        /** Compute NDC from a pointer event relative to the canvas. */
        const getNDC = (e) => {
            const rect = canvas.getBoundingClientRect();
            _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
            return _ndc;
        };
        /** Raycast pointer against the drag ground plane. */
        const hitGroundPlane = (e) => {
            raycaster.setFromCamera(getNDC(e), camera);
            return raycaster.ray.intersectPlane(dragPlane.current, _intersect);
        };
        // ── Pointer handlers ─────────────────────────────────
        const onPointerDown = (e) => {
            if (e.button !== 0)
                return;
            // Raycast into scene to find an instanced-mesh hit
            raycaster.setFromCamera(getNDC(e), camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            const hit = intersects.find((i) => i.object instanceof THREE.InstancedMesh &&
                i.instanceId !== undefined);
            if (!hit || hit.instanceId === undefined)
                return;
            // Map (mesh, instanceId) → fileId via userData set by FileInstances
            const fileIds = hit.object.userData
                .fileIds;
            if (!fileIds)
                return;
            const fileId = fileIds[hit.instanceId];
            if (!fileId)
                return;
            // Only initiate a potential drag on already-selected files
            const { selectedIds } = useSelectionStore.getState();
            if (!selectedIds.has(fileId))
                return;
            // Determine ground-plane Y from the file's current position
            const layout = layoutRef.current;
            const posOverrides = useFileTreeStore.getState().positionOverrides;
            const filePos = posOverrides.get(fileId) ??
                layout.get(fileId)?.position ?? [0, 0, 0];
            dragPlane.current.set(new THREE.Vector3(0, 1, 0), -filePos[1]);
            // Compute the ground-plane intersection at the click point
            const startHit = raycaster.ray.intersectPlane(dragPlane.current, _intersect);
            if (!startHit)
                return;
            dragStartHit.current.copy(startHit);
            // Record initial positions of ALL selected files
            const initMap = new Map();
            for (const id of selectedIds) {
                const override = posOverrides.get(id);
                const entry = layout.get(id);
                const p = override ?? entry?.position ?? [0, 0, 0];
                initMap.set(id, [p[0], p[1], p[2]]);
            }
            initialPositions.current = initMap;
            potentialDrag.current = true;
            dragActive.current = false;
            startMouse.current = { x: e.clientX, y: e.clientY };
        };
        const onPointerMove = (e) => {
            if (!potentialDrag.current)
                return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            // Activate drag once the pixel threshold is exceeded
            if (!dragActive.current) {
                if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD)
                    return;
                dragActive.current = true;
                useDragStore.setState({ isDragging: true });
                useCameraFocusStore.getState().setOrbitEnabled(false);
            }
            // Raycast current pointer against the ground plane
            const current = hitGroundPlane(e);
            if (!current)
                return;
            const deltaX = current.x - dragStartHit.current.x;
            const deltaZ = current.z - dragStartHit.current.z;
            // Compute new positions for all dragged files (maintain relative offsets)
            const newPositions = new Map();
            for (const [id, initPos] of initialPositions.current) {
                newPositions.set(id, [
                    initPos[0] + deltaX,
                    initPos[1],
                    initPos[2] + deltaZ,
                ]);
            }
            useDragStore.setState({ dragPositions: newPositions });
        };
        const onPointerUp = () => {
            if (!potentialDrag.current)
                return;
            potentialDrag.current = false;
            if (dragActive.current) {
                dragActive.current = false;
                // Commit final positions to the persistent store
                const { dragPositions } = useDragStore.getState();
                const store = useFileTreeStore.getState();
                for (const [id, pos] of dragPositions) {
                    store.setPositionOverride(id, pos);
                }
                // Mark drag as finished (dragEndTime suppresses spurious clicks)
                useDragStore.setState({
                    isDragging: false,
                    dragEndTime: Date.now(),
                });
                // Clear transient drag positions after a frame so the committed
                // overrides have time to propagate through React renders.
                requestAnimationFrame(() => {
                    useDragStore.setState({ dragPositions: new Map() });
                });
                // Re-enable camera orbit
                useCameraFocusStore.getState().setOrbitEnabled(true);
            }
        };
        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [gl, camera, scene, raycaster]);
    // Renders nothing — purely an event-driven controller
    return null;
}
