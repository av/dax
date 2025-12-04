import { useState, useCallback } from 'react';
import type { BeaconType } from '@/types';
import { sceneEvents } from '@/engine/events';

export interface BeaconSelectorProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelect: (beaconType: BeaconType, radius: number, intensity: number) => void;
}

const BEACON_TYPES: Array<{
  type: BeaconType;
  label: string;
  icon: string;
  description: string;
  color: string;
}> = [
  {
    type: 'attract',
    label: 'Attract',
    icon: '⬆',
    description: 'Agent prioritizes objects near this beacon',
    color: '#00ff88',
  },
  {
    type: 'repel',
    label: 'Repel',
    icon: '⬇',
    description: 'Agent avoids this area when pathfinding',
    color: '#ff4444',
  },
  {
    type: 'speed',
    label: 'Speed',
    icon: '⚡',
    description: 'Agent works faster in this area',
    color: '#ffff00',
  },
  {
    type: 'careful',
    label: 'Careful',
    icon: '⚠',
    description: 'Agent is more cautious in this area',
    color: '#ff9900',
  },
  {
    type: 'notify',
    label: 'Notify',
    icon: '🔔',
    description: 'User gets notified when agent enters area',
    color: '#4a9eff',
  },
  {
    type: 'pause',
    label: 'Pause',
    icon: '⏸',
    description: 'Agent pauses when entering this area',
    color: '#888888',
  },
];

export function BeaconSelector({
  isOpen,
  position,
  onClose,
  onSelect,
}: BeaconSelectorProps) {
  const [selectedType, setSelectedType] = useState<BeaconType | null>(null);
  const [radius, setRadius] = useState(5);
  const [intensity, setIntensity] = useState(1);

  const handleConfirm = useCallback(() => {
    if (!selectedType) return;
    
    onSelect(selectedType, radius, intensity);
    sceneEvents.emit('notification', {
      type: 'success',
      title: 'Beacon placed',
      message: `${selectedType} beacon with radius ${radius}`,
    });
    
    // Reset for next use
    setSelectedType(null);
    setRadius(5);
    setIntensity(1);
  }, [selectedType, radius, intensity, onSelect]);

  if (!isOpen) return null;

  return (
    <div 
      className="beacon-selector-overlay" 
      onClick={onClose}
    >
      <div 
        className="beacon-selector"
        style={{ 
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="beacon-selector-header">
          <h3>Place Beacon</h3>
          <button
            className="beacon-selector-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="beacon-selector-content">
          <div className="beacon-type-grid">
            {BEACON_TYPES.map((beacon) => (
              <button
                key={beacon.type}
                className={`beacon-type-option ${selectedType === beacon.type ? 'selected' : ''}`}
                onClick={() => setSelectedType(beacon.type)}
                style={{ '--beacon-color': beacon.color } as React.CSSProperties}
              >
                <span className="beacon-type-icon">{beacon.icon}</span>
                <span className="beacon-type-label">{beacon.label}</span>
              </button>
            ))}
          </div>

          {selectedType && (
            <div className="beacon-type-description">
              {BEACON_TYPES.find((b) => b.type === selectedType)?.description}
            </div>
          )}

          <div className="beacon-settings">
            <div className="beacon-setting">
              <label htmlFor="beacon-radius">
                Radius: <span className="setting-value">{radius}</span>
              </label>
              <input
                id="beacon-radius"
                type="range"
                min="1"
                max="20"
                step="1"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
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
            </div>
          </div>
        </div>

        <div className="beacon-selector-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!selectedType}
          >
            Place Beacon
          </button>
        </div>
      </div>
    </div>
  );
}

export default BeaconSelector;
