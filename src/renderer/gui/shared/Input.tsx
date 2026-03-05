import { type Component, type JSX, createSignal } from 'solid-js';

export interface InputProps {
  value?: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  disabled?: boolean;
  error?: string | null;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  style?: JSX.CSSProperties;
  autofocus?: boolean;
}

const Input: Component<InputProps> = (props) => {
  const [focused, setFocused] = createSignal(false);

  const baseStyle: JSX.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    'border-radius': '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    'font-size': '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    width: '100%',
    'box-sizing': 'border-box',
    'pointer-events': 'auto',
  };

  const focusedStyle: JSX.CSSProperties = {
    'border-color': '#e94560',
    background: 'rgba(255, 255, 255, 0.08)',
  };

  const errorStyle: JSX.CSSProperties = {
    'border-color': '#ff4444',
  };

  const errorTextStyle: JSX.CSSProperties = {
    color: '#ff4444',
    'font-size': '12px',
    'margin-top': '4px',
  };

  return (
    <div style={{ width: '100%' }}>
      <input
        type={props.type ?? 'text'}
        value={props.value ?? ''}
        placeholder={props.placeholder}
        disabled={props.disabled}
        autofocus={props.autofocus}
        style={{
          ...baseStyle,
          ...(focused() ? focusedStyle : {}),
          ...(props.error ? errorStyle : {}),
          ...(props.style ?? {}),
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(e) => props.onInput?.(e.currentTarget.value)}
        onChange={(e) => props.onChange?.(e.currentTarget.value)}
        onKeyDown={(e) => props.onKeyDown?.(e)}
      />
      {props.error && <div style={errorTextStyle}>{props.error}</div>}
    </div>
  );
};

export { Input };
