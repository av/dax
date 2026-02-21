import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AgentState } from '@/types';
import { useAgentStore } from '@/stores/agentStore';
import { useCameraFocusStore } from '@/scene/CameraController';
// ── Color configuration per agent state ────────────────
const STATE_COLORS = {
    [AgentState.Idle]: '#4A90D9',
    [AgentState.Thinking]: '#D9A54A',
    [AgentState.Acting]: '#4AD97A',
    [AgentState.Error]: '#D94A4A',
    [AgentState.WaitingApproval]: '#D9A54A',
};
const STATE_PULSE_SPEED = {
    [AgentState.Idle]: 1.5,
    [AgentState.Thinking]: 4.0,
    [AgentState.Acting]: 2.0,
    [AgentState.Error]: 8.0,
    [AgentState.WaitingApproval]: 3.0,
};
// ── Shared geometry (created once) ─────────────────────
const innerGeo = new THREE.IcosahedronGeometry(0.25, 0);
const outerGeo = new THREE.IcosahedronGeometry(0.35, 0);
// ── Helpers ────────────────────────────────────────────
const _targetVec = new THREE.Vector3();
const _currentVec = new THREE.Vector3();
const IDLE_ORBIT_RADIUS = 3;
const BOB_AMPLITUDE = 0.2;
const BOB_SPEED = 1.8;
const FLY_LERP_SPEED = 2.5;
const ROTATION_SPEED = 0.6;
// ── Particle trail ─────────────────────────────────────
const TRAIL_PARTICLE_COUNT = 60;
function createParticles() {
    return Array.from({ length: TRAIL_PARTICLE_COUNT }, () => ({
        position: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
    }));
}
// ── Component ──────────────────────────────────────────
export default function AgentEntity() {
    // Refs
    const groupRef = useRef(null);
    const innerRef = useRef(null);
    const outerRef = useRef(null);
    const lightRef = useRef(null);
    const trailMeshRef = useRef(null);
    // Particle state
    const particles = useMemo(() => createParticles(), []);
    const trailPositions = useMemo(() => new Float32Array(TRAIL_PARTICLE_COUNT * 3), []);
    const trailSizes = useMemo(() => new Float32Array(TRAIL_PARTICLE_COUNT), []);
    const trailOpacities = useMemo(() => new Float32Array(TRAIL_PARTICLE_COUNT), []);
    const particleNextIdx = useRef(0);
    const spawnTimer = useRef(0);
    // Memoised materials
    const innerMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: STATE_COLORS[AgentState.Idle],
        emissive: STATE_COLORS[AgentState.Idle],
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.4,
        transparent: true,
        opacity: 0.92,
    }), []);
    const outerMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: STATE_COLORS[AgentState.Idle],
        emissive: STATE_COLORS[AgentState.Idle],
        emissiveIntensity: 0.3,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
    }), []);
    const trailMat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uColor: { value: new THREE.Color(STATE_COLORS[AgentState.Idle]) },
        },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (200.0 / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vOpacity;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float alpha = smoothstep(1.0, 0.3, d) * vOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
    }), []);
    // Store selectors (outside frame loop for subscription)
    const statusRef = useRef(AgentState.Idle);
    const targetPosRef = useRef(null);
    const isVisibleRef = useRef(true);
    // Subscribe to store outside frame loop
    useAgentStore.subscribe((s) => {
        statusRef.current = s.status;
        targetPosRef.current = s.targetPosition;
        isVisibleRef.current = s.isVisible;
    });
    const cameraTargetRef = useRef(null);
    useCameraFocusStore.subscribe((s) => {
        cameraTargetRef.current = s.target;
    });
    // Mutable tracking
    const orbitAngle = useRef(0);
    const prevPos = useRef(new THREE.Vector3(0, 3, 0));
    const frameCount = useRef(0);
    const updatePosition = useAgentStore.getState().updatePosition;
    // ── Frame loop ────────────────────────────────────
    useFrame((_state, delta) => {
        const group = groupRef.current;
        const inner = innerRef.current;
        const outer = outerRef.current;
        const light = lightRef.current;
        if (!group || !inner || !outer || !light)
            return;
        const clampedDelta = Math.min(delta, 0.1); // guard long frames
        const status = statusRef.current;
        const targetPos = targetPosRef.current;
        const elapsed = _state.clock.elapsedTime;
        // Visibility
        group.visible = isVisibleRef.current;
        if (!group.visible)
            return;
        // ── Color & emissive ──────────────────────────
        const color = STATE_COLORS[status];
        const pulseSpeed = STATE_PULSE_SPEED[status];
        const pulse = Math.sin(elapsed * pulseSpeed * Math.PI) * 0.5 + 0.5;
        const emissiveIntensity = 0.4 + pulse * 0.6;
        innerMat.color.set(color);
        innerMat.emissive.set(color);
        innerMat.emissiveIntensity = emissiveIntensity;
        outerMat.color.set(color);
        outerMat.emissive.set(color);
        outerMat.emissiveIntensity = emissiveIntensity * 0.5;
        light.color.set(color);
        light.intensity = 1.0 + pulse * 1.5;
        // Trail color
        trailMat.uniforms.uColor.value.set(color);
        // ── Rotation ──────────────────────────────────
        inner.rotation.y += ROTATION_SPEED * clampedDelta;
        outer.rotation.y -= ROTATION_SPEED * 0.7 * clampedDelta;
        outer.rotation.x += ROTATION_SPEED * 0.3 * clampedDelta;
        // ── Position ──────────────────────────────────
        if (targetPos) {
            // Fly to target
            _targetVec.set(targetPos[0], targetPos[1] + 1.5, targetPos[2]);
            _currentVec.set(group.position.x, group.position.y, group.position.z);
            _currentVec.lerp(_targetVec, 1 - Math.exp(-FLY_LERP_SPEED * clampedDelta));
            group.position.copy(_currentVec);
        }
        else {
            // Idle orbit around camera focus or origin
            const center = cameraTargetRef.current ?? new THREE.Vector3(0, 0, 0);
            orbitAngle.current += 0.3 * clampedDelta;
            const ox = center.x + Math.cos(orbitAngle.current) * IDLE_ORBIT_RADIUS;
            const oz = center.z + Math.sin(orbitAngle.current) * IDLE_ORBIT_RADIUS;
            const baseY = center.y + 3;
            _targetVec.set(ox, baseY, oz);
            _currentVec.set(group.position.x, group.position.y, group.position.z);
            _currentVec.lerp(_targetVec, 1 - Math.exp(-1.5 * clampedDelta));
            group.position.copy(_currentVec);
        }
        // Bob
        group.position.y += Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE;
        // Push position back to store (deterministic — every 3rd frame)
        frameCount.current += 1;
        if (frameCount.current % 3 === 0) {
            updatePosition([group.position.x, group.position.y, group.position.z]);
        }
        // ── Particle trail ────────────────────────────
        const speed = prevPos.current.distanceTo(group.position) / Math.max(clampedDelta, 0.001);
        prevPos.current.copy(group.position);
        // Spawn particles when moving fast enough
        spawnTimer.current += clampedDelta;
        if (speed > 0.5 && spawnTimer.current > 0.03) {
            spawnTimer.current = 0;
            const idx = particleNextIdx.current % TRAIL_PARTICLE_COUNT;
            particles[idx].position.copy(group.position);
            particles[idx].position.x += (Math.random() - 0.5) * 0.15;
            particles[idx].position.y += (Math.random() - 0.5) * 0.15;
            particles[idx].position.z += (Math.random() - 0.5) * 0.15;
            particles[idx].life = 1.0;
            particles[idx].maxLife = 1.0;
            particleNextIdx.current++;
        }
        // Update particles
        for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
            const p = particles[i];
            if (p.life > 0) {
                p.life -= clampedDelta * 1.5;
                if (p.life < 0)
                    p.life = 0;
            }
            const ratio = p.maxLife > 0 ? p.life / p.maxLife : 0;
            trailPositions[i * 3] = p.position.x;
            trailPositions[i * 3 + 1] = p.position.y;
            trailPositions[i * 3 + 2] = p.position.z;
            trailSizes[i] = ratio * 4.0;
            trailOpacities[i] = ratio * 0.7;
        }
        // Update buffer attributes
        const trailGeo = trailMeshRef.current?.geometry;
        if (trailGeo) {
            const posAttr = trailGeo.getAttribute('position');
            if (posAttr) {
                posAttr.set(trailPositions);
                posAttr.needsUpdate = true;
            }
            const sizeAttr = trailGeo.getAttribute('aSize');
            if (sizeAttr) {
                sizeAttr.set(trailSizes);
                sizeAttr.needsUpdate = true;
            }
            const opAttr = trailGeo.getAttribute('aOpacity');
            if (opAttr) {
                opAttr.set(trailOpacities);
                opAttr.needsUpdate = true;
            }
        }
    });
    return (_jsxs(_Fragment, { children: [_jsxs("group", { ref: groupRef, position: [0, 3, 0], children: [_jsx("mesh", { ref: innerRef, geometry: innerGeo, material: innerMat }), _jsx("mesh", { ref: outerRef, geometry: outerGeo, material: outerMat }), _jsx("pointLight", { ref: lightRef, color: STATE_COLORS[AgentState.Idle], intensity: 2, distance: 12, decay: 2 })] }), _jsx("points", { ref: trailMeshRef, material: trailMat, children: _jsxs("bufferGeometry", { children: [_jsx("bufferAttribute", { attach: "attributes-position", count: TRAIL_PARTICLE_COUNT, array: trailPositions, itemSize: 3 }), _jsx("bufferAttribute", { attach: "attributes-aSize", count: TRAIL_PARTICLE_COUNT, array: trailSizes, itemSize: 1 }), _jsx("bufferAttribute", { attach: "attributes-aOpacity", count: TRAIL_PARTICLE_COUNT, array: trailOpacities, itemSize: 1 })] }) })] }));
}
