import React from 'react';
import type { Agent, AgentState } from '@/types';

export interface AgentTooltipProps {
  agent: Agent | null;
  position: { x: number; y: number } | null;
  visible: boolean;
}

const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Idle',
  moving: 'Moving',
  analyzing: 'Analyzing',
  thinking: 'Thinking',
  executing: 'Executing',
  waiting: 'Waiting for input',
  paused: 'Paused',
};

const STATE_COLORS: Record<AgentState, string> = {
  idle: '#4a9eff',
  moving: '#00ff88',
  analyzing: '#ff00ff',
  thinking: '#ffff00',
  executing: '#ff8800',
  waiting: '#888888',
  paused: '#444444',
};

export const AgentTooltip: React.FC<AgentTooltipProps> = ({ agent, position, visible }) => {
  if (!visible || !agent || !position) {
    return null;
  }

  const stateColor = STATE_COLORS[agent.state];
  const stateLabel = STATE_LABELS[agent.state];

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-16px)',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'rgba(20, 20, 30, 0.95)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          border: `1px solid ${stateColor}`,
          minWidth: '180px',
        }}
      >
        {/* Agent name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: stateColor,
              boxShadow: `0 0 8px ${stateColor}`,
            }}
          />
          <span
            style={{
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {agent.name}
          </span>
        </div>

        {/* State */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              color: '#888888',
              fontSize: '12px',
            }}
          >
            Status:
          </span>
          <span
            style={{
              color: stateColor,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {stateLabel}
          </span>
        </div>

        {/* Current goal or intention */}
        {agent.currentGoalId && (
          <div
            style={{
              color: '#aaaaaa',
              fontSize: '11px',
              fontStyle: 'italic',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '8px',
              marginTop: '4px',
            }}
          >
            Working on goal...
          </div>
        )}

        {/* Focused object indicator */}
        {agent.focusedObjectId && (
          <div
            style={{
              color: '#ff00ff',
              fontSize: '11px',
              marginTop: '4px',
            }}
          >
            📍 Focusing on object
          </div>
        )}

        {/* Arrow pointer */}
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${stateColor}`,
          }}
        />
      </div>
    </div>
  );
};

export default AgentTooltip;
