import React, { useMemo } from 'react';
import { useAgentStore } from '@/ui/stores/agentStore';
import type { Goal, AgentState, AnyAgentMessage } from '@/types';

export interface AgentPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

const STATE_LABELS: Record<AgentState, string> = {
  idle: 'Idle',
  moving: 'Moving',
  analyzing: 'Analyzing',
  thinking: 'Thinking',
  executing: 'Executing',
  waiting: 'Waiting',
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

const GoalItem: React.FC<{ goal: Goal }> = ({ goal }) => {
  const statusColors: Record<string, string> = {
    pending: '#888888',
    in_progress: '#ffff00',
    completed: '#00ff88',
    failed: '#ff4444',
    cancelled: '#666666',
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        marginBottom: '8px',
        borderRadius: '6px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${statusColors[goal.status] || '#333333'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {goal.title}
        </span>
        <span
          style={{
            color: statusColors[goal.status] || '#888888',
            fontSize: '11px',
            textTransform: 'uppercase',
          }}
        >
          {goal.status.replace('_', ' ')}
        </span>
      </div>
      
      {/* Progress bar */}
      {goal.status === 'in_progress' && (
        <div
          style={{
            height: '3px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '6px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${goal.progress}%`,
              background: '#ffff00',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
      
      <div
        style={{
          color: '#888888',
          fontSize: '11px',
          marginTop: '4px',
        }}
      >
        {goal.description}
      </div>
    </div>
  );
};

const MessageItem: React.FC<{ message: AnyAgentMessage }> = ({ message }) => {
  const getMessageContent = (): string => {
    switch (message.type) {
      case 'state_change':
        return `State: ${(message as { from: string; to: string }).from} → ${(message as { to: string }).to}`;
      case 'thought':
        return `💭 ${(message as { content: string }).content}`;
      case 'observation':
        return `👁 ${(message as { content: string }).content}`;
      case 'action':
        return `⚡ ${(message as { description: string }).description}`;
      default:
        return message.type;
    }
  };

  const time = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div
      style={{
        padding: '6px 8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2px',
        }}
      >
        <span style={{ color: '#666666' }}>{time}</span>
        <span style={{ color: '#4a9eff', textTransform: 'uppercase' }}>
          {message.type.replace('_', ' ')}
        </span>
      </div>
      <div style={{ color: '#cccccc' }}>{getMessageContent()}</div>
    </div>
  );
};

export const AgentPanel: React.FC<AgentPanelProps> = ({ isOpen, onToggle }) => {
  const agent = useAgentStore((state) => state.agent);
  const goalsMap = useAgentStore((state) => state.goals);
  const goals = useMemo(() => Array.from(goalsMap.values()), [goalsMap]);
  const messages = useAgentStore((state) => state.messages);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: '20px',
          top: '20px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: agent ? STATE_COLORS[agent.state] : '#4a9eff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: `0 4px 20px ${agent ? STATE_COLORS[agent.state] : '#4a9eff'}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          zIndex: 100,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Open Agent Panel"
      >
        <span style={{ fontSize: '20px' }}>🤖</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        top: '20px',
        width: '320px',
        maxHeight: 'calc(100vh - 40px)',
        background: 'rgba(20, 20, 30, 0.95)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {agent && (
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: STATE_COLORS[agent.state],
                boxShadow: `0 0 10px ${STATE_COLORS[agent.state]}`,
              }}
            />
          )}
          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '16px' }}>
            {agent?.name || 'Agent'}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: '#888888',
            cursor: 'pointer',
            fontSize: '20px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Status */}
      {agent && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#888888', fontSize: '12px' }}>Status</span>
            <span
              style={{
                color: STATE_COLORS[agent.state],
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {STATE_LABELS[agent.state]}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888888', fontSize: '12px' }}>Position</span>
            <span style={{ color: '#cccccc', fontSize: '12px', fontFamily: 'monospace' }}>
              ({agent.position.x.toFixed(1)}, {agent.position.z.toFixed(1)})
            </span>
          </div>
        </div>
      )}

      {/* Goals */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h3 style={{ color: '#ffffff', fontSize: '13px', margin: '0 0 12px 0' }}>
          Active Goals ({goals.filter((g) => g.status === 'in_progress' || g.status === 'pending').length})
        </h3>
        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {goals
            .filter((g) => g.status === 'in_progress' || g.status === 'pending')
            .map((goal) => (
              <GoalItem key={goal.id} goal={goal} />
            ))}
          {goals.filter((g) => g.status === 'in_progress' || g.status === 'pending').length === 0 && (
            <div style={{ color: '#666666', fontSize: '12px', fontStyle: 'italic' }}>
              No active goals
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div style={{ padding: '16px', flex: 1, minHeight: 0 }}>
        <h3 style={{ color: '#ffffff', fontSize: '13px', margin: '0 0 12px 0' }}>
          Activity Log
        </h3>
        <div
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '6px',
          }}
        >
          {messages.slice(-20).reverse().map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          {messages.length === 0 && (
            <div
              style={{
                color: '#666666',
                fontSize: '12px',
                fontStyle: 'italic',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              No activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
