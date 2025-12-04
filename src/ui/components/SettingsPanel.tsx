/**
 * SettingsPanel Component
 * Settings for agent configuration, application, grid, physics, and workspace preferences
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { validateApiUrl } from '@/services/settings';

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
  disabled?: boolean;
}

function ToggleSetting({ label, description, value, onChange, disabled }: ToggleSettingProps) {
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
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
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
  const workspaceSettings = currentWorkspace?.settings;

  // App settings from settings store
  const {
    apiUrl,
    hasApiKey,
    startOnStartup,
    pendingApiKey,
    showApiKey,
    isLoading,
    isSaving,
    isDirty,
    error,
    loadSettings,
    setApiUrl,
    setStartOnStartup,
    setPendingApiKey,
    toggleShowApiKey,
    saveSettings,
    clearApiKey,
    testConnection,
    resetDirty,
    clearError,
    hasUnsavedChanges,
  } = useSettingsStore();

  const [apiUrlError, setApiUrlError] = useState<string | undefined>();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [showConfirmClearKey, setShowConfirmClearKey] = useState(false);

  const hasLoadedRef = useRef(false);

  // Load settings when panel opens
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      loadSettings();
      hasLoadedRef.current = true;
    }
  }, [isOpen, loadSettings]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      setApiUrlError(undefined);
      setTestResult(null);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDirty]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    resetDirty();
    setShowConfirmDiscard(false);
    onClose();
  }, [resetDirty, onClose]);

  const handleApiUrlChange = useCallback((url: string) => {
    setApiUrl(url);
    const validation = validateApiUrl(url);
    setApiUrlError(validation.valid ? undefined : validation.error);
    setTestResult(null);
  }, [setApiUrl]);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    clearError();

    const result = await testConnection();
    setTestResult(result);
    setIsTesting(false);
  }, [testConnection, clearError]);

  const handleSave = useCallback(async () => {
    if (apiUrlError) return;
    await saveSettings();
    if (!error) {
      setTestResult(null);
    }
  }, [saveSettings, apiUrlError, error]);

  const handleClearApiKey = useCallback(async () => {
    await clearApiKey();
    setShowConfirmClearKey(false);
  }, [clearApiKey]);

  const handleWorkspaceToggle = useCallback(
    (key: keyof NonNullable<typeof workspaceSettings>, value: boolean) => {
      updateSettings({ [key]: value });
    },
    [updateSettings]
  );

  const handleWorkspaceSlider = useCallback(
    (key: keyof NonNullable<typeof workspaceSettings>, value: number) => {
      updateSettings({ [key]: value });
    },
    [updateSettings]
  );
  
  if (!isOpen) return null;
  
  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>⚙️ Settings</h2>
          <button style={styles.closeButton} onClick={handleClose}>
            ✕
          </button>
        </div>
        
        <div style={styles.content}>
          {isLoading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <span>Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Agent Configuration Section */}
              <SettingsSection title="Agent Configuration">
                <div style={styles.settingRowVertical}>
                  <div style={styles.settingInfo}>
                    <span style={styles.settingLabel}>API URL</span>
                    <span style={styles.settingDescription}>OpenAI-compatible API endpoint (must end with /v1)</span>
                  </div>
                  <div style={styles.inputContainer}>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => handleApiUrlChange(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      style={{
                        ...styles.textInput,
                        ...(apiUrlError ? styles.textInputError : {}),
                      }}
                      disabled={isSaving}
                    />
                  </div>
                  {apiUrlError && <span style={styles.errorText}>{apiUrlError}</span>}
                </div>

                <div style={styles.settingRowVertical}>
                  <div style={styles.settingInfo}>
                    <span style={styles.settingLabel}>API Key</span>
                    <span style={styles.settingDescription}>
                      {hasApiKey && !pendingApiKey
                        ? 'Key is stored securely in your system keychain'
                        : 'Enter your API key (stored securely in system keychain)'}
                    </span>
                  </div>
                  <div style={styles.inputContainer}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={pendingApiKey}
                      onChange={(e) => setPendingApiKey(e.target.value)}
                      placeholder={hasApiKey ? '••••••••••••••••' : 'Enter API key'}
                      style={styles.textInput}
                      disabled={isSaving}
                    />
                    <button
                      type="button"
                      onClick={toggleShowApiKey}
                      style={styles.revealButton}
                      title={showApiKey ? 'Hide' : 'Show'}
                    >
                      {showApiKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  {hasApiKey && !pendingApiKey && (
                    <button
                      style={styles.clearKeyButton}
                      onClick={() => setShowConfirmClearKey(true)}
                      disabled={isSaving}
                    >
                      Clear stored key
                    </button>
                  )}
                </div>

                {/* Test Connection Button */}
                <div style={styles.testConnectionRow}>
                  <button
                    style={{
                      ...styles.testButton,
                      opacity: !apiUrl || !!apiUrlError || isTesting ? 0.5 : 1,
                    }}
                    onClick={handleTestConnection}
                    disabled={!apiUrl || !!apiUrlError || isTesting || (!hasApiKey && !pendingApiKey)}
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testResult && (
                    <span
                      style={{
                        ...styles.testResult,
                        color: testResult.success ? '#4ade80' : '#f87171',
                      }}
                    >
                      {testResult.success ? '✓' : '✗'} {testResult.message}
                      {testResult.latencyMs && ` (${testResult.latencyMs}ms)`}
                    </span>
                  )}
                </div>
              </SettingsSection>

              {/* Application Section */}
              <SettingsSection title="Application">
                <ToggleSetting
                  label="Start on Startup"
                  description="Launch Dax automatically when your computer starts"
                  value={startOnStartup}
                  onChange={setStartOnStartup}
                  disabled={isSaving}
                />
              </SettingsSection>

              <SettingsSection title="Display">
                <ToggleSetting
                  label="Show Grid"
                  description="Display the reference grid on the data plane"
                  value={workspaceSettings?.gridVisible ?? true}
                  onChange={(v) => handleWorkspaceToggle('gridVisible', v)}
                />
                <SliderSetting
                  label="Grid Size"
                  description="Spacing between grid lines"
                  value={workspaceSettings?.gridSize ?? 100}
                  min={10}
                  max={500}
                  step={10}
                  unit=" units"
                  onChange={(v) => handleWorkspaceSlider('gridSize', v)}
                />
              </SettingsSection>
          
              <SettingsSection title="Physics">
                <ToggleSetting
                  label="Enable Physics"
                  description="Allow objects to interact physically"
                  value={workspaceSettings?.physicsEnabled ?? true}
                  onChange={(v) => handleWorkspaceToggle('physicsEnabled', v)}
                />
              </SettingsSection>
          
              <SettingsSection title="Auto-Save">
                <ToggleSetting
                  label="Auto-Save"
                  description="Automatically save workspace changes"
                  value={workspaceSettings?.autoSaveEnabled ?? true}
                  onChange={(v) => handleWorkspaceToggle('autoSaveEnabled', v)}
                />
                <SliderSetting
                  label="Auto-Save Interval"
                  description="Time between automatic saves"
                  value={(workspaceSettings?.autoSaveIntervalMs ?? 30000) / 1000}
                  min={10}
                  max={300}
                  step={10}
                  unit=" sec"
                  onChange={(v) => handleWorkspaceSlider('autoSaveIntervalMs', v * 1000)}
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
            </>
          )}

          {/* Error display */}
          {error && (
            <div style={styles.errorBanner}>
              <span>{error}</span>
              <button onClick={clearError} style={styles.errorDismiss}>
                ✕
              </button>
            </div>
          )}
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
            Reset Workspace
          </button>
          <div style={styles.footerRight}>
            {isDirty && <span style={styles.unsavedIndicator}>Unsaved changes</span>}
            <button
              style={{
                ...styles.saveButton,
                opacity: !isDirty || isSaving || !!apiUrlError ? 0.5 : 1,
              }}
              onClick={handleSave}
              disabled={!isDirty || isSaving || !!apiUrlError}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Discard Dialog */}
      {showConfirmDiscard && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>Unsaved Changes</h3>
            <p style={styles.dialogText}>
              You have unsaved changes. Are you sure you want to discard them?
            </p>
            <div style={styles.dialogButtons}>
              <button
                style={styles.dialogButtonSecondary}
                onClick={() => setShowConfirmDiscard(false)}
              >
                Cancel
              </button>
              <button style={styles.dialogButtonDanger} onClick={handleConfirmDiscard}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Key Dialog */}
      {showConfirmClearKey && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>Clear API Key</h3>
            <p style={styles.dialogText}>
              Are you sure you want to remove the stored API key? You will need to re-enter it to
              use the agent.
            </p>
            <div style={styles.dialogButtons}>
              <button
                style={styles.dialogButtonSecondary}
                onClick={() => setShowConfirmClearKey(false)}
              >
                Cancel
              </button>
              <button style={styles.dialogButtonDanger} onClick={handleClearApiKey}>
                Clear Key
              </button>
            </div>
          </div>
        </div>
      )}
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
    width: '520px',
    maxWidth: '90vw',
    maxHeight: '85vh',
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
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '12px',
    color: '#888',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid #333',
    borderTopColor: '#4ade80',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
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
  settingRowVertical: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
  inputContainer: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  textInput: {
    flex: 1,
    padding: '10px 12px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  textInputError: {
    borderColor: '#f87171',
  },
  revealButton: {
    padding: '8px 12px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  clearKeyButton: {
    alignSelf: 'flex-start',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #666',
    borderRadius: '4px',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  errorText: {
    fontSize: '12px',
    color: '#f87171',
  },
  testConnectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#252525',
    borderRadius: '8px',
  },
  testButton: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  testResult: {
    fontSize: '13px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid #f87171',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
    marginTop: '16px',
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '14px',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  unsavedIndicator: {
    fontSize: '12px',
    color: '#fbbf24',
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
  saveButton: {
    padding: '8px 20px',
    backgroundColor: '#4ade80',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  dialog: {
    backgroundColor: '#252525',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '400px',
    width: '90%',
  },
  dialogTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    color: '#fff',
  },
  dialogText: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#888',
    lineHeight: 1.5,
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  dialogButtonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  dialogButtonDanger: {
    padding: '8px 16px',
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default SettingsPanel;
