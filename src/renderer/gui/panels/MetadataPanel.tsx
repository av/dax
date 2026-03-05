/**
 * Metadata panel — sidebar showing file/folder properties.
 *
 * Displays: name, path, type, size, created date, modified date.
 */
import { type Component, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { showMetadata, setShowMetadata } from '../../state/ui';
import { selectedIds } from '../../state/selection';

export interface MetadataInfo {
  name: string;
  path: string;
  absPath: string;
  type: string;
  size: string;
  created: string;
  modified: string;
}

export interface MetadataPanelCallbacks {
  onLoadMetadata: (path: string) => Promise<MetadataInfo | null>;
}

export const MetadataPanel: Component<{ callbacks: MetadataPanelCallbacks }> = (
  props,
) => {
  const [meta, setMeta] = createSignal<MetadataInfo | null>(null);
  const [loading, setLoading] = createSignal(false);

  // Load metadata when selection changes
  createEffect(() => {
    const ids = selectedIds();
    if (!showMetadata() || ids.size === 0) {
      setMeta(null);
      return;
    }

    // Show metadata for the first selected item
    const firstPath = Array.from(ids)[0];
    setLoading(true);
    props.callbacks
      .onLoadMetadata(firstPath)
      .then((info) => {
        setMeta(info);
      })
      .catch(() => {
        setMeta(null);
      })
      .finally(() => {
        setLoading(false);
      });
  });

  // Escape to close
  createEffect(() => {
    if (!showMetadata()) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setShowMetadata(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <Show when={showMetadata()}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>Properties</span>
          <button
            style={closeStyle}
            onClick={() => setShowMetadata(false)}
          >
            ✕
          </button>
        </div>
        <div style={bodyStyle}>
          <Show when={loading()}>
            <div style={loadingStyle}>Loading...</div>
          </Show>
          <Show when={!loading() && !meta()}>
            <div style={emptyStyle}>Select a file to view properties</div>
          </Show>
          <Show when={!loading() && meta()}>
            <div style={rowStyle}>
              <span style={labelStyle}>Name</span>
              <span style={valueStyle}>{meta()!.name}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Path</span>
              <span style={{ ...valueStyle, ...monoStyle }}>{meta()!.path}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Type</span>
              <span style={valueStyle}>{meta()!.type}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Size</span>
              <span style={valueStyle}>{meta()!.size}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Created</span>
              <span style={valueStyle}>{meta()!.created}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Modified</span>
              <span style={valueStyle}>{meta()!.modified}</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const panelStyle: Record<string, string> = {
  position: 'fixed',
  right: '0',
  top: '0',
  width: '280px',
  height: '100vh',
  background: 'rgba(22, 22, 32, 0.95)',
  'backdrop-filter': 'blur(12px)',
  'border-left': '1px solid rgba(255, 255, 255, 0.08)',
  'z-index': '800',
  display: 'flex',
  'flex-direction': 'column',
  'pointer-events': 'auto',
};

const headerStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '16px 18px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.06)',
};

const titleStyle: Record<string, string> = {
  'font-size': '14px',
  'font-weight': '600',
  color: '#e0e0e8',
};

const closeStyle: Record<string, string> = {
  background: 'none',
  border: 'none',
  color: '#8a8a9a',
  'font-size': '14px',
  cursor: 'pointer',
  padding: '4px',
};

const bodyStyle: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '16px 18px',
};

const rowStyle: Record<string, string> = {
  'margin-bottom': '16px',
};

const labelStyle: Record<string, string> = {
  display: 'block',
  'font-size': '11px',
  color: '#6a6a7a',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
  'margin-bottom': '4px',
};

const valueStyle: Record<string, string> = {
  display: 'block',
  'font-size': '13px',
  color: '#c0c0d0',
  'word-break': 'break-all',
};

const monoStyle: Record<string, string> = {
  'font-family': "'JetBrains Mono', monospace",
  'font-size': '12px',
};

const loadingStyle: Record<string, string> = {
  'font-size': '13px',
  color: '#6a6a7a',
  'text-align': 'center',
  'margin-top': '24px',
};

const emptyStyle: Record<string, string> = {
  'font-size': '13px',
  color: '#6a6a7a',
  'text-align': 'center',
  'margin-top': '24px',
};
