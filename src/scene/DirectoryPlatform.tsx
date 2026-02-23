import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { LayoutEntry } from '@/scene/layout/spatialLayout';
import { theme } from '@/theme';

interface DirectoryPlatformProps {
  name: string;
  entry: LayoutEntry;
  depth: number;
}

const DEPTH_COLORS = [
  theme.colors.bgSurface,
  theme.colors.bgBase,
  theme.colors.borderDefault,
];

/**
 * A flat rectangular platform representing a directory.
 * Slightly transparent with a subtle grid wireframe overlay.
 */
export default function DirectoryPlatform({ name, entry, depth }: DirectoryPlatformProps) {
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

      ctx.strokeStyle = theme.colors.borderDefault;
      ctx.globalAlpha = 0.5;
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
      ctx.globalAlpha = 1.0;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(width / 4, platformDepth / 4);
    return tex;
  }, [baseColor, width, platformDepth]);

  return (
    <group position={[px, py, pz]}>
      {/* Platform surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, platformDepth]} />
        <meshStandardMaterial
          map={gridTexture}
          transparent
          opacity={0.85}
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[width, platformDepth]} />
        <meshBasicMaterial
          color={theme.colors.borderDefault}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Directory label */}
      <Text
        position={[0, 0.3, -platformDepth / 2 - 0.5]}
        fontSize={0.6}
        color={theme.colors.textSecondary}
        anchorX="center"
        anchorY="bottom"
        font="/fonts/inter-regular.ttf"
      >
        {name}
      </Text>
    </group>
  );
}
