/**
 * Tooltip overlay — shows file/folder name and type on hover.
 */
import { type Component, Show } from 'solid-js';
import { tooltip } from '../../state/ui';

export const Tooltip: Component = () => {
  const state = tooltip;

  return (
    <Show when={state().visible}>
      <div
        style={{
          ...tooltipStyle,
          left: `${state().x}px`,
          top: `${state().y}px`,
        }}
      >
        <span style={nameStyle}>{state().name}</span>
        <span style={typeStyle}>{state().type}</span>
        <Show when={state().size}>
          <span style={sizeStyle}>{state().size}</span>
        </Show>
      </div>
    </Show>
  );
};

// ── Styles ──

const tooltipStyle: Record<string, string> = {
  position: 'fixed',
  'pointer-events': 'none',
  background: 'rgba(20, 20, 30, 0.92)',
  'backdrop-filter': 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '6px',
  padding: '6px 10px',
  'z-index': '1200',
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'max-width': '250px',
};

const nameStyle: Record<string, string> = {
  'font-size': '12px',
  color: '#e0e0e8',
  'font-weight': '500',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
};

const typeStyle: Record<string, string> = {
  'font-size': '10px',
  color: '#8a8a9a',
  'text-transform': 'capitalize',
};

const sizeStyle: Record<string, string> = {
  'font-size': '10px',
  color: '#6a6a7a',
  'font-family': 'monospace',
};
