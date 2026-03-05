/**
 * File viewer overlay — displays file content in a modal.
 *
 * Supports text, markdown, JSON (formatted), and image preview.
 * Press Escape to close.
 */
import { type Component, Show, createEffect, onCleanup } from 'solid-js';
import { fileViewer, closeFileViewer } from '../../state/ui';

export const FileViewer: Component = () => {
  const state = fileViewer;

  // Escape key to close
  createEffect(() => {
    if (!state().open) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        closeFileViewer();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  function renderContent(): string {
    const s = state();
    if (!s.content) return '';

    if (s.fileType === 'json') {
      try {
        return JSON.stringify(JSON.parse(s.content), null, 2);
      } catch {
        return s.content;
      }
    }

    return s.content;
  }

  return (
    <Show when={state().open}>
      <div style={backdropStyle} onClick={() => closeFileViewer()}>
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={headerStyle}>
            <span style={fileNameStyle}>
              {state().filePath?.split('/').pop() ?? 'File'}
            </span>
            <span style={fileTypeStyle}>{state().fileType}</span>
            <button
              style={closeButtonStyle}
              onClick={() => closeFileViewer()}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={contentStyle}>
            <Show when={state().fileType === 'image'}>
              <div style={imageCenterStyle}>
                <img
                  src={`file://${state().absPath}`}
                  alt={state().filePath ?? ''}
                  style={imageStyle}
                />
              </div>
            </Show>
            <Show when={state().fileType !== 'image'}>
              <pre style={preStyle}>{renderContent()}</pre>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const backdropStyle: Record<string, string> = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.6)',
  'z-index': '900',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'pointer-events': 'auto',
};

const panelStyle: Record<string, string> = {
  width: '70vw',
  'max-width': '900px',
  'max-height': '80vh',
  background: 'rgba(22, 22, 32, 0.98)',
  'backdrop-filter': 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '12px',
  'box-shadow': '0 16px 64px rgba(0, 0, 0, 0.6)',
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden',
};

const headerStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '14px 20px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.06)',
};

const fileNameStyle: Record<string, string> = {
  'font-size': '14px',
  'font-weight': '600',
  color: '#e0e0e8',
  'font-family': 'monospace',
};

const fileTypeStyle: Record<string, string> = {
  'font-size': '11px',
  color: '#6a6a7a',
  background: 'rgba(255, 255, 255, 0.06)',
  padding: '2px 8px',
  'border-radius': '4px',
  'font-family': 'monospace',
};

const closeButtonStyle: Record<string, string> = {
  'margin-left': 'auto',
  background: 'none',
  border: 'none',
  color: '#8a8a9a',
  'font-size': '16px',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '4px',
};

const contentStyle: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '16px 20px',
};

const preStyle: Record<string, string> = {
  margin: '0',
  'font-size': '13px',
  'line-height': '1.6',
  color: '#c0c0d0',
  'font-family': "'JetBrains Mono', 'Fira Code', monospace",
  'white-space': 'pre-wrap',
  'word-break': 'break-all',
};

const imageCenterStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
};

const imageStyle: Record<string, string> = {
  'max-width': '100%',
  'max-height': '60vh',
  'border-radius': '4px',
};
