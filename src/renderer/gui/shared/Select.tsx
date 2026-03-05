import { type Component, type JSX, For } from 'solid-js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: JSX.CSSProperties;
}

const Select: Component<SelectProps> = (props) => {
  return (
    <select
      style={{
        ...selectStyle,
        ...(props.disabled ? disabledStyle : {}),
        ...(props.style ?? {}),
      }}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <For each={props.options}>
        {(opt) => (
          <option value={opt.value}>{opt.label}</option>
        )}
      </For>
    </select>
  );
};

const selectStyle: JSX.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
  'border-radius': '8px',
  padding: '8px 12px',
  color: 'var(--text-primary, #e0e0e0)',
  'font-size': '14px',
  outline: 'none',
  cursor: 'pointer',
  'pointer-events': 'auto',
  'min-width': '120px',
};

const disabledStyle: JSX.CSSProperties = {
  opacity: '0.5',
  cursor: 'not-allowed',
};

export { Select };
