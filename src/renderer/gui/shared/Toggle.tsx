import { type Component, type JSX } from 'solid-js';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Toggle: Component<ToggleProps> = (props) => {
  return (
    <label style={wrapperStyle}>
      <div
        style={{
          ...trackStyle,
          ...(props.checked ? trackCheckedStyle : {}),
          ...(props.disabled ? disabledStyle : {}),
        }}
        onClick={() => !props.disabled && props.onChange(!props.checked)}
      >
        <div
          style={{
            ...thumbStyle,
            ...(props.checked ? thumbCheckedStyle : {}),
          }}
        />
      </div>
      {props.label && <span style={labelStyle}>{props.label}</span>}
    </label>
  );
};

const wrapperStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '10px',
  cursor: 'pointer',
  'pointer-events': 'auto',
};

const trackStyle: JSX.CSSProperties = {
  width: '40px',
  height: '22px',
  'border-radius': '11px',
  background: 'rgba(255, 255, 255, 0.15)',
  position: 'relative',
  transition: 'background 0.2s ease',
  cursor: 'pointer',
  'flex-shrink': '0',
};

const trackCheckedStyle: JSX.CSSProperties = {
  background: 'var(--accent, #e94560)',
};

const thumbStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  'border-radius': '50%',
  background: '#ffffff',
  position: 'absolute',
  top: '2px',
  left: '2px',
  transition: 'transform 0.2s ease',
};

const thumbCheckedStyle: JSX.CSSProperties = {
  transform: 'translateX(18px)',
};

const disabledStyle: JSX.CSSProperties = {
  opacity: '0.5',
  cursor: 'not-allowed',
};

const labelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: 'var(--text-primary, #eaeaea)',
};

export { Toggle };
