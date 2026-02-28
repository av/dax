import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { theme } from '@/theme';

// ── Types ────────────────────────────────────────────────

interface DirectoryPlatformProps {
  name: string;
  entry: LayoutEntry;
  depth: number;
  isDropTarget: boolean;
}

// ── Constants ────────────────────────────────────────────

const DEPTH_COLORS = [
  theme.colors.bgSurface,
  theme.colors.bgBase,
  theme.colors.borderDefault,
];

const FLOOR_HEIGHT = 0.2;
const WALL_THICKNESS = 0.05;
const FLOOR_OPACITY = 0.25;
const WALL_OPACITY_DEFAULT = 0.35;
const WALL_OPACITY_DROP = 0.6;
const WALL_EMISSIVE_INTENSITY = 0.3;

// ── LOD Constants ────────────────────────────────────────

type LodTier = 'near' | 'mid' | 'far';

/** Only recompute LOD every N frames to avoid per-frame overhead */
const LOD_CHECK_INTERVAL = 15;

/** Minimum thresholds — used when workspace is very small */
const LOD_NEAR_MIN = 25;
const LOD_FAR_MIN = 80;

/** Threshold multipliers relative to workspace extent */
const LOD_NEAR_EXTENT_FACTOR = 0.15;
const LOD_FAR_EXTENT_FACTOR = 0.5;

// ── Component ────────────────────────────────────────────

/**
 * A 3D walled container (tray) representing a directory.
 * Renders a semi-transparent floor with four containment walls
 * and physics colliders to prevent file cards from sliding out.
 *
 * Uses distance-based LOD to reduce draw calls for large workspaces:
 *  - **near**: full rendering (floor, walls, label, all colliders)
 *  - **mid**:  floor mesh + label + all colliders (wall meshes hidden)
 *  - **far**:  floor mesh + all colliders only (walls and label hidden)
 */
export default function DirectoryPlatform({
  name,
  entry,
  depth,
  isDropTarget,
}: DirectoryPlatformProps) {
  const [px, py, pz] = entry.position;
  const [width, platformDepth] = entry.platformSize ?? [10, 10];

  // ── LOD state ────────────────────────────────────────
  // Use a ref for the current tier to avoid stale closures inside useFrame,
  // and React state to trigger re-renders only when the tier actually changes.

  const lodTierRef = useRef<LodTier>('near');
  const [lodTier, setLodTier] = useState<LodTier>('near');
  const frameCountRef = useRef(0);

  // Dynamic LOD thresholds scaled to workspace size
  const extent = useFileTreeStore((s) => s.workspaceBounds?.extent ?? 100);
  const lodNear = Math.max(extent * LOD_NEAR_EXTENT_FACTOR, LOD_NEAR_MIN);
  const lodFar = Math.max(extent * LOD_FAR_EXTENT_FACTOR, LOD_FAR_MIN);

  useFrame(({ camera }) => {
    frameCountRef.current++;
    if (frameCountRef.current % LOD_CHECK_INTERVAL !== 0) return;

    // 2D distance on XZ plane (camera height is irrelevant for ground-plane LOD)
    const dx = camera.position.x - px;
    const dz = camera.position.z - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const newTier: LodTier = dist < lodNear ? 'near' : dist < lodFar ? 'mid' : 'far';
    if (newTier !== lodTierRef.current) {
      lodTierRef.current = newTier;
      setLodTier(newTier);
    }
  });

  // ── Derived values ───────────────────────────────────

  const colorIndex = depth % DEPTH_COLORS.length;
  const baseColor = DEPTH_COLORS[colorIndex];
  const wallHeight = 0.3 + depth * 0.1;
  const fontSize = Math.max(0.3, 0.5 - depth * 0.05);

  const wallColor = isDropTarget ? theme.colors.accentPrimary : baseColor;
  const wallOpacity = isDropTarget ? WALL_OPACITY_DROP : WALL_OPACITY_DEFAULT;
  const wallEmissive = isDropTarget ? theme.colors.accentPrimary : '#000000';
  const wallEmissiveIntensity = isDropTarget ? WALL_EMISSIVE_INTENSITY : 0;

  // ── Wall definitions (position + size) ───────────────

  const walls = useMemo(() => [
    // Front wall (−Z edge)
    {
      key: 'front',
      position: [0, wallHeight / 2, -platformDepth / 2] as [number, number, number],
      size: [width, wallHeight, WALL_THICKNESS] as [number, number, number],
      colliderArgs: [width / 2, wallHeight / 2, WALL_THICKNESS / 2] as [number, number, number],
    },
    // Back wall (+Z edge)
    {
      key: 'back',
      position: [0, wallHeight / 2, platformDepth / 2] as [number, number, number],
      size: [width, wallHeight, WALL_THICKNESS] as [number, number, number],
      colliderArgs: [width / 2, wallHeight / 2, WALL_THICKNESS / 2] as [number, number, number],
    },
    // Left wall (−X edge)
    {
      key: 'left',
      position: [-width / 2, wallHeight / 2, 0] as [number, number, number],
      size: [WALL_THICKNESS, wallHeight, platformDepth] as [number, number, number],
      colliderArgs: [WALL_THICKNESS / 2, wallHeight / 2, platformDepth / 2] as [number, number, number],
    },
    // Right wall (+X edge)
    {
      key: 'right',
      position: [width / 2, wallHeight / 2, 0] as [number, number, number],
      size: [WALL_THICKNESS, wallHeight, platformDepth] as [number, number, number],
      colliderArgs: [WALL_THICKNESS / 2, wallHeight / 2, platformDepth / 2] as [number, number, number],
    },
  ], [width, platformDepth, wallHeight]);

  return (
    <RigidBody type="fixed" colliders={false} position={[px, py, pz]}>
      {/* ── Floor collider (always — required for physics) ── */}
      <CuboidCollider args={[width / 2, 0.1, platformDepth / 2]} friction={20.0} />

      {/* ── Wall colliders (always — keeps physics stable) ── */}
      {walls.map((wall) => (
        <CuboidCollider
          key={wall.key}
          args={wall.colliderArgs}
          position={wall.position}
          friction={3.0}
        />
      ))}

      <group>
        {/* ── Floor mesh (always — provides visual ground) ── */}
        <mesh receiveShadow>
          <boxGeometry args={[width, FLOOR_HEIGHT, platformDepth]} />
          <meshStandardMaterial
            color={baseColor}
            transparent
            opacity={FLOOR_OPACITY}
            roughness={0.9}
            metalness={0}
          />
        </mesh>

        {/* ── Wall meshes (near tier only) ──────────────── */}
        {lodTier === 'near' && walls.map((wall) => (
          <mesh key={wall.key} position={wall.position}>
            <boxGeometry args={wall.size} />
            <meshStandardMaterial
              color={wallColor}
              transparent
              opacity={wallOpacity}
              roughness={0.9}
              metalness={0}
              emissive={wallEmissive}
              emissiveIntensity={wallEmissiveIntensity}
            />
          </mesh>
        ))}

        {/* ── Directory name label (near + mid tiers) ──── */}
        {lodTier !== 'far' && (
          <Text
            font="/fonts/inter-regular.ttf"
            position={[
              -width / 2 + 0.2,
              wallHeight + 0.15,
              -platformDepth / 2 - 0.1,
            ]}
            fontSize={fontSize}
            color={theme.colors.textSecondary}
            anchorX="left"
            anchorY="bottom"
            maxWidth={width - 0.4}
          >
            {name}
          </Text>
        )}
      </group>
    </RigidBody>
  );
}
