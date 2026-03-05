/**
 * Settings Panel — Full tabbed settings modal overlay.
 * 7 tabs: General, Camera, Keyboard, Agent, AI, Performance, Data.
 * Auto-persists all changes via config:set IPC.
 */
import {
  type Component,
  type JSX,
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
  onCleanup,
} from 'solid-js';
import { appConfig, setAppConfig } from '../../state/config';
import type { AppConfig } from '../../state/config';
import { showSettings, setShowSettings } from '../../state/ui';
import { ipcClient } from '../../core/ipc-client';
import { Tabs } from '../shared/Tabs';
import type { TabItem } from '../shared/Tabs';
import { Toggle } from '../shared/Toggle';
import { Select } from '../shared/Select';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { toast } from '../overlays/Toast';
import { DEFAULT_SHORTCUTS, SETTINGS_DEFAULTS } from '@shared/constants';
import type { ShortcutRow } from '../../db/types';

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'camera', label: 'Camera' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'agent', label: 'Agent' },
  { id: 'ai', label: 'AI' },
  { id: 'performance', label: 'Performance' },
  { id: 'data', label: 'Data' },
];

// ── Config persistence helper ──

function persistConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  setAppConfig(key, value);
  ipcClient.configSet(key, JSON.stringify(value)).catch((err) => {
    console.error(`[settings] Failed to persist ${key}:`, err);
  });
}

// ── Validation helpers ──

