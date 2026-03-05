import type { Component, JSX } from 'solid-js';

export interface SpinnerProps {
  size?: number;
  color?: string;
  style?: JSX.CSSProperties;
}

const Spinner: Component<SpinnerProps> = (props) => {
  const size = () => props.size ?? 24;
  const color = () => props.color ?? '#e94560';

  return (
    <div
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        border: `3px solid rgba(255, 255, 255, 0.1)`,
        'border-top': `3px solid ${color()}`,
        'border-radius': '50%',
        animation: 'dax-spin 0.8s linear infinite',
        ...(props.style ?? {}),
      }}
    />
  );
};

export { Spinner };
