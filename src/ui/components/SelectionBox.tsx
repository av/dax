import { useEffect, useState } from 'react';
import { sceneEvents } from '@/engine/events';

interface SelectionBoxState {
  start: { x: number; y: number };
  end: { x: number; y: number };
  isActive: boolean;
}

export function SelectionBox() {
  const [box, setBox] = useState<SelectionBoxState | null>(null);

  useEffect(() => {
    const handleStart = (payload: { start: { x: number; y: number } }) => {
      setBox({
        start: payload.start,
        end: payload.start,
        isActive: true,
      });
    };

    const handleUpdate = (payload: { start: { x: number; y: number }; end: { x: number; y: number } }) => {
      setBox({
        start: payload.start,
        end: payload.end,
        isActive: true,
      });
    };

    const handleEnd = () => {
      setBox(null);
    };

    sceneEvents.on('selection:box:start', handleStart);
    sceneEvents.on('selection:box:update', handleUpdate);
    sceneEvents.on('selection:box:end', handleEnd);

    return () => {
      sceneEvents.off('selection:box:start', handleStart);
      sceneEvents.off('selection:box:update', handleUpdate);
      sceneEvents.off('selection:box:end', handleEnd);
    };
  }, []);

  if (!box || !box.isActive) return null;

  const left = Math.min(box.start.x, box.end.x);
  const top = Math.min(box.start.y, box.end.y);
  const width = Math.abs(box.end.x - box.start.x);
  const height = Math.abs(box.end.y - box.start.y);

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        border: '1px solid rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
