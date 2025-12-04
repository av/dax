/**
 * SandboxPanel - Code execution sandbox UI
 * 
 * Provides an interface for running code snippets in isolated environments
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  executeCode,
  cancelExecution,
  listAvailableRuntimes,
  type SandboxLanguage,
  type ExecutionResult,
  type RuntimeInfo,
  type SandboxPermissions,
  DEFAULT_PERMISSIONS,
} from '../../services/sandbox';

interface SandboxPanelProps {
  onClose?: () => void;
  initialCode?: string;
  initialLanguage?: SandboxLanguage;
}

export const SandboxPanel: React.FC<SandboxPanelProps> = ({
  onClose,
  initialCode = '',
  initialLanguage = 'python',
}) => {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState<SandboxLanguage>(initialLanguage);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<SandboxPermissions>(DEFAULT_PERMISSIONS);
  const [showPermissions, setShowPermissions] = useState(false);

  // Load available runtimes on mount
  useEffect(() => {
    listAvailableRuntimes()
      .then(setRuntimes)
      .catch((err) => setError(`Failed to load runtimes: ${err}`));
  }, []);

  // Check if current language is available
  const isCurrentRuntimeAvailable = useCallback(() => {
    const runtime = runtimes.find((r) => r.language === language);
    return runtime?.available ?? false;
  }, [runtimes, language]);

  // Run code
  const handleRun = useCallback(async () => {
    if (!code.trim() || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const execResult = await executeCode(code, language, { permissions });
      setCurrentExecutionId(execResult.id);
      setResult(execResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setCurrentExecutionId(null);
    }
  }, [code, language, permissions, isRunning]);

  // Cancel execution
  const handleCancel = useCallback(async () => {
    if (!currentExecutionId) return;

    try {
      await cancelExecution(currentExecutionId);
    } catch (err) {
      setError(`Failed to cancel: ${err}`);
    }
  }, [currentExecutionId]);

  // Clear output
  const handleClear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#4ade80';
      case 'failed':
        return '#f87171';
      case 'timeout':
        return '#fbbf24';
      case 'cancelled':
        return '#9ca3af';
      default:
        return '#60a5fa';
    }
  };

  // Get runtime version
  const getRuntimeVersion = (lang: string): string => {
    const runtime = runtimes.find((r) => r.language === lang);
    return runtime?.version || 'Not available';
  };

  return (
    <div className="sandbox-panel">
      <div className="sandbox-header">
        <h3>Code Sandbox</h3>
        <div className="sandbox-controls">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as SandboxLanguage)}
            disabled={isRunning}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="shell">Shell</option>
          </select>
          <span className="runtime-version">{getRuntimeVersion(language)}</span>
          <button
            className="icon-button"
            onClick={() => setShowPermissions(!showPermissions)}
            title="Permissions"
          >
            ⚙️
          </button>
          {onClose && (
            <button className="icon-button" onClick={onClose} title="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      {showPermissions && (
        <div className="sandbox-permissions">
          <h4>Permissions</h4>
          <label>
            <input
              type="checkbox"
              checked={permissions.readFiles}
              onChange={(e) =>
                setPermissions({ ...permissions, readFiles: e.target.checked })
              }
            />
            Read Files
          </label>
          <label>
            <input
              type="checkbox"
              checked={permissions.writeFiles}
              onChange={(e) =>
                setPermissions({ ...permissions, writeFiles: e.target.checked })
              }
            />
            Write Files
          </label>
          <label>
            <input
              type="checkbox"
              checked={permissions.networkAccess}
              onChange={(e) =>
                setPermissions({ ...permissions, networkAccess: e.target.checked })
              }
            />
            Network Access
          </label>
          <label>
            Timeout (ms):
            <input
              type="number"
              value={permissions.maxExecutionMs}
              onChange={(e) =>
                setPermissions({
                  ...permissions,
                  maxExecutionMs: parseInt(e.target.value) || 30000,
                })
              }
              min={1000}
              max={300000}
            />
          </label>
          <label>
            Max Memory (MB):
            <input
              type="number"
              value={permissions.maxMemoryMb}
              onChange={(e) =>
                setPermissions({
                  ...permissions,
                  maxMemoryMb: parseInt(e.target.value) || 256,
                })
              }
              min={64}
              max={1024}
            />
          </label>
        </div>
      )}

      <div className="sandbox-editor">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={`Enter ${language} code...`}
          disabled={isRunning}
          spellCheck={false}
        />
      </div>

      <div className="sandbox-actions">
        {isRunning ? (
          <button className="cancel-button" onClick={handleCancel}>
            ⏹ Cancel
          </button>
        ) : (
          <button
            className="run-button"
            onClick={handleRun}
            disabled={!code.trim() || !isCurrentRuntimeAvailable()}
          >
            ▶ Run
          </button>
        )}
        <button className="clear-button" onClick={handleClear} disabled={isRunning}>
          Clear
        </button>
      </div>

      {!isCurrentRuntimeAvailable() && (
        <div className="sandbox-warning">
          ⚠️ {language.charAt(0).toUpperCase() + language.slice(1)} runtime not available.
          Please install it to run code.
        </div>
      )}

      {error && <div className="sandbox-error">❌ {error}</div>}

      {result && (
        <div className="sandbox-output">
          <div className="output-header">
            <span
              className="status-badge"
              style={{ backgroundColor: getStatusColor(result.status) }}
            >
              {result.status}
            </span>
            <span className="execution-time">{result.executionMs}ms</span>
            {result.exitCode !== null && (
              <span className="exit-code">Exit: {result.exitCode}</span>
            )}
          </div>

          {result.stdout && (
            <div className="output-section">
              <h5>Output</h5>
              <pre>{result.stdout}</pre>
            </div>
          )}

          {result.stderr && (
            <div className="output-section stderr">
              <h5>Errors</h5>
              <pre>{result.stderr}</pre>
            </div>
          )}

          {!result.stdout && !result.stderr && (
            <div className="output-empty">No output</div>
          )}
        </div>
      )}

      <style>{`
        .sandbox-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-secondary, #1e1e1e);
          color: var(--text-primary, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }

        .sandbox-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-tertiary, #252525);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .sandbox-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .sandbox-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sandbox-controls select {
          padding: 4px 8px;
          border-radius: 4px;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--border-color, #333);
        }

        .runtime-version {
          font-size: 11px;
          color: var(--text-secondary, #888);
        }

        .icon-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .icon-button:hover {
          opacity: 1;
        }

        .sandbox-permissions {
          padding: 12px 16px;
          background: var(--bg-tertiary, #252525);
          border-bottom: 1px solid var(--border-color, #333);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .sandbox-permissions h4 {
          width: 100%;
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .sandbox-permissions label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
        }

        .sandbox-permissions input[type="number"] {
          width: 80px;
          padding: 2px 6px;
          margin-left: 8px;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
        }

        .sandbox-editor {
          flex: 1;
          min-height: 120px;
          padding: 8px;
        }

        .sandbox-editor textarea {
          width: 100%;
          height: 100%;
          padding: 12px;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
        }

        .sandbox-editor textarea:focus {
          outline: none;
          border-color: var(--accent-color, #4a9eff);
        }

        .sandbox-actions {
          display: flex;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-tertiary, #252525);
        }

        .run-button,
        .cancel-button,
        .clear-button {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .run-button {
          background: #4ade80;
          color: #000;
          border: none;
        }

        .run-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cancel-button {
          background: #f87171;
          color: #fff;
          border: none;
        }

        .clear-button {
          background: transparent;
          color: var(--text-secondary, #888);
          border: 1px solid var(--border-color, #333);
        }

        .sandbox-warning {
          padding: 8px 16px;
          background: #fbbf24;
          color: #000;
          font-size: 12px;
        }

        .sandbox-error {
          padding: 8px 16px;
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
          font-size: 12px;
        }

        .sandbox-output {
          flex: 1;
          min-height: 100px;
          overflow: auto;
          padding: 16px;
          background: var(--bg-primary, #1a1a1a);
          border-top: 1px solid var(--border-color, #333);
        }

        .output-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .status-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #000;
        }

        .execution-time,
        .exit-code {
          font-size: 11px;
          color: var(--text-secondary, #888);
        }

        .output-section {
          margin-bottom: 12px;
        }

        .output-section h5 {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary, #888);
        }

        .output-section pre {
          margin: 0;
          padding: 12px;
          background: var(--bg-tertiary, #252525);
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .output-section.stderr pre {
          background: rgba(248, 113, 113, 0.1);
          color: #f87171;
        }

        .output-empty {
          color: var(--text-secondary, #888);
          font-style: italic;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

export default SandboxPanel;
