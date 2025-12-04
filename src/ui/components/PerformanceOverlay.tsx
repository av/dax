/**
 * PerformanceOverlay Component
 * Displays FPS counter and performance metrics
 */

import React, { useState, useEffect, useRef } from 'react';

interface PerformanceStats {
  fps: number;
  frameTime: number;
  memory: number | null;
  objectCount: number;
}

interface PerformanceOverlayProps {
  objectCount?: number;
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function PerformanceOverlay({
  objectCount = 0,
  visible = true,
  position = 'top-right',
}: PerformanceOverlayProps) {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    frameTime: 0,
    memory: null,
    objectCount,
  });
  
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  
  useEffect(() => {
    if (!visible) return;
    
    let animationFrameId: number;
    
    const measureFrame = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      
      // Track frame times for averaging
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      frameCountRef.current++;
      
      // Update stats every 500ms
      if (frameCountRef.current % 30 === 0) {
        const avgFrameTime =
          frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = 1000 / avgFrameTime;
        
        // Get memory usage if available
        let memory: number | null = null;
        if ('memory' in performance) {
          const memInfo = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
          memory = memInfo.usedJSHeapSize / 1048576; // Convert to MB
        }
        
        setStats({
          fps: Math.round(fps),
          frameTime: Math.round(avgFrameTime * 100) / 100,
          memory,
          objectCount,
        });
      }
      
      animationFrameId = requestAnimationFrame(measureFrame);
    };
    
    animationFrameId = requestAnimationFrame(measureFrame);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visible, objectCount]);
  
  if (!visible) return null;
  
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '10px', left: '10px' },
    'bottom-right': { bottom: '10px', right: '10px' },
  };
  
  const fpsColor = stats.fps >= 55 ? '#4ade80' : stats.fps >= 30 ? '#fbbf24' : '#f87171';
  
  return (
    <div style={{ ...styles.container, ...positionStyles[position] }}>
      <div style={styles.row}>
        <span style={styles.label}>FPS:</span>
        <span style={{ ...styles.value, color: fpsColor }}>{stats.fps}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Frame:</span>
        <span style={styles.value}>{stats.frameTime.toFixed(1)}ms</span>
      </div>
      {stats.memory !== null && (
        <div style={styles.row}>
          <span style={styles.label}>Memory:</span>
          <span style={styles.value}>{stats.memory.toFixed(1)}MB</span>
        </div>
      )}
      <div style={styles.row}>
        <span style={styles.label}>Objects:</span>
        <span style={styles.value}>{stats.objectCount}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#fff',
    zIndex: 9999,
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    lineHeight: '1.5',
  },
  label: {
    color: '#888',
  },
  value: {
    color: '#fff',
    fontWeight: 'bold',
  },
};

export default PerformanceOverlay;