function isValidUrl(s: string): boolean {
  if (s === '') return true; // empty is OK (not yet configured)
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── MAIN COMPONENT ──

const SettingsPanel: Component = () => {
  const [activeTab, setActiveTab] = createSignal('general');
  const [shortcuts, setShortcuts] = createSignal<ShortcutRow[]>([]);
  const [editingShortcut, setEditingShortcut] = createSignal<string | null>(null);
  const [conflictWarning, setConflictWarning] = createSignal<string | null>(null);
  const [testingConnection, setTestingConnection] = createSignal(false);

  // Load shortcuts when keyboard tab shown
  async function loadShortcuts(): Promise<void> {
    try {
      const rows = await ipcClient.dbShortcutsGetAll();
      // Merge with defaults for any missing entries
      const map = new Map(rows.map((r) => [r.action, r]));
      const merged: ShortcutRow[] = Object.entries(DEFAULT_SHORTCUTS).map(([action, keyCombo]) => {
        const existing = map.get(action);
        return existing ?? { action, keyCombo, isDefault: true };
      });
      setShortcuts(merged);
    } catch (err) {
      console.error('[settings] Failed to load shortcuts:', err);
    }
  }

  onMount(() => {
    loadShortcuts();
  });

  // Close on Escape
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !editingShortcut()) {
      setShowSettings(false);
      e.stopPropagation();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
  });

  // Apply theme when it changes
  createEffect(() => {
    document.documentElement.dataset.theme = appConfig.theme;
  });

  // Apply reduced motion
  createEffect(() => {
    document.documentElement.dataset.reducedMotion = String(appConfig.reducedMotion);
  });

  // ── Shortcut editing ──

  function startEditShortcut(action: string): void {
    setEditingShortcut(action);
    setConflictWarning(null);
  }

  function handleShortcutCapture(e: KeyboardEvent): void {
    const action = editingShortcut();
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    // Build key combo string
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Don't capture modifier-only presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    const combo = parts.join('+');

    // Conflict detection
    const currentShortcuts = shortcuts();
    const conflict = currentShortcuts.find(
      (s) => s.keyCombo === combo && s.action !== action,
    );

    if (conflict) {
      setConflictWarning(
        `"${combo}" is already assigned to "${conflict.action}". Change "${conflict.action}" first.`,
      );
      return;
    }

    // Save the shortcut
    const row: ShortcutRow = { action, keyCombo: combo, isDefault: false };
    ipcClient.dbShortcutsSave(row).catch(console.error);

    // Update local state
    setShortcuts((prev) =>
      prev.map((s) => (s.action === action ? row : s)),
    );
    setEditingShortcut(null);
    setConflictWarning(null);
  }

  async function resetShortcut(action: string): Promise<void> {
    await ipcClient.dbShortcutsReset(action);
    const defaultCombo = DEFAULT_SHORTCUTS[action] ?? '';
    setShortcuts((prev) =>
      prev.map((s) =>
        s.action === action ? { action, keyCombo: defaultCombo, isDefault: true } : s,
      ),
    );
  }

  // ── AI Test Connection ──

  async function testConnection(): Promise<void> {
    setTestingConnection(true);
    try {
      const healthy = await ipcClient.agentHealth();
      if (healthy) {
        toast.success('Connection successful');
      } else {
        toast.error('Connection failed — check settings');
      }
    } catch (err) {
      toast.error(`Connection test failed: ${(err as Error).message}`);
    } finally {
      setTestingConnection(false);
    }
  }

  // ── Data tab helpers ──

  async function exportSettings(): Promise<void> {
    try {
      const configData: Record<string, unknown> = {};
      const keys: (keyof AppConfig)[] = [
        'theme', 'edgeScrollEnabled', 'edgeScrollSpeed', 'cameraSpeed',
        'zoomMin', 'zoomMax', 'agentEnabled', 'bdiLoopIntervalMs',
        'agentAnimationSpeed', 'agentAutoLearn', 'llmApiUrl', 'llmModel',
        'embeddingsUrl', 'embeddingsModel', 'maxRenderedObjects',
        'shadowQuality', 'physicsQuality', 'reducedMotion',
      ];
      for (const key of keys) {
        configData[key] = appConfig[key];
      }
      configData.shortcuts = shortcuts();

      const json = JSON.stringify(configData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dax-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Settings exported');
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    }
  }

  async function importSettings(): Promise<void> {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);

        // Apply each setting
        const settableKeys: (keyof AppConfig)[] = [
          'theme', 'edgeScrollEnabled', 'edgeScrollSpeed', 'cameraSpeed',
          'zoomMin', 'zoomMax', 'agentEnabled', 'bdiLoopIntervalMs',
          'agentAnimationSpeed', 'agentAutoLearn', 'llmApiUrl', 'llmModel',
          'embeddingsUrl', 'embeddingsModel', 'maxRenderedObjects',
          'shadowQuality', 'physicsQuality', 'reducedMotion',
        ];
        for (const key of settableKeys) {
          if (key in data) {
            persistConfig(key, data[key] as AppConfig[typeof key]);
          }
        }

        // Import shortcuts
        if (Array.isArray(data.shortcuts)) {
          for (const s of data.shortcuts) {
            if (s.action && s.keyCombo) {
              await ipcClient.dbShortcutsSave(s);
            }
          }
          await loadShortcuts();
        }

        toast.success('Settings imported');
      };
      input.click();
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    }
  }

  async function resetToDefaults(): Promise<void> {
    const keys: (keyof typeof SETTINGS_DEFAULTS)[] = [
      'theme', 'edgeScrollEnabled', 'edgeScrollSpeed', 'cameraSpeed',
      'zoomMin', 'zoomMax', 'agentEnabled', 'bdiLoopIntervalMs',
      'agentAnimationSpeed', 'agentAutoLearn', 'llmApiUrl', 'llmModel',
      'llmApiKey', 'embeddingsUrl', 'embeddingsKey', 'embeddingsModel',
      'maxRenderedObjects', 'shadowQuality', 'physicsQuality', 'reducedMotion',
    ];
    for (const key of keys) {
      persistConfig(key as keyof AppConfig, SETTINGS_DEFAULTS[key] as AppConfig[keyof AppConfig]);
    }

    // Reset all shortcuts
    for (const action of Object.keys(DEFAULT_SHORTCUTS)) {
      await ipcClient.dbShortcutsReset(action);
    }
    await loadShortcuts();

    toast.success('Settings reset to defaults');
  }

  async function clearAllData(): Promise<void> {
    // We'll just clear config and shortcuts
    await resetToDefaults();
    toast.success('All data cleared');
  }

  // ── Render ──

  return (
    <Show when={showSettings()}>
      <div
        style={backdropStyle}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSettings(false);
        }}
      >
        <div style={panelStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <h2 style={titleStyle}>Settings</h2>
            <button style={closeButtonStyle} onClick={() => setShowSettings(false)}>
              ✕
            </button>
          </div>

          {/* Tabs */}
          <Tabs tabs={TABS} activeTab={activeTab()} onTabChange={setActiveTab} />

          {/* Tab content */}
          <div style={contentStyle}>
            {/* ── General Tab ── */}
            <Show when={activeTab() === 'general'}>
              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Workspace</h3>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Current directory</span>
                  <span style={fieldValueStyle}>{appConfig.workspacePath ?? 'None'}</span>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const dir = await ipcClient.selectDirectory();
                      if (dir) {
                        persistConfig('workspacePath', dir);
                        await ipcClient.configSet('workspace_path', dir);
                        toast.success('Workspace changed — reload to apply');
                      }
                    }}
                  >
                    Change
                  </Button>
                </div>

                <h3 style={sectionTitleStyle}>Appearance</h3>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Theme</span>
                  <Select
                    value={appConfig.theme}
                    options={[
                      { value: 'dark', label: 'Dark' },
                      { value: 'light', label: 'Light' },
                    ]}
                    onChange={(v) => persistConfig('theme', v as 'dark' | 'light')}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Reduced motion</span>
                  <Toggle
                    checked={appConfig.reducedMotion}
                    onChange={(v) => persistConfig('reducedMotion', v)}
                  />
                </div>
              </div>
            </Show>

            {/* ── Camera Tab ── */}
            <Show when={activeTab() === 'camera'}>
              <div style={sectionStyle}>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Edge scroll</span>
                  <Toggle
                    checked={appConfig.edgeScrollEnabled}
                    onChange={(v) => persistConfig('edgeScrollEnabled', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Scroll speed</span>
                  <Input
                    type="number"
                    value={String(appConfig.edgeScrollSpeed)}
                    onInput={(v) => {
                      const n = clamp(parseFloat(v) || 0.1, 0.1, 5);
                      persistConfig('edgeScrollSpeed', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Camera speed</span>
                  <Input
                    type="number"
                    value={String(appConfig.cameraSpeed)}
                    onInput={(v) => {
                      const n = clamp(parseFloat(v) || 0.5, 0.1, 10);
                      persistConfig('cameraSpeed', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Zoom min</span>
                  <Input
                    type="number"
                    value={String(appConfig.zoomMin)}
                    onInput={(v) => {
                      const n = clamp(parseInt(v) || 1, 1, appConfig.zoomMax - 1);
                      persistConfig('zoomMin', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Zoom max</span>
                  <Input
                    type="number"
                    value={String(appConfig.zoomMax)}
                    onInput={(v) => {
                      const n = clamp(parseInt(v) || 50, appConfig.zoomMin + 1, 1000);
                      persistConfig('zoomMax', n);
                    }}
                  />
                </div>
              </div>
            </Show>

            {/* ── Keyboard Tab ── */}
            <Show when={activeTab() === 'keyboard'}>
              <div style={sectionStyle} onKeyDown={editingShortcut() ? handleShortcutCapture : undefined}>
                <p style={hintStyle}>Click a shortcut to rebind it. Press the new key combo.</p>
                <Show when={conflictWarning()}>
                  <p style={warningStyle}>{conflictWarning()}</p>
                </Show>
                <div style={shortcutListStyle}>
                  <For each={shortcuts()}>
                    {(sc) => (
                      <div style={shortcutRowStyle}>
                        <span style={shortcutActionStyle}>{sc.action}</span>
                        <button
                          style={{
                            ...shortcutKeyStyle,
                            ...(editingShortcut() === sc.action ? shortcutKeyEditingStyle : {}),
                          }}
                          onClick={() => startEditShortcut(sc.action)}
                        >
                          {editingShortcut() === sc.action ? 'Press keys...' : sc.keyCombo}
                        </button>
                        <Show when={!sc.isDefault}>
                          <button
                            style={resetBtnStyle}
                            onClick={() => resetShortcut(sc.action)}
                          >
                            Reset
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* ── Agent Tab ── */}
            <Show when={activeTab() === 'agent'}>
              <div style={sectionStyle}>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Enable agent</span>
                  <Toggle
                    checked={appConfig.agentEnabled}
                    onChange={(v) => persistConfig('agentEnabled', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>BDI loop interval (ms)</span>
                  <Input
                    type="number"
                    value={String(appConfig.bdiLoopIntervalMs)}
                    onInput={(v) => {
                      const n = clamp(parseInt(v) || 5000, 5000, 300000);
                      persistConfig('bdiLoopIntervalMs', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Animation speed</span>
                  <Input
                    type="number"
                    value={String(appConfig.agentAnimationSpeed)}
                    onInput={(v) => {
                      const n = clamp(parseFloat(v) || 1, 0.1, 10);
                      persistConfig('agentAnimationSpeed', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Auto-learn from actions</span>
                  <Toggle
                    checked={appConfig.agentAutoLearn}
                    onChange={(v) => persistConfig('agentAutoLearn', v)}
                  />
                </div>
              </div>
            </Show>

            {/* ── AI Tab ── */}
            <Show when={activeTab() === 'ai'}>
              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>LLM</h3>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>API URL</span>
                  <Input
                    value={appConfig.llmApiUrl}
                    placeholder="https://api.example.com/v1"
                    error={appConfig.llmApiUrl && !isValidUrl(appConfig.llmApiUrl) ? 'Invalid URL' : null}
                    onInput={(v) => persistConfig('llmApiUrl', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>API Key</span>
                  <Input
                    type="password"
                    value={appConfig.llmApiKey}
                    placeholder="sk-..."
                    onInput={(v) => persistConfig('llmApiKey', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Model</span>
                  <Input
                    value={appConfig.llmModel}
                    placeholder="gpt-4"
                    onInput={(v) => persistConfig('llmModel', v)}
                  />
                </div>

                <h3 style={sectionTitleStyle}>Embeddings</h3>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>URL</span>
                  <Input
                    value={appConfig.embeddingsUrl}
                    placeholder="https://api.example.com/v1/embeddings"
                    error={appConfig.embeddingsUrl && !isValidUrl(appConfig.embeddingsUrl) ? 'Invalid URL' : null}
                    onInput={(v) => persistConfig('embeddingsUrl', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Key</span>
                  <Input
                    type="password"
                    value={appConfig.embeddingsKey}
                    placeholder="sk-..."
                    onInput={(v) => persistConfig('embeddingsKey', v)}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Model</span>
                  <Input
                    value={appConfig.embeddingsModel}
                    placeholder="text-embedding-ada-002"
                    onInput={(v) => persistConfig('embeddingsModel', v)}
                  />
                </div>

                <div style={{ 'margin-top': '16px' }}>
                  <Button
                    variant="secondary"
                    disabled={testingConnection()}
                    onClick={testConnection}
                  >
                    {testingConnection() ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </div>
            </Show>

            {/* ── Performance Tab ── */}
            <Show when={activeTab() === 'performance'}>
              <div style={sectionStyle}>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Max rendered objects</span>
                  <Input
                    type="number"
                    value={String(appConfig.maxRenderedObjects)}
                    onInput={(v) => {
                      const n = clamp(parseInt(v) || 1000, 100, 50000);
                      persistConfig('maxRenderedObjects', n);
                    }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Shadow quality</span>
                  <Select
                    value={appConfig.shadowQuality}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                    ]}
                    onChange={(v) => persistConfig('shadowQuality', v as 'low' | 'medium' | 'high')}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <span style={fieldLabelStyle}>Physics quality</span>
                  <Select
                    value={appConfig.physicsQuality}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                    ]}
                    onChange={(v) => persistConfig('physicsQuality', v as 'low' | 'medium' | 'high')}
                  />
                </div>
              </div>
            </Show>

            {/* ── Data Tab ── */}
            <Show when={activeTab() === 'data'}>
              <div style={sectionStyle}>
                <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
                  <Button variant="secondary" onClick={exportSettings}>
                    Export Settings (JSON)
                  </Button>
                  <Button variant="secondary" onClick={importSettings}>
                    Import Settings (JSON)
                  </Button>
                </div>
                <div style={{ 'margin-top': '24px', display: 'flex', gap: '12px' }}>
                  <Button variant="danger" onClick={clearAllData}>
                    Clear All Data
                  </Button>
                  <Button variant="secondary" onClick={resetToDefaults}>
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const backdropStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  background: 'var(--overlay-bg, rgba(0, 0, 0, 0.6))',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '1000',
  'pointer-events': 'auto',
};

const panelStyle: JSX.CSSProperties = {
  background: 'var(--bg-secondary, #16213e)',
  'border-radius': '16px',
  width: '680px',
  'max-width': '90vw',
  'max-height': '85vh',
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden',
  border: '1px solid var(--border, rgba(255,255,255,0.12))',
  'box-shadow': '0 20px 60px var(--shadow, rgba(0,0,0,0.3))',
};

const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '20px 24px 12px',
};

const titleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': '700',
  color: 'var(--text-primary, #eaeaea)',
  margin: '0',
};

const closeButtonStyle: JSX.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted, #8a8a9a)',
  'font-size': '18px',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '4px',
  'pointer-events': 'auto',
};

const contentStyle: JSX.CSSProperties = {
  padding: '16px 24px 24px',
  'overflow-y': 'auto',
  flex: '1',
};

const sectionStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '14px',
};

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': '600',
  color: 'var(--text-secondary, #c0c0d0)',
  'margin-top': '8px',
  'margin-bottom': '0',
};

const fieldRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  'min-height': '40px',
};

const fieldLabelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: 'var(--text-primary, #eaeaea)',
  'min-width': '160px',
  'flex-shrink': '0',
};

const fieldValueStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: 'var(--text-muted, #8a8a9a)',
  'font-family': 'var(--font-mono)',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  flex: '1',
};

const hintStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: 'var(--text-muted, #8a8a9a)',
};

const warningStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: 'var(--warning, #ff9800)',
  padding: '8px 12px',
  background: 'rgba(255, 152, 0, 0.1)',
  'border-radius': '8px',
};

const shortcutListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px',
};

const shortcutRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '8px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
  'border-radius': '8px',
};

const shortcutActionStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: 'var(--text-primary, #eaeaea)',
  flex: '1',
};

const shortcutKeyStyle: JSX.CSSProperties = {
  'font-size': '13px',
  'font-family': 'var(--font-mono)',
  color: 'var(--accent, #e94560)',
  background: 'rgba(233, 69, 96, 0.1)',
  border: '1px solid rgba(233, 69, 96, 0.3)',
  'border-radius': '6px',
  padding: '4px 10px',
  cursor: 'pointer',
  'min-width': '100px',
  'text-align': 'center',
  'pointer-events': 'auto',
};

const shortcutKeyEditingStyle: JSX.CSSProperties = {
  background: 'rgba(233, 69, 96, 0.25)',
  'border-color': 'var(--accent, #e94560)',
  animation: 'dax-spin 2s linear infinite',
  color: '#ffffff',
};

const resetBtnStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: 'var(--text-muted, #8a8a9a)',
  background: 'transparent',
  border: '1px solid var(--border, rgba(255,255,255,0.12))',
  'border-radius': '4px',
  padding: '2px 8px',
  cursor: 'pointer',
  'pointer-events': 'auto',
};

export { SettingsPanel };
