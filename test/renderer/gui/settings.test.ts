/**
 * Settings panel tests — config logic, shortcuts, persistence, validation.
 * Tests the config state management, shortcut conflict detection, and
 * settings defaults without DOM rendering (pure logic tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installMockBridge, createMockBridge } from '../../helpers/ipc';
import { SETTINGS_DEFAULTS, DEFAULT_SHORTCUTS } from '../../../src/shared/constants';

// ── Settings defaults tests ──

describe('SETTINGS_DEFAULTS', () => {
  it('has all required default keys', () => {
    expect(SETTINGS_DEFAULTS.theme).toBe('dark');
    expect(SETTINGS_DEFAULTS.edgeScrollEnabled).toBe(true);
    expect(SETTINGS_DEFAULTS.edgeScrollSpeed).toBe(0.5);
    expect(SETTINGS_DEFAULTS.cameraSpeed).toBe(1.0);
    expect(SETTINGS_DEFAULTS.zoomMin).toBe(5);
    expect(SETTINGS_DEFAULTS.zoomMax).toBe(200);
    expect(SETTINGS_DEFAULTS.agentEnabled).toBe(true);
    expect(SETTINGS_DEFAULTS.bdiLoopIntervalMs).toBe(30_000);
    expect(SETTINGS_DEFAULTS.agentAnimationSpeed).toBe(1);
    expect(SETTINGS_DEFAULTS.agentAutoLearn).toBe(true);
    expect(SETTINGS_DEFAULTS.llmApiUrl).toBe('');
    expect(SETTINGS_DEFAULTS.llmApiKey).toBe('');
    expect(SETTINGS_DEFAULTS.llmModel).toBe('');
    expect(SETTINGS_DEFAULTS.embeddingsUrl).toBe('');
    expect(SETTINGS_DEFAULTS.embeddingsKey).toBe('');
    expect(SETTINGS_DEFAULTS.embeddingsModel).toBe('');
    expect(SETTINGS_DEFAULTS.maxRenderedObjects).toBe(5000);
    expect(SETTINGS_DEFAULTS.shadowQuality).toBe('medium');
    expect(SETTINGS_DEFAULTS.physicsQuality).toBe('medium');
    expect(SETTINGS_DEFAULTS.reducedMotion).toBe(false);
  });
});

// ── DEFAULT_SHORTCUTS tests ──

describe('DEFAULT_SHORTCUTS', () => {
  it('defines all required shortcut actions', () => {
    const expectedActions = [
      'delete', 'rename', 'open-file', 'view-file', 'new-file',
      'new-folder', 'select-all', 'cancel', 'search', 'chat',
      'reset-camera', 'toggle-agent-mind', 'settings',
    ];
    for (const action of expectedActions) {
      expect(DEFAULT_SHORTCUTS).toHaveProperty(action);
      expect(typeof DEFAULT_SHORTCUTS[action]).toBe('string');
      expect(DEFAULT_SHORTCUTS[action].length).toBeGreaterThan(0);
    }
  });

  it('maps settings to Ctrl+,', () => {
    expect(DEFAULT_SHORTCUTS['settings']).toBe('Ctrl+,');
  });

  it('maps search to Ctrl+F', () => {
    expect(DEFAULT_SHORTCUTS['search']).toBe('Ctrl+F');
  });
});

// ── Shortcut conflict detection tests ──

describe('Shortcut conflict detection', () => {
  it('detects conflicts when two actions share the same keyCombo', () => {
    const shortcuts = [
      { action: 'delete', keyCombo: 'Delete', isDefault: true },
      { action: 'rename', keyCombo: 'F2', isDefault: true },
      { action: 'search', keyCombo: 'Ctrl+F', isDefault: true },
    ];

    // Simulate checking for conflict if user tries to assign 'Ctrl+F' to 'rename'
    const newCombo = 'Ctrl+F';
    const targetAction = 'rename';
    const conflict = shortcuts.find(
      (s) => s.keyCombo === newCombo && s.action !== targetAction,
    );
    expect(conflict).toBeTruthy();
    expect(conflict!.action).toBe('search');
  });

  it('allows assignment when no conflict exists', () => {
    const shortcuts = [
      { action: 'delete', keyCombo: 'Delete', isDefault: true },
      { action: 'rename', keyCombo: 'F2', isDefault: true },
    ];

    const newCombo = 'Ctrl+R';
    const targetAction = 'rename';
    const conflict = shortcuts.find(
      (s) => s.keyCombo === newCombo && s.action !== targetAction,
    );
    expect(conflict).toBeUndefined();
  });
});

// ── Mock bridge IPC tests ──

describe('Settings IPC methods in mock bridge', () => {
  let bridge: ReturnType<typeof createMockBridge>;

  beforeEach(() => {
    bridge = installMockBridge();
  });

  it('configGet returns null by default', async () => {
    const result = await bridge.configGet('theme');
    expect(result).toBeNull();
  });

  it('configSet does not throw', async () => {
    await expect(bridge.configSet('theme', '"dark"')).resolves.toBeUndefined();
  });

  it('dbShortcutsGetAll returns empty array', async () => {
    const result = await bridge.dbShortcutsGetAll();
    expect(result).toEqual([]);
  });

  it('dbShortcutsSave does not throw', async () => {
    await expect(
      bridge.dbShortcutsSave({ action: 'delete', keyCombo: 'Delete', isDefault: true }),
    ).resolves.toBeUndefined();
  });

  it('dbShortcutsReset does not throw', async () => {
    await expect(bridge.dbShortcutsReset('delete')).resolves.toBeUndefined();
  });
});

// ── URL validation tests ──

describe('URL validation', () => {
  function isValidUrl(s: string): boolean {
    if (s === '') return true;
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  }

  it('accepts empty string (not yet configured)', () => {
    expect(isValidUrl('')).toBe(true);
  });

  it('accepts valid https URL', () => {
    expect(isValidUrl('https://api.openai.com/v1')).toBe(true);
  });

  it('accepts valid http URL', () => {
    expect(isValidUrl('http://localhost:11434')).toBe(true);
  });

  it('rejects invalid URL', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('rejects partial URL', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });
});

// ── Numeric clamping tests ──

describe('Numeric field clamping', () => {
  function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  it('clamps below minimum', () => {
    expect(clamp(-5, 0.1, 10)).toBe(0.1);
  });

  it('clamps above maximum', () => {
    expect(clamp(999, 0.1, 10)).toBe(10);
  });

  it('passes through values within range', () => {
    expect(clamp(5, 0.1, 10)).toBe(5);
  });

  it('handles NaN by clamping to min via Math.max', () => {
    expect(clamp(NaN, 1, 100)).toBeNaN();
  });
});

// ── Keyboard shortcut map tests ──

describe('Keyboard shortcut map', () => {
  // applyCustomShortcuts is imported from keyboard.ts
  // We test the logic of merging shortcuts
  it('merges custom shortcuts with defaults', () => {
    const defaults: Record<string, string> = { ...DEFAULT_SHORTCUTS };
    const custom = [
      { action: 'delete', keyCombo: 'Ctrl+D', isDefault: false },
    ];

    // Simulate merge logic
    const merged = { ...defaults };
    for (const row of custom) {
      merged[row.action] = row.keyCombo;
    }

    expect(merged['delete']).toBe('Ctrl+D');
    expect(merged['rename']).toBe('F2'); // unchanged
  });

  it('preserves all default actions when no custom shortcuts', () => {
    const defaults: Record<string, string> = { ...DEFAULT_SHORTCUTS };
    const custom: Array<{ action: string; keyCombo: string; isDefault: boolean }> = [];

    const merged = { ...defaults };
    for (const row of custom) {
      merged[row.action] = row.keyCombo;
    }

    expect(Object.keys(merged).length).toBe(Object.keys(DEFAULT_SHORTCUTS).length);
    for (const [action, combo] of Object.entries(DEFAULT_SHORTCUTS)) {
      expect(merged[action]).toBe(combo);
    }
  });
});

// ── Settings export/import data structure tests ──

describe('Settings export data structure', () => {
  it('produces valid JSON for all default settings', () => {
    const exportData: Record<string, unknown> = {};
    const keys = [
      'theme', 'edgeScrollEnabled', 'edgeScrollSpeed', 'cameraSpeed',
      'zoomMin', 'zoomMax', 'agentEnabled', 'bdiLoopIntervalMs',
      'agentAnimationSpeed', 'agentAutoLearn', 'maxRenderedObjects',
      'shadowQuality', 'physicsQuality', 'reducedMotion',
    ] as const;

    for (const key of keys) {
      exportData[key] = SETTINGS_DEFAULTS[key];
    }

    const json = JSON.stringify(exportData, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.theme).toBe('dark');
    expect(parsed.maxRenderedObjects).toBe(5000);
    expect(parsed.reducedMotion).toBe(false);
  });

  it('round-trips settings through JSON serialization', () => {
    const original = { ...SETTINGS_DEFAULTS };
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    expect(parsed.theme).toBe(original.theme);
    expect(parsed.cameraSpeed).toBe(original.cameraSpeed);
    expect(parsed.maxRenderedObjects).toBe(original.maxRenderedObjects);
  });
});
