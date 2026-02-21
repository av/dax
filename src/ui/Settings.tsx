import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AppSettings, LLMConfig } from '@/types';

export default function Settings() {
  const isOpen = useSettingsStore((s) => s.isSettingsOpen);
  const savedSettings = useSettingsStore((s) => s.settings);
  const isTestingConnection = useSettingsStore((s) => s.isTestingConnection);
  const connectionTestResult = useSettingsStore((s) => s.connectionTestResult);
  const connectionTestError = useSettingsStore((s) => s.connectionTestError);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const testConnection = useSettingsStore((s) => s.testConnection);
  const updateLLMConfig = useSettingsStore((s) => s.updateLLMConfig);

  // Local draft state for editing before save
  const [draft, setDraft] = useState<AppSettings>(savedSettings);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync draft when panel opens or saved settings change externally
  useEffect(() => {
    if (isOpen) {
      setDraft(savedSettings);
    }
  }, [isOpen, savedSettings]);

  const updateDraftLLM = useCallback((partial: Partial<LLMConfig>) => {
    setDraft((prev) => ({
      ...prev,
      llm: { ...prev.llm, ...partial },
    }));
    // Also update the store so testConnection uses the latest values
    updateLLMConfig(partial);
  }, [updateLLMConfig]);

  const handleSave = useCallback(() => {
    void saveSettings(draft);
    closeSettings();
  }, [draft, saveSettings, closeSettings]);

  const handleCancel = useCallback(() => {
    closeSettings();
  }, [closeSettings]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        closeSettings();
      }
    },
    [closeSettings],
  );

  if (!isOpen) return null;

  const llm = draft.llm;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: '#1a1b26',
          border: '1px solid #292e42',
          borderRadius: '12px',
          width: '520px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          color: '#c0caf5',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#7aa2f7' }}>
            Settings
          </h2>
          <button onClick={handleCancel} style={closeButtonStyle}>
            ✕
          </button>
        </div>

        {/* LLM Configuration Section */}
        <SectionTitle>LLM Configuration</SectionTitle>

        <FieldLabel>API Endpoint URL</FieldLabel>
        <input
          type="text"
          value={llm.apiEndpoint}
          onChange={(e) => updateDraftLLM({ apiEndpoint: e.target.value })}
          placeholder="https://api.openai.com/v1"
          style={inputStyle}
        />

        <FieldLabel>API Key</FieldLabel>
        <input
          type="password"
          value={llm.apiKey}
          onChange={(e) => updateDraftLLM({ apiKey: e.target.value })}
          placeholder="sk-..."
          style={inputStyle}
          autoComplete="off"
        />

        <FieldLabel>Model Name</FieldLabel>
        <input
          type="text"
          value={llm.modelName}
          onChange={(e) => updateDraftLLM({ modelName: e.target.value })}
          placeholder="gpt-4"
          style={inputStyle}
        />

        <FieldLabel>Temperature: {llm.temperature.toFixed(1)}</FieldLabel>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={llm.temperature}
          onChange={(e) => updateDraftLLM({ temperature: parseFloat(e.target.value) })}
          style={rangeStyle}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#565f89', marginBottom: '12px' }}>
          <span>0.0 (deterministic)</span>
          <span>2.0 (creative)</span>
        </div>

        <FieldLabel>Max Tokens</FieldLabel>
        <input
          type="number"
          value={llm.maxTokens}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
              updateDraftLLM({ maxTokens: val });
            }
          }}
          min={1}
          max={128000}
          style={inputStyle}
        />

        <FieldLabel>System Prompt Override</FieldLabel>
        <textarea
          value={llm.systemPromptOverride ?? ''}
          onChange={(e) =>
            updateDraftLLM({
              systemPromptOverride: e.target.value || null,
            })
          }
          placeholder="Override the default agent system prompt (leave blank for default)"
          rows={4}
          style={textareaStyle}
        />

        {/* Connection Test Section */}
        <SectionTitle>Connection Test</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => void testConnection()}
            disabled={isTestingConnection || !llm.apiEndpoint || !llm.modelName}
            style={{
              ...actionButtonStyle,
              opacity: isTestingConnection || !llm.apiEndpoint || !llm.modelName ? 0.5 : 1,
              cursor: isTestingConnection || !llm.apiEndpoint || !llm.modelName ? 'not-allowed' : 'pointer',
            }}
          >
            {isTestingConnection ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Spinner /> Testing…
              </span>
            ) : (
              'Test Connection'
            )}
          </button>

          {connectionTestResult === 'success' && (
            <span style={{ color: '#9ece6a', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '16px' }}>✓</span> Connection successful
            </span>
          )}
          {connectionTestResult === 'error' && (
            <span style={{ color: '#f7768e', fontSize: '13px', maxWidth: '300px' }}>
              <span style={{ fontSize: '16px' }}>✗</span>{' '}
              {connectionTestError ?? 'Connection failed'}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #292e42',
          }}
        >
          <button onClick={handleCancel} style={cancelButtonStyle}>
            Cancel
          </button>
          <button onClick={handleSave} style={saveButtonStyle}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: '13px',
        fontWeight: 600,
        color: '#565f89',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop: '20px',
        marginBottom: '12px',
      }}
    >
      {children}
    </h3>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '13px',
        color: '#a9b1d6',
        marginBottom: '4px',
        fontWeight: 500,
      }}
    >
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid #565f89',
        borderTopColor: '#7aa2f7',
        borderRadius: '50%',
        animation: 'dax-spin 0.6s linear infinite',
      }}
    />
  );
}

/* ── Shared styles ──────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: '13px',
  background: '#16161e',
  color: '#c0caf5',
  border: '1px solid #292e42',
  borderRadius: '6px',
  outline: 'none',
  marginBottom: '12px',
  fontFamily: 'monospace',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'monospace',
  lineHeight: 1.5,
};

const rangeStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '2px',
  accentColor: '#7aa2f7',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#565f89',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  lineHeight: 1,
};

const actionButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  background: '#292e42',
  color: '#7aa2f7',
  border: '1px solid #3b4261',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: '13px',
  background: 'transparent',
  color: '#565f89',
  border: '1px solid #292e42',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 24px',
  fontSize: '13px',
  background: '#7aa2f7',
  color: '#1a1b26',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
};
