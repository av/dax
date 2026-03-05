import { type Component, type JSX, For, createSignal } from 'solid-js';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const Tabs: Component<TabsProps> = (props) => {
  return (
    <div style={containerStyle}>
      <For each={props.tabs}>
        {(tab) => (
          <button
            style={{
              ...tabStyle,
              ...(props.activeTab === tab.id ? activeTabStyle : {}),
            }}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  );
};

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '2px',
  padding: '4px',
  background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
  'border-radius': '10px',
  'flex-shrink': '0',
  'overflow-x': 'auto',
  'pointer-events': 'auto',
};

const tabStyle: JSX.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted, #8a8a9a)',
  padding: '8px 16px',
  'font-size': '13px',
  'font-weight': '500',
  cursor: 'pointer',
  'border-radius': '8px',
  transition: 'all 0.15s ease',
  'white-space': 'nowrap',
};

const activeTabStyle: JSX.CSSProperties = {
  background: 'var(--accent, #e94560)',
  color: '#ffffff',
  'font-weight': '600',
};

export { Tabs };
