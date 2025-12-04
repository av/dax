import { useState, useCallback, useEffect } from 'react';
import type { Beacon, BeaconType } from '@/types';
import { sceneEvents } from '@/engine/events';
import { useSceneStore } from '@/ui/stores/sceneStore';

export interface BeaconEditorProps {
  beaconId: string | null;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

const BEACON_TYPE_INFO: Record<BeaconType, { label: string; icon: string; color: string }> = {
  attract: { label: 'Attract', icon: '⬆', color: '#00ff88' },
  repel: { label: 'Repel', icon: '⬇', color: '#ff4444' },
  speed: { label: 'Speed', icon: '⚡', color: '#ffff00' },
  careful: { label: 'Careful', icon: '⚠', color: '#ff9900' },
  notify: { label: 'Notify', icon: '🔔', color: '#4a9eff' },
  pause: { label: 'Pause', icon: '⏸', color: '#888888' },
};

export function BeaconEditor({
  beaconId,
  isOpen,
  position,
  onClose,
}: BeaconEditorProps) {
  const [radius, setRadius] = useState(5);
  const [intensity, setIntensity] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [label, setLabel] = useState('');
  const [beaconType, setBeaconType] = useState<BeaconType>('attract');

  const beacon = useSceneStore((state) => 
    beaconId ? state.getObject(beaconId) as Beacon | undefined : undefined
  );

  // Load beacon data when opened
  useEffect(() => {
    if (beacon) {
      setRadius(beacon.radius);
      setIntensity(beacon.intensity);
      setIsActive(beacon.isActive);
      setLabel(beacon.label ?? '');
      setBeaconType(beacon.beaconType);
    }
  }, [beacon]);

  const handleSave = useCallback(() => {
    if (!beaconId) return;
    
    useSceneStore.getState().updateObject(beaconId, {
      radius,
      intensity,
      isActive,
      label: label.trim() || undefined,
    });
    
    sceneEvents.emit('notification', {
      type: 'success',
      title: 'Beacon updated',
      message: `${BEACON_TYPE_INFO[beaconType].label} beacon settings saved`,
    });
    
    onClose();
  }, [beaconId, radius, intensity, isActive, label, beaconType, onClose]);

  const handleDelete = useCallback(() => {
    if (!beaconId) return;
    
    useSceneStore.getState().removeObject(beaconId);
    sceneEvents.emit('notification', {
      type: 'info',
      title: 'Beacon removed',
    });
    
    onClose();
  }, [beaconId, onClose]);

  if (!isOpen || !beacon) return null;

  const typeInfo = BEACON_TYPE_INFO[beaconType];

  return (
    <div 
      className="beacon-editor-overlay" 
      onClick={onClose}
    >
      <div 
        className="beacon-editor"
        style={{ 
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="beacon-editor-header">
          <div className="beacon-editor-title">
            <span 
              className="beacon-type-badge"
              style={{ backgroundColor: typeInfo.color }}
            >
              {typeInfo.icon}
            </span>
            <h3>{typeInfo.label} Beacon</h3>
          </div>
          <button
            className="beacon-editor-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="beacon-editor-content">
          <div className="beacon-setting">
            <label htmlFor="beacon-label">Label (optional)</label>
            <input
              id="beacon-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a label..."
              maxLength={50}
            />
          </div>

          <div className="beacon-setting">
            <label htmlFor="beacon-radius">
              Radius: <span className="setting-value">{radius}</span>
            </label>
            <input
              id="beacon-radius"
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <div className="setting-hint">
              Effect radius in world units
            </div>
          </div>

          <div className="beacon-setting">
            <label htmlFor="beacon-intensity">
              Intensity: <span className="setting-value">{intensity.toFixed(1)}</span>
            </label>
            <input
              id="beacon-intensity"
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
            <div className="setting-hint">
              Strength of the beacon's effect
            </div>
          </div>

          <div className="beacon-setting beacon-toggle">
            <label htmlFor="beacon-active">Active</label>
            <button
              id="beacon-active"
              className={`toggle-button ${isActive ? 'active' : ''}`}
              onClick={() => setIsActive(!isActive)}
              role="switch"
              aria-checked={isActive}
            >
              <span className="toggle-slider" />
            </button>
          </div>
        </div>

        <div className="beacon-editor-footer">
          <button className="btn-danger" onClick={handleDelete}>
            Delete
          </button>
          <div className="beacon-editor-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BeaconEditor;
