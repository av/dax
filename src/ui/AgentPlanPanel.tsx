import { useCallback, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import type { ActivityLogEntry } from '@/stores/agentStore';
import type { AgentStep } from '@/types';
import { executeApprovedPlan } from '@/agent/executor';
import { theme } from '@/theme';

// ── Status indicator ──────────────────────────────────

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  const configs: Record<AgentStep['status'], { color: string; symbol: string }> = {
    pending: { color: theme.colors.textSecondary, symbol: '○' },
    approved: { color: theme.colors.accentPrimary, symbol: '✓' },
    running: { color: theme.colors.statusWarning, symbol: '◎' },
    done: { color: theme.colors.statusSuccess, symbol: '✓' },
    failed: { color: theme.colors.statusError, symbol: '✗' },
    rejected: { color: theme.colors.textSecondary, symbol: '—' },
  };

  const cfg = configs[status];

  return (
    <span
      style={{
        color: cfg.color,
        fontSize: '14px',
        fontWeight: 600,
        width: '20px',
        textAlign: 'center',
        flexShrink: 0,
        animation: status === 'running' ? 'stepSpin 1s linear infinite' : undefined,
      }}
    >
      {cfg.symbol}
    </span>
  );
}

// ── Step row ──────────────────────────────────────────

function StepRow({
  step,
  onApprove,
  onReject,
}: {
  step: AgentStep;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const argSummary = Object.entries(step.args)
    .map(([k, v]) => {
      const val = String(v);
      const display = val.length > 40 ? val.slice(0, 40) + '…' : val;
      return `${k}: ${display}`;
    })
    .join(', ');

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.colors.bgBase}`,
        alignItems: 'flex-start',
      }}
    >
      <StepStatusIcon status={step.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            color: step.status === 'rejected' ? theme.colors.textSecondary : theme.colors.textPrimary,
            textDecoration: step.status === 'rejected' ? 'line-through' : 'none',
          }}
        >
          {step.description}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: theme.colors.textSecondary,
            fontFamily: 'monospace',
            marginTop: '2px',
          }}
        >
          {step.tool}({argSummary})
        </div>
        {step.result && (
          <div
            style={{
              fontSize: '11px',
              color: theme.colors.statusSuccess,
              fontFamily: 'monospace',
              marginTop: '4px',
              maxHeight: '60px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {step.result.slice(0, 200)}
          </div>
        )}
        {step.error && (
          <div
            style={{
              fontSize: '11px',
              color: theme.colors.statusError,
              fontFamily: 'monospace',
              marginTop: '4px',
            }}
          >
            Error: {step.error}
          </div>
        )}
      </div>
      {step.status === 'pending' && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => onApprove(step.id)}
            title="Approve step"
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: `${theme.colors.statusSuccess}26`,
              color: theme.colors.statusSuccess,
              border: `1px solid ${theme.colors.statusSuccess}4D`,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ✓
          </button>
          <button
            onClick={() => onReject(step.id)}
            title="Reject step"
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: `${theme.colors.statusError}26`,
              color: theme.colors.statusError,
              border: `1px solid ${theme.colors.statusError}4D`,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ✗
          </button>
        </div>
      )}
    </div>
  );
}

// ── Activity log entry ────────────────────────────────

function LogEntry({ entry }: { entry: ActivityLogEntry }) {
  const colorMap: Record<ActivityLogEntry['type'], string> = {
    info: theme.colors.textSecondary,
    success: theme.colors.statusSuccess,
    error: theme.colors.statusError,
  };

  const time = new Date(entry.timestamp);
  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '3px 12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: theme.colors.textSecondary, flexShrink: 0 }}>{timeStr}</span>
      <span style={{ color: colorMap[entry.type] }}>{entry.message}</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────

export default function AgentPlanPanel() {
  const plan = useAgentStore((s) => s.plan);
  const steps = useAgentStore((s) => s.steps);
  const currentGoal = useAgentStore((s) => s.currentGoal);
  const activityLog = useAgentStore((s) => s.activityLog);
  const approveStep = useAgentStore((s) => s.approveStep);
  const approveAll = useAgentStore((s) => s.approveAll);
  const rejectStep = useAgentStore((s) => s.rejectStep);
  const reset = useAgentStore((s) => s.reset);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Use steps array (synced with plan) for display
  const displaySteps = steps.length > 0 ? steps : plan;

  const hasPendingSteps = displaySteps.some((s) => s.status === 'pending');
  const hasApprovedSteps = displaySteps.some((s) => s.status === 'approved');
  const isExecuting = displaySteps.some((s) => s.status === 'running');

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog.length]);

  const handleApproveStep = useCallback(
    (id: string) => {
      approveStep(id);
    },
    [approveStep],
  );

  const handleRejectStep = useCallback(
    (id: string) => {
      rejectStep(id);
    },
    [rejectStep],
  );

  const handleApproveAll = useCallback(() => {
    approveAll();
  }, [approveAll]);

  const handleExecute = useCallback(() => {
    const currentSteps = useAgentStore.getState().steps;
    void executeApprovedPlan(currentSteps);
  }, []);

  const handleDismiss = useCallback(() => {
    reset();
  }, [reset]);

  // Only show when there's a goal or activity log entries
  if (!currentGoal && activityLog.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '60px',
        right: '16px',
        bottom: '60px',
        width: '340px',
        background: `${theme.colors.bgSurface}F2`,
        border: `1px solid ${theme.colors.borderDefault}`,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.colors.borderDefault}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: theme.colors.accentPrimary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Agent Plan
          </div>
          {currentGoal && (
            <div
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                marginTop: '2px',
                maxWidth: '240px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentGoal}
            >
              {currentGoal}
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          title="Dismiss plan"
          style={{
            padding: '2px 8px',
            fontSize: '14px',
            background: 'transparent',
            color: theme.colors.textSecondary,
            border: 'none',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Steps list */}
      {displaySteps.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {displaySteps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onApprove={handleApproveStep}
              onReject={handleRejectStep}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {displaySteps.length > 0 && (hasPendingSteps || hasApprovedSteps) && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: `1px solid ${theme.colors.borderDefault}`,
            display: 'flex',
            gap: '8px',
          }}
        >
          {hasPendingSteps && (
            <button
              onClick={handleApproveAll}
              disabled={isExecuting}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '12px',
                background: isExecuting
                  ? `${theme.colors.textSecondary}4D`
                  : `${theme.colors.accentPrimary}26`,
                color: isExecuting ? theme.colors.textSecondary : theme.colors.accentPrimary,
                border: `1px solid ${isExecuting ? theme.colors.borderDefault : `${theme.colors.accentPrimary}4D`}`,
                borderRadius: '6px',
                cursor: isExecuting ? 'not-allowed' : 'pointer',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Approve All
            </button>
          )}
          {hasApprovedSteps && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '12px',
                background: isExecuting
                  ? `${theme.colors.textSecondary}4D`
                  : `${theme.colors.statusSuccess}26`,
                color: isExecuting ? theme.colors.textSecondary : theme.colors.statusSuccess,
                border: `1px solid ${isExecuting ? theme.colors.borderDefault : `${theme.colors.statusSuccess}4D`}`,
                borderRadius: '6px',
                cursor: isExecuting ? 'not-allowed' : 'pointer',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {isExecuting ? 'Executing…' : 'Execute Plan'}
            </button>
          )}
        </div>
      )}

      {/* Activity log */}
      {activityLog.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.borderDefault}`,
            maxHeight: '160px',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              padding: '6px 12px 2px',
              fontSize: '10px',
              color: theme.colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: 'monospace',
              position: 'sticky',
              top: 0,
              background: `${theme.colors.bgSurface}FA`,
            }}
          >
            Activity Log
          </div>
          {activityLog.map((entry, i) => (
            <LogEntry key={`${entry.timestamp}-${i}`} entry={entry} />
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      <style>{`
        @keyframes stepSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
