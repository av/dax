import { useRef, useEffect, useState } from 'react';
import { useScene } from '../hooks/useScene';
import { SelectionBox } from './SelectionBox';
import { DeleteConfirmDialog } from './ConfirmDialog';

export default function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { engine, fps, isReady, error } = useScene(containerRef);
  const [showFps, setShowFps] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        setShowFps((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) {
    return (
      <div className="viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ff6b6b' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="viewport" ref={containerRef}>
      {showFps && isReady && <div className="fps-counter">{fps.toFixed(0)} FPS</div>}
      <SelectionBox />
      <DeleteConfirmDialog objectManager={engine?.objectManager ?? null} />
    </div>
  );
}
