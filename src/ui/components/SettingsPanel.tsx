/**
 * SettingsPanel Component
 * Settings for grid, physics, and workspace preferences
 */

import React, { useCallback } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.sectionContent}>{children}</div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, description, value, onChange }: ToggleSettingProps) {
  return (
    <div style={styles.settingRow}>
      <div style={styles.settingInfo}>
        <span style={styles.settingLabel}>{label}</span>
        {description && <span style={styles.settingDescription}>{description}</span>}
      </div>
      <button
        style={{
          ...styles.toggle,
          backgroundColor: value ? '#4ade80' : '#444',
        }}
        onClick={() => onChange(!value)}
      >
        <div
          style={{
            ...styles.toggleKnob,
            transform: value ? 'translateX(20px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}

interface SliderSettingProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

function SliderSetting({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: SliderSettingProps) {
  return (
    <div style={styles.settingRow}>
      <div style={styles.settingInfo}>
        <span style={styles.settingLabel}>{label}</span>
        {description && <span style={styles.settingDescription}>{description}</span>}
      </div>
      <div style={styles.sliderContainer}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <span style={styles.sliderValue}>
          {value}
          {unit}
        </span>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { currentWorkspace, updateSettings } = useWorkspaceStore();
  const settings = currentWorkspace?.settings;
  
  const handleToggle = useCallback(
    (key: keyof NonNullable<typeof settings>, value: boolean) => {
      updateSettings({ [key]: value });
    },
    [updateSettings]
  );
  
  const handleSlider = useCallback(
    (key: keyof NonNullable<typeof settings>, value: number) => {
      updateSettings({ [key]: value });
    },
    [updateSettings]
  );
  
  if (!isOpen) return null;
  
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>⚙️ Settings</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div style={styles.content}>
          <SettingsSection title="Display">
            <ToggleSetting
              label="Show Grid"
              description="Display the reference grid on the data plane"
              value={settings?.gridVisible ?? true}
              onChange={(v) => handleToggle('gridVisible', v)}
            />
            <SliderSetting
              label="Grid Size"
              description="Spacing between grid lines"
              value={settings?.gridSize ?? 100}
              min={10}
              max={500}
              step={10}
              unit=" units"
              onChange={(v) => handleSlider('gridSize', v)}
            />
          </SettingsSection>
          
          <SettingsSection title="Physics">
            <ToggleSetting
              label="Enable Physics"
              description="Allow objects to interact physically"
              value={settings?.physicsEnabled ?? true}
              onChange={(v) => handleToggle('physicsEnabled', v)}
            />
          </SettingsSection>
          
          <SettingsSection title="Auto-Save">
            <ToggleSetting
              label="Auto-Save"
              description="Automatically save workspace changes"
              value={settings?.autoSaveEnabled ?? true}
              onChange={(v) => handleToggle('autoSaveEnabled', v)}
            />
            <SliderSetting
              label="Auto-Save Interval"
              description="Time between automatic saves"
              value={(settings?.autoSaveIntervalMs ?? 30000) / 1000}
              min={10}
              max={300}
              step={10}
              unit=" sec"
              onChange={(v) => handleSlider('autoSaveIntervalMs', v * 1000)}
            />
          </SettingsSection>
          
          <SettingsSection title="Performance">
            <ToggleSetting
              label="Show FPS Overlay"
              description="Display performance metrics"
              value={localStorage.getItem('dax-show-fps') === 'true'}
              onChange={(v) => {
                localStorage.setItem('dax-show-fps', String(v));
                window.dispatchEvent(new CustomEvent('settings-changed', { detail: { showFps: v } }));
              }}
            />
          </SettingsSection>
        </div>
        
        <div style={styles.footer}>
          <button style={styles.resetButton} onClick={() => {
            // Reset to defaults
            updateSettings({
              gridVisible: true,
              gridSize: 100,
              physicsEnabled: true,
              autoSaveEnabled: true,
              autoSaveIntervalMs: 30000,
            });
          }}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#fff',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#4ade80',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#252525',
    borderRadius: '8px',
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  settingLabel: {
    fontSize: '14px',
    color: '#fff',
  },
  settingDescription: {
    fontSize: '11px',
    color: '#888',
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  slider: {
    width: '100px',
    height: '4px',
    appearance: 'none',
    backgroundColor: '#444',
    borderRadius: '2px',
    outline: 'none',
  },
  sliderValue: {
    minWidth: '60px',
    textAlign: 'right',
    fontSize: '13px',
    color: '#fff',
    fontFamily: 'monospace',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  resetButton: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default SettingsPanel;
