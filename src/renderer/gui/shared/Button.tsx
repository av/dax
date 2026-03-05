import type { Component, JSX } from 'solid-js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  children: JSX.Element;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  style?: JSX.CSSProperties;
}

const Button: Component<ButtonProps> = (props) => {
  const variant = () => props.variant ?? 'primary';

  const baseStyle: JSX.CSSProperties = {
    border: 'none',
    'border-radius': '8px',
    padding: '10px 20px',
    'font-size': '14px',
    'font-weight': '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    'pointer-events': 'auto',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '8px',
  };

  const variantStyles: Record<ButtonVariant, JSX.CSSProperties> = {
    primary: {
      background: '#e94560',
      color: '#ffffff',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#e0e0e0',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    danger: {
      background: '#ff4444',
      color: '#ffffff',
    },
    ghost: {
      background: 'transparent',
      color: '#a0a0b0',
    },
  };

  const disabledStyle: JSX.CSSProperties = {
    opacity: '0.5',
    cursor: 'not-allowed',
  };

  return (
    <button
      style={{
        ...baseStyle,
        ...variantStyles[variant()],
        ...(props.disabled ? disabledStyle : {}),
        ...(props.style ?? {}),
      }}
      disabled={props.disabled}
      onClick={() => !props.disabled && props.onClick?.()}
    >
      {props.children}
    </button>
  );
};

export { Button };
