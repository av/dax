/**
 * AgentMindPanel: sidebar showing beliefs, desires, current intention, action log.
 * Solid.js component for agent thought process visualization.
 */
import { type Component, Show, For, createMemo } from 'solid-js';
import { agentState } from '../../state/agent';
import { showAgentMind, setShowAgentMind } from '../../state/ui';
import { AGENT_MIND_BELIEFS_LIMIT, AGENT_MIND_ACTION_LOG_LIMIT } from '@shared/constants';
import type { ActionLogRow } from '../../db/types';

export const AgentMindPanel: Component = () => {
  // Get beliefs as sorted key-value pairs (most recently updated first)
  const beliefEntries = createMemo(() => {
    const beliefs = agentState.beliefs;
    return Object.entries(beliefs)
      .map(([key, value]) => ({ key, value: formatValue(value) }))
      .slice(0, AGENT_MIND_BELIEFS_LIMIT);
  });

  // Get desires sorted by priority
  const sortedDesires = createMemo(() => {
    return [...agentState.desires].sort((a, b) => b.priority - a.priority);
  });

  // Get recent action log
  const recentActions = createMemo(() => {
    return agentState.actionLog.slice(-AGENT_MIND_ACTION_LOG_LIMIT);
  });

  // Status badge color
  const statusColor = createMemo(() => {
    switch (agentState.status) {
      case 'idle': return '#6a6a7a';
      case 'thinking': return '#4da6ff';
      case 'acting': return '#50c878';
      case 'learning': return '#e0c080';
      case 'paused': return '#e94560';
      default: return '#6a6a7a';
    }
  });

  // Progress percentage for current intention
  const intentionProgress = createMemo(() => {
    const int = agentState.currentIntention;
    if (!int || int.totalSteps === 0) return 0;
    return Math.round((int.currentStep / int.totalSteps) * 100);
  });

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function resultColor(result: string): string {
    return result === 'success' ? '#50c878' : '#e94560';
  }

  return (
    <Show when={showAgentMind()}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={headerLeftStyle}>
            <span style={headerTitleStyle}>Agent Mind</span>
            <span
              style={{
                ...statusBadgeStyle,
                background: statusColor(),
              }}
            >
              {agentState.status}
            </span>
          </div>
          <button style={closeButtonStyle} onClick={() => setShowAgentMind(false)} title="Close">
            ✕
          </button>
        </div>

        <div style={scrollContainerStyle}>
          {/* LLM Health Warning */}
          <Show when={!agentState.llmHealthy}>
            <div style={warningStyle}>
              ⚠ LLM unreachable — autonomous actions paused
            </div>
          </Show>

          {/* Beliefs Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Beliefs</h3>
            <div style={beliefTableStyle}>
              <For each={beliefEntries()}>
                {(entry) => (
                  <div style={beliefRowStyle}>
                    <span style={beliefKeyStyle}>{entry.key}</span>
                    <span style={beliefValueStyle}>{entry.value}</span>
                  </div>
                )}
              </For>
              <Show when={beliefEntries().length === 0}>
                <span style={emptyStyle}>No beliefs yet</span>
              </Show>
            </div>
          </div>

          {/* Desires Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Desires</h3>
            <div style={desireListStyle}>
              <For each={sortedDesires()}>
                {(desire) => (
                  <div style={desireRowStyle}>
                    <span
                      style={{
                        ...desireIndicatorStyle,
                        background: desire.isActive ? '#50c878' : '#3a3a4a',
                      }}
                    />
                    <span style={desireNameStyle}>{desire.name}</span>
                    <span style={priorityBadgeStyle}>
                      P{desire.priority.toFixed(1)}
                    </span>
                  </div>
                )}
              </For>
              <Show when={sortedDesires().length === 0}>
                <span style={emptyStyle}>No desires</span>
              </Show>
            </div>
          </div>

          {/* Current Intention Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Current Intention</h3>
            <Show
              when={agentState.currentIntention}
              fallback={<span style={emptyStyle}>Idle</span>}
            >
              <div style={intentionCardStyle}>
                <span style={intentionDescStyle}>
                  {agentState.currentIntention?.description}
                </span>
                <div style={progressBarContainerStyle}>
                  <div
                    style={{
                      ...progressBarFillStyle,
                      width: `${intentionProgress()}%`,
                    }}
                  />
                </div>
                <span style={progressTextStyle}>
                  Step {agentState.currentIntention?.currentStep ?? 0} / {agentState.currentIntention?.totalSteps ?? 0}
                  ({intentionProgress()}%)
                </span>
              </div>
            </Show>
          </div>

          {/* Action Log Section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Recent Actions</h3>
            <div style={actionLogStyle}>
              <For each={recentActions()}>
                {(action: ActionLogRow) => (
                  <div style={actionRowStyle}>
                    <span style={{ ...actionResultDotStyle, background: resultColor(action.result) }} />
                    <div style={actionInfoStyle}>
                      <span style={actionTypeStyle}>{action.actionType}</span>
                      <Show when={action.targetPath}>
                        <span style={actionTargetStyle}>{action.targetPath}</span>
                      </Show>
                    </div>
                    <span style={actionTimestampStyle}>{formatTimestamp(action.timestamp)}</span>
                  </div>
                )}
              </For>
              <Show when={recentActions().length === 0}>
                <span style={emptyStyle}>No recent actions</span>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const panelStyle: Record<string, string> = {
  position: 'fixed',
  top: '60px',
  right: '0',
  width: '320px',
  'max-height': 'calc(100vh - 80px)',
  display: 'flex',
  'flex-direction': 'column',
  background: 'rgba(22, 22, 38, 0.95)',
  'border-left': '1px solid rgba(233, 69, 96, 0.2)',
  'backdrop-filter': 'blur(12px)',
  'pointer-events': 'auto',
  'z-index': '900',
  'box-shadow': '-4px 0 20px rgba(0, 0, 0, 0.3)',
};

const headerStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '12px 16px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.06)',
};

const headerLeftStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
};

const headerTitleStyle: Record<string, string> = {
  'font-size': '13px',
  'font-weight': '600',
  color: '#e94560',
  'letter-spacing': '1px',
  'text-transform': 'uppercase',
};

const statusBadgeStyle: Record<string, string> = {
  'font-size': '10px',
  'font-weight': '600',
  color: '#fff',
  padding: '2px 8px',
  'border-radius': '10px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
};

const closeButtonStyle: Record<string, string> = {
  background: 'none',
  border: 'none',
  color: '#8a8a9a',
  'font-size': '14px',
  cursor: 'pointer',
  padding: '2px 6px',
};

const scrollContainerStyle: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  padding: '0',
};

const sectionStyle: Record<string, string> = {
  padding: '12px 16px',
  'border-bottom': '1px solid rgba(255, 255, 255, 0.04)',
};

const sectionTitleStyle: Record<string, string> = {
  'font-size': '11px',
  'font-weight': '600',
  color: '#8a8a9a',
  'text-transform': 'uppercase',
  'letter-spacing': '1px',
  margin: '0 0 10px 0',
};

const beliefTableStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
};

const beliefRowStyle: Record<string, string> = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  padding: '3px 0',
  'font-size': '11px',
};

const beliefKeyStyle: Record<string, string> = {
  color: '#8a8aaa',
  'font-family': 'monospace',
  'font-size': '11px',
};

const beliefValueStyle: Record<string, string> = {
  color: '#d0d0e0',
  'font-family': 'monospace',
  'font-size': '11px',
  'max-width': '150px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
};

const desireListStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px',
};

const desireRowStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'font-size': '12px',
};

const desireIndicatorStyle: Record<string, string> = {
  width: '8px',
  height: '8px',
  'border-radius': '50%',
  'flex-shrink': '0',
};

const desireNameStyle: Record<string, string> = {
  color: '#d0d0e0',
  flex: '1',
};

const priorityBadgeStyle: Record<string, string> = {
  'font-size': '10px',
  'font-weight': '600',
  color: '#8a8aaa',
  background: 'rgba(255, 255, 255, 0.06)',
  padding: '1px 6px',
  'border-radius': '8px',
  'font-family': 'monospace',
};

const intentionCardStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
};

const intentionDescStyle: Record<string, string> = {
  color: '#d0d0e0',
  'font-size': '12px',
  'line-height': '1.4',
};

const progressBarContainerStyle: Record<string, string> = {
  width: '100%',
  height: '6px',
  background: 'rgba(255, 255, 255, 0.06)',
  'border-radius': '3px',
  overflow: 'hidden',
};

const progressBarFillStyle: Record<string, string> = {
  height: '100%',
  background: 'linear-gradient(90deg, #e94560, #4da6ff)',
  'border-radius': '3px',
  transition: 'width 0.3s ease',
};

const progressTextStyle: Record<string, string> = {
  'font-size': '10px',
  color: '#6a6a7a',
  'font-family': 'monospace',
};

const warningStyle: Record<string, string> = {
  background: 'rgba(233, 69, 96, 0.15)',
  border: '1px solid rgba(233, 69, 96, 0.3)',
  color: '#e94560',
  padding: '8px 16px',
  'font-size': '12px',
  margin: '8px 16px',
  'border-radius': '6px',
};

const emptyStyle: Record<string, string> = {
  color: '#5a5a6a',
  'font-size': '11px',
  'font-style': 'italic',
};

const actionLogStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  'max-height': '200px',
  overflow: 'auto',
};

const actionRowStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '4px 0',
  'font-size': '11px',
};

const actionResultDotStyle: Record<string, string> = {
  width: '6px',
  height: '6px',
  'border-radius': '50%',
  'flex-shrink': '0',
};

const actionInfoStyle: Record<string, string> = {
  display: 'flex',
  'flex-direction': 'column',
  flex: '1',
  'min-width': '0',
};

const actionTypeStyle: Record<string, string> = {
  color: '#d0d0e0',
  'font-size': '11px',
  'font-weight': '500',
};

const actionTargetStyle: Record<string, string> = {
  color: '#6a6a7a',
  'font-size': '10px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
};

const actionTimestampStyle: Record<string, string> = {
  color: '#5a5a6a',
  'font-size': '10px',
  'font-family': 'monospace',
  'flex-shrink': '0',
};
