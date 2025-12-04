import { useState, useCallback } from 'react';
import { sceneEvents } from '@/engine/events';

export type ToolMode = 'select' | 'pan' | 'boundary' | 'beacon';

export interface ToolbarProps {
  onModeChange?: (mode: ToolMode) => void;
}

const TOOLS: Array<{ mode: ToolMode; icon: string; label: string; shortcut: string }> = [
  { mode: 'select', icon: '🖱️', label: 'Select', shortcut: 'V' },
  { mode: 'pan', icon: '✋', label: 'Pan', shortcut: 'H' },
  { mode: 'boundary', icon: '⬡', label: 'Draw Boundary', shortcut: 'B' },
  { mode: 'beacon', icon: '📍', label: 'Place Beacon', shortcut: 'P' },
];

export function Toolbar({ onModeChange }: ToolbarProps) {
  const [activeMode, setActiveMode] = useState<ToolMode>('select');

  const handleModeChange = useCallback((mode: ToolMode) => {
    setActiveMode(mode);
    onModeChange?.(mode);
    sceneEvents.emit('tool:changed', { mode });
  }, [onModeChange]);

  const handleCreateSnippet = useCallback(() => {
    sceneEvents.emit('command:spawn-object', {
      type: 'snippet',
      position: { x: 0, y: 0.5, z: 0 },
      data: {
        title: 'New Snippet',
        content: '',
        tags: [],
      },
    });
  }, []);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.mode}
            className={`toolbar-button ${activeMode === tool.mode ? 'active' : ''}`}
            onClick={() => handleModeChange(tool.mode)}
            title={`${tool.label} (${tool.shortcut})`}
            aria-label={tool.label}
          >
            <span className="toolbar-icon">{tool.icon}</span>
          </button>
        ))}
      </div>
      
      <div className="toolbar-separator" />
      
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={handleCreateSnippet}
          title="New Snippet (N)"
          aria-label="New Snippet"
        >
          <span className="toolbar-icon">📝</span>
        </button>
        <button
          className="toolbar-button"
          onClick={() => sceneEvents.emit('command:reset-camera', {})}
          title="Reset Camera (R)"
          aria-label="Reset Camera"
        >
          <span className="toolbar-icon">🏠</span>
        </button>
        <button
          className="toolbar-button"
          onClick={() => sceneEvents.emit('command:toggle-grid', { visible: true })}
          title="Toggle Grid (G)"
          aria-label="Toggle Grid"
        >
          <span className="toolbar-icon">📐</span>
        </button>
      </div>

      <div className="toolbar-mode-label">
        {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Mode
      </div>
    </div>
  );
}

export default Toolbar;
