import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getFileShape, getFileColor, getFileScale, formatFileSize, formatModifiedDate, } from '@/utils/fileClassification';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useDragStore } from '@/scene/FileDragger';
// LOD: instances farther than this from the camera start scaling down
const LOD_NEAR = 40;
const LOD_FAR = 120;
const LOD_MIN_SCALE = 0.3;
// Beyond this distance, files are rendered as simple colored points instead of 3D geometry
const LOD_BILLBOARD = 200;
// Selection lift height (world units)
const SELECTION_LIFT = 0.5;
// ── Shared geometries ──────────────────────────────────
const SHARED_GEOMETRIES = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 16, 16),
    cylinder: new THREE.CylinderGeometry(0.4, 0.4, 1, 16),
    torus: new THREE.TorusGeometry(0.4, 0.15, 12, 24),
};
// ── Hover label component ──────────────────────────────
function HoverLabel({ node, position }) {
    const color = getFileColor(node.extension);
    return (_jsx(Html, { position: [position[0], position[1] + 2, position[2]], distanceFactor: 15, style: { pointerEvents: 'none' }, children: _jsxs("div", { style: {
                background: 'rgba(10, 10, 15, 0.92)',
                color: '#e0e0e0',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
                whiteSpace: 'nowrap',
                border: `1px solid ${color}`,
                boxShadow: `0 0 12px ${color}44`,
            }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: '2px' }, children: node.name }), _jsxs("div", { style: { opacity: 0.7, fontSize: '11px' }, children: [formatFileSize(node.sizeBytes), " \u00B7 ", formatModifiedDate(node.modifiedAt)] })] }) }));
}
// ── Instance group for a single shape type ─────────────
const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();
function FileInstanceGroup({ shape, files, layoutMap }) {
    const meshRef = useRef(null);
    const { raycaster, camera } = useThree();
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const select = useSelectionStore((s) => s.select);
    const toggleSelect = useSelectionStore((s) => s.toggleSelect);
    const openContextMenu = useSelectionStore((s) => s.openContextMenu);
    const setHoveredId = useSelectionStore((s) => s.setHovered);
    // Track per-instance lift for smooth animation
    const liftRef = useRef(null);
    // Pre-compute matrices and colors
    const { colorArray } = useMemo(() => {
        const colors = new Float32Array(files.length * 3);
        files.forEach((file, i) => {
            const layout = layoutMap.get(file.id);
            const pos = layout?.position ?? [0, 0, 0];
            const scale = getFileScale(file.sizeBytes);
            _tempObject.position.set(pos[0], pos[1], pos[2]);
            _tempObject.scale.set(scale, scale, scale);
            _tempObject.rotation.set(0, 0, 0);
            _tempObject.updateMatrix();
            _tempColor.set(getFileColor(file.extension));
            colors[i * 3] = _tempColor.r;
            colors[i * 3 + 1] = _tempColor.g;
            colors[i * 3 + 2] = _tempColor.b;
        });
        return { colorArray: colors };
    }, [files, layoutMap]);
    // Sync file IDs to mesh userData for FileDragger raycast identification
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.userData.fileIds = files.map((f) => f.id);
        }
    }, [files]);
    // Update instance matrices every frame (for hover + selection animations)
    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh)
            return;
        const { selectedIds } = useSelectionStore.getState();
        const { isDragging: dragging, dragPositions } = useDragStore.getState();
        // Search dimming: check if a search is active
        const fileTreeState = useFileTreeStore.getState();
        const searchActive = fileTreeState.searchQuery.trim().length > 0;
        const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;
        const posOverrides = fileTreeState.positionOverrides;
        // Ensure lift array matches file count
        if (!liftRef.current || liftRef.current.length !== files.length) {
            liftRef.current = new Float32Array(files.length);
        }
        const lifts = liftRef.current;
        files.forEach((file, i) => {
            const layout = layoutMap.get(file.id);
            const autoPos = layout?.position ?? [0, 0, 0];
            // Priority: drag-in-progress > committed override > auto-layout
            const dragPos = dragging ? dragPositions.get(file.id) : undefined;
            const overridePos = posOverrides.get(file.id);
            const pos = dragPos ?? overridePos ?? autoPos;
            const baseScale = getFileScale(file.sizeBytes);
            const isHovered = hoveredIndex === i;
            const isSelected = selectedIds.has(file.id);
            const isSearchMatch = searchResultIds ? searchResultIds.has(file.id) : true;
            // LOD: scale down distant instances; hide beyond billboard threshold
            const dx = pos[0] - camera.position.x;
            const dz = pos[2] - camera.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            let targetScale;
            if (dist > LOD_BILLBOARD) {
                // Beyond billboard distance: hide from instanced mesh (rendered as points instead)
                targetScale = 0;
            }
            else {
                const lodFactor = dist <= LOD_NEAR
                    ? 1
                    : dist >= LOD_FAR
                        ? LOD_MIN_SCALE
                        : 1 - (1 - LOD_MIN_SCALE) * ((dist - LOD_NEAR) / (LOD_FAR - LOD_NEAR));
                targetScale = (isHovered ? baseScale * 1.15 : baseScale) * lodFactor;
            }
            // Smooth lift animation for selected instances
            const targetLift = isSelected ? SELECTION_LIFT : 0;
            lifts[i] += (targetLift - lifts[i]) * 0.12;
            _tempObject.position.set(pos[0], pos[1] + lifts[i], pos[2]);
            _tempObject.scale.set(targetScale, targetScale, targetScale);
            _tempObject.rotation.set(0, 0, 0);
            _tempObject.updateMatrix();
            mesh.setMatrixAt(i, _tempObject.matrix);
            // Color: selected gets brighter, hovered gets a smaller boost
            // When search is active, dim non-matching files
            _tempColor.set(getFileColor(file.extension));
            if (searchActive && !isSearchMatch) {
                _tempColor.multiplyScalar(0.25);
            }
            else if (isSelected) {
                _tempColor.multiplyScalar(1.8);
            }
            else if (isHovered) {
                _tempColor.multiplyScalar(1.5);
            }
            else if (searchActive && isSearchMatch) {
                _tempColor.multiplyScalar(1.3);
            }
            mesh.setColorAt(i, _tempColor);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor)
            mesh.instanceColor.needsUpdate = true;
    });
    const handlePointerMove = useCallback((e) => {
        e.stopPropagation();
        // Suppress hover labels while dragging
        if (useDragStore.getState().isDragging) {
            setHoveredIndex(null);
            setHoveredId(null);
            return;
        }
        if (!meshRef.current)
            return;
        // Use raycaster to find which instance
        const intersects = raycaster.intersectObject(meshRef.current);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            setHoveredIndex(idx);
            setHoveredId(files[idx].id);
            document.body.style.cursor = 'pointer';
        }
        else {
            setHoveredIndex(null);
            setHoveredId(null);
            document.body.style.cursor = 'auto';
        }
    }, [raycaster, files, setHoveredId]);
    const handlePointerOut = useCallback((e) => {
        e.stopPropagation();
        setHoveredIndex(null);
        setHoveredId(null);
        document.body.style.cursor = 'auto';
    }, [setHoveredId]);
    const handleClick = useCallback((e) => {
        e.stopPropagation();
        // Ignore clicks that are actually the end of a drag
        if (useDragStore.getState().dragEndTime > Date.now() - 100)
            return;
        if (!meshRef.current)
            return;
        const intersects = raycaster.intersectObject(meshRef.current);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            const id = files[idx].id;
            if (e.nativeEvent.shiftKey) {
                toggleSelect(id);
            }
            else {
                select(id);
            }
        }
    }, [raycaster, files, select, toggleSelect]);
    const handleDoubleClick = useCallback((e) => {
        e.stopPropagation();
        if (useDragStore.getState().dragEndTime > Date.now() - 100)
            return;
        if (!meshRef.current)
            return;
        const intersects = raycaster.intersectObject(meshRef.current);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            window.electronAPI.openExternal(files[idx].path).catch((err) => {
                console.error('Failed to open externally:', err);
            });
        }
    }, [raycaster, files]);
    const handleContextMenu = useCallback((e) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        if (!meshRef.current)
            return;
        const intersects = raycaster.intersectObject(meshRef.current);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            openContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, files[idx].id);
        }
    }, [raycaster, files, openContextMenu]);
    // Get hovered file data for label
    const hoveredFile = hoveredIndex !== null ? files[hoveredIndex] : null;
    const hoveredPos = hoveredFile
        ? layoutMap.get(hoveredFile.id)?.position ?? null
        : null;
    // Memoize a stable material so it's not re-created on every render
    const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, vertexColors: true }), []);
    const geometry = SHARED_GEOMETRIES[shape];
    // Dispose instanced mesh GPU resources (instanceMatrix, instanceColor) when
    // the file count changes (args forces a new InstancedMesh) or on unmount.
    useEffect(() => {
        const mesh = meshRef.current;
        return () => {
            if (mesh) {
                mesh.dispose();
            }
        };
    }, [files.length]);
    // Dispose material on unmount
    useEffect(() => {
        return () => {
            material.dispose();
        };
    }, [material]);
    return (_jsxs(_Fragment, { children: [_jsx("instancedMesh", { ref: meshRef, args: [geometry, material, files.length], frustumCulled: true, onPointerMove: handlePointerMove, onPointerOut: handlePointerOut, onClick: handleClick, onDoubleClick: handleDoubleClick, onContextMenu: handleContextMenu, children: _jsx("instancedBufferAttribute", { attach: "instanceColor", args: [colorArray, 3] }) }), hoveredFile && hoveredPos && (_jsx(HoverLabel, { node: hoveredFile, position: hoveredPos }))] }));
}
// ── Billboard points for very distant files ───────────
function BillboardPoints({ files, layoutMap }) {
    const pointsRef = useRef(null);
    const { camera } = useThree();
    // Pre-allocate geometry + typed arrays sized to file count
    const { positions, colors, geometry, material } = useMemo(() => {
        const pos = new Float32Array(files.length * 3);
        const col = new Float32Array(files.length * 3);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geom.setDrawRange(0, 0);
        const mat = new THREE.PointsMaterial({
            size: 3,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
        });
        return { positions: pos, colors: col, geometry: geom, material: mat };
    }, [files.length]);
    // Dispose old geometry/material when they are replaced
    useEffect(() => {
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);
    useFrame(() => {
        if (!pointsRef.current)
            return;
        const posOverrides = useFileTreeStore.getState().positionOverrides;
        const { isDragging: dragging, dragPositions } = useDragStore.getState();
        const fileTreeState = useFileTreeStore.getState();
        const searchActive = fileTreeState.searchQuery.trim().length > 0;
        const searchResultIds = searchActive ? new Set(fileTreeState.getSearchResults()) : null;
        let count = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const layout = layoutMap.get(file.id);
            const autoPos = layout?.position ?? [0, 0, 0];
            const dragPos = dragging ? dragPositions.get(file.id) : undefined;
            const overridePos = posOverrides.get(file.id);
            const pos = dragPos ?? overridePos ?? autoPos;
            const dx = pos[0] - camera.position.x;
            const dz = pos[2] - camera.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > LOD_BILLBOARD) {
                positions[count * 3] = pos[0];
                positions[count * 3 + 1] = pos[1];
                positions[count * 3 + 2] = pos[2];
                _tempColor.set(getFileColor(file.extension));
                // Dim non-matching files during search
                if (searchActive && searchResultIds && !searchResultIds.has(file.id)) {
                    _tempColor.multiplyScalar(0.25);
                }
                colors[count * 3] = _tempColor.r;
                colors[count * 3 + 1] = _tempColor.g;
                colors[count * 3 + 2] = _tempColor.b;
                count++;
            }
        }
        const posAttr = geometry.getAttribute('position');
        const colAttr = geometry.getAttribute('color');
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        geometry.setDrawRange(0, count);
    });
    return _jsx("points", { ref: pointsRef, args: [geometry, material], frustumCulled: false });
}
// ── Main component: groups files by shape, renders InstancedMesh per group ──
export default function FileInstances({ files, layoutMap }) {
    // Group files by shape
    const groups = useMemo(() => {
        const map = new Map();
        for (const file of files) {
            const shape = getFileShape(file.extension);
            const list = map.get(shape);
            if (list) {
                list.push(file);
            }
            else {
                map.set(shape, [file]);
            }
        }
        return map;
    }, [files]);
    return (_jsxs(_Fragment, { children: [Array.from(groups.entries()).map(([shape, shapeFiles]) => (_jsx(FileInstanceGroup, { shape: shape, files: shapeFiles, layoutMap: layoutMap }, shape))), _jsx(BillboardPoints, { files: files, layoutMap: layoutMap })] }));
}
