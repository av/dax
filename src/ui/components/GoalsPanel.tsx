import { useState, useCallback, useMemo } from 'react';
import { useAgentStore } from '../stores/agentStore';
import type { Goal, GoalStatus } from '@/types';

export interface GoalsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<GoalStatus, string> = {
  pending: '#ffc107',
  in_progress: '#4a9eff',
  completed: '#4caf50',
  failed: '#f44336',
  cancelled: '#9e9e9e',
};

const statusLabels: Record<GoalStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function GoalsPanel({ isOpen, onClose }: GoalsPanelProps) {
  const goalsMap = useAgentStore((state) => state.goals);
  const goals = useMemo(() => Array.from(goalsMap.values()), [goalsMap]);
  const agent = useAgentStore((state) => state.agent);
  const updateGoal = useAgentStore((state) => state.updateGoal);
  const removeGoal = useAgentStore((state) => state.removeGoal);

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredGoals = goals.filter((goal) => {
    switch (filter) {
      case 'active':
        return goal.status === 'pending' || goal.status === 'in_progress';
      case 'completed':
        return goal.status === 'completed' || goal.status === 'failed' || goal.status === 'cancelled';
      default:
        return true;
    }
  }).sort((a, b) => {
    // Sort by status priority, then by priority value
    const statusOrder: Record<GoalStatus, number> = {
      in_progress: 0,
      pending: 1,
      completed: 2,
      failed: 3,
      cancelled: 4,
    };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.priority - a.priority;
  });

  const handlePriorityChange = useCallback((goalId: string, delta: number) => {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      const newPriority = Math.max(0, Math.min(100, goal.priority + delta));
      updateGoal(goalId, { priority: newPriority });
    }
  }, [goals, updateGoal]);

  const handleCancelGoal = useCallback((goalId: string) => {
    updateGoal(goalId, {
      status: 'cancelled',
      completedAt: Date.now(),
      result: { success: false, error: 'Cancelled by user' },
    });
  }, [updateGoal]);

  const handleRemoveGoal = useCallback((goalId: string) => {
    removeGoal(goalId);
  }, [removeGoal]);

  const getProgressBar = (goal: Goal) => {
    const color = statusColors[goal.status];
    return (
      <div className="goal-progress-bar">
        <div
          className="goal-progress-fill"
          style={{
            width: `${goal.progress}%`,
            backgroundColor: color,
          }}
        />
      </div>
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="goals-panel">
      <div className="goals-header">
        <div className="goals-title">
          <span>Agent Goals</span>
          {agent && (
            <span className="goals-agent-state">{agent.state}</span>
          )}
        </div>
        <button className="goals-close" onClick={onClose} aria-label="Close goals">
          ×
        </button>
      </div>

      <div className="goals-filters">
        <button
          className={`goals-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({goals.length})
        </button>
        <button
          className={`goals-filter ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({goals.filter(g => g.status === 'pending' || g.status === 'in_progress').length})
        </button>
        <button
          className={`goals-filter ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Done ({goals.filter(g => g.status === 'completed' || g.status === 'failed' || g.status === 'cancelled').length})
        </button>
      </div>

      <div className="goals-list">
        {filteredGoals.length === 0 ? (
          <div className="goals-empty">
            <p>No goals {filter !== 'all' ? `(${filter})` : ''}</p>
            <p className="goals-empty-hint">
              The agent will create goals based on files you add to the workspace.
            </p>
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <div key={goal.id} className={`goal-card goal-${goal.status}`}>
              <div className="goal-card-header">
                <div className="goal-type-badge">{goal.type}</div>
                <div
                  className="goal-status-badge"
                  style={{ backgroundColor: statusColors[goal.status] }}
                >
                  {statusLabels[goal.status]}
                </div>
              </div>

              <h4 className="goal-title">{goal.title}</h4>
              <p className="goal-description">{goal.description}</p>

              {getProgressBar(goal)}

              <div className="goal-meta">
                <span className="goal-priority">Priority: {goal.priority}</span>
                <span className="goal-time">{formatTime(goal.createdAt)}</span>
              </div>

              {goal.result?.output && (
                <div className="goal-result">
                  <strong>Result:</strong> {goal.result.output}
                </div>
              )}

              {goal.result?.error && (
                <div className="goal-error">
                  <strong>Error:</strong> {goal.result.error}
                </div>
              )}

              <div className="goal-actions">
                {(goal.status === 'pending' || goal.status === 'in_progress') && (
                  <>
                    <button
                      className="goal-action priority-up"
                      onClick={() => handlePriorityChange(goal.id, 10)}
                      title="Increase priority"
                    >
                      ↑
                    </button>
                    <button
                      className="goal-action priority-down"
                      onClick={() => handlePriorityChange(goal.id, -10)}
                      title="Decrease priority"
                    >
                      ↓
                    </button>
                    <button
                      className="goal-action cancel"
                      onClick={() => handleCancelGoal(goal.id)}
                      title="Cancel goal"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {(goal.status === 'completed' || goal.status === 'failed' || goal.status === 'cancelled') && (
                  <button
                    className="goal-action remove"
                    onClick={() => handleRemoveGoal(goal.id)}
                    title="Remove goal"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GoalsPanel;
