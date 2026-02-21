import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { executeApprovedPlan } from '@/agent/executor';
// ── Status indicator ──────────────────────────────────
function StepStatusIcon({ status }) {
    const configs = {
        pending: { color: '#565f89', symbol: '○' },
        approved: { color: '#7aa2f7', symbol: '✓' },
        running: { color: '#e0af68', symbol: '◎' },
        done: { color: '#9ece6a', symbol: '✓' },
        failed: { color: '#f7768e', symbol: '✗' },
        rejected: { color: '#565f89', symbol: '—' },
    };
    const cfg = configs[status];
    return (_jsx("span", { style: {
            color: cfg.color,
            fontSize: '14px',
            fontWeight: 600,
            width: '20px',
            textAlign: 'center',
            flexShrink: 0,
            animation: status === 'running' ? 'stepSpin 1s linear infinite' : undefined,
        }, children: cfg.symbol }));
}
// ── Step row ──────────────────────────────────────────
function StepRow({ step, onApprove, onReject, }) {
    const argSummary = Object.entries(step.args)
        .map(([k, v]) => {
        const val = String(v);
        const display = val.length > 40 ? val.slice(0, 40) + '…' : val;
        return `${k}: ${display}`;
    })
        .join(', ');
    return (_jsxs("div", { style: {
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: '1px solid #1a1b26',
            alignItems: 'flex-start',
        }, children: [_jsx(StepStatusIcon, { status: step.status }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: {
                            fontSize: '13px',
                            color: step.status === 'rejected' ? '#565f89' : '#c0caf5',
                            textDecoration: step.status === 'rejected' ? 'line-through' : 'none',
                        }, children: step.description }), _jsxs("div", { style: {
                            fontSize: '11px',
                            color: '#565f89',
                            fontFamily: 'monospace',
                            marginTop: '2px',
                        }, children: [step.tool, "(", argSummary, ")"] }), step.result && (_jsx("div", { style: {
                            fontSize: '11px',
                            color: '#9ece6a',
                            fontFamily: 'monospace',
                            marginTop: '4px',
                            maxHeight: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }, children: step.result.slice(0, 200) })), step.error && (_jsxs("div", { style: {
                            fontSize: '11px',
                            color: '#f7768e',
                            fontFamily: 'monospace',
                            marginTop: '4px',
                        }, children: ["Error: ", step.error] }))] }), step.status === 'pending' && (_jsxs("div", { style: { display: 'flex', gap: '4px', flexShrink: 0 }, children: [_jsx("button", { onClick: () => onApprove(step.id), title: "Approve step", style: {
                            padding: '2px 8px',
                            fontSize: '11px',
                            background: 'rgba(158, 206, 106, 0.15)',
                            color: '#9ece6a',
                            border: '1px solid rgba(158, 206, 106, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }, children: "\u2713" }), _jsx("button", { onClick: () => onReject(step.id), title: "Reject step", style: {
                            padding: '2px 8px',
                            fontSize: '11px',
                            background: 'rgba(247, 118, 142, 0.15)',
                            color: '#f7768e',
                            border: '1px solid rgba(247, 118, 142, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }, children: "\u2717" })] }))] }));
}
// ── Activity log entry ────────────────────────────────
function LogEntry({ entry }) {
    const colorMap = {
        info: '#9aa5ce',
        success: '#9ece6a',
        error: '#f7768e',
    };
    const time = new Date(entry.timestamp);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
    return (_jsxs("div", { style: {
            display: 'flex',
            gap: '8px',
            padding: '3px 12px',
            fontSize: '11px',
            fontFamily: 'monospace',
            alignItems: 'baseline',
        }, children: [_jsx("span", { style: { color: '#565f89', flexShrink: 0 }, children: timeStr }), _jsx("span", { style: { color: colorMap[entry.type] }, children: entry.message })] }));
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
    const logEndRef = useRef(null);
    // Use steps array (synced with plan) for display
    const displaySteps = steps.length > 0 ? steps : plan;
    const hasPendingSteps = displaySteps.some((s) => s.status === 'pending');
    const hasApprovedSteps = displaySteps.some((s) => s.status === 'approved');
    const isExecuting = displaySteps.some((s) => s.status === 'running');
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activityLog.length]);
    const handleApproveStep = useCallback((id) => {
        approveStep(id);
    }, [approveStep]);
    const handleRejectStep = useCallback((id) => {
        rejectStep(id);
    }, [rejectStep]);
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
    if (!currentGoal && activityLog.length === 0)
        return null;
    return (_jsxs("div", { style: {
            position: 'absolute',
            top: '60px',
            right: '16px',
            bottom: '60px',
            width: '340px',
            background: 'rgba(22, 22, 30, 0.95)',
            border: '1px solid #292e42',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: 'auto',
            backdropFilter: 'blur(12px)',
        }, children: [_jsxs("div", { style: {
                    padding: '10px 12px',
                    borderBottom: '1px solid #292e42',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: {
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#7aa2f7',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }, children: "Agent Plan" }), currentGoal && (_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: '#9aa5ce',
                                    marginTop: '2px',
                                    maxWidth: '240px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }, title: currentGoal, children: currentGoal }))] }), _jsx("button", { onClick: handleDismiss, title: "Dismiss plan", style: {
                            padding: '2px 8px',
                            fontSize: '14px',
                            background: 'transparent',
                            color: '#565f89',
                            border: 'none',
                            cursor: 'pointer',
                            lineHeight: 1,
                        }, children: "\u00D7" })] }), displaySteps.length > 0 && (_jsx("div", { style: { flex: 1, overflow: 'auto', minHeight: 0 }, children: displaySteps.map((step) => (_jsx(StepRow, { step: step, onApprove: handleApproveStep, onReject: handleRejectStep }, step.id))) })), displaySteps.length > 0 && (hasPendingSteps || hasApprovedSteps) && (_jsxs("div", { style: {
                    padding: '8px 12px',
                    borderTop: '1px solid #292e42',
                    display: 'flex',
                    gap: '8px',
                }, children: [hasPendingSteps && (_jsx("button", { onClick: handleApproveAll, disabled: isExecuting, style: {
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: isExecuting
                                ? 'rgba(86, 95, 137, 0.3)'
                                : 'rgba(122, 162, 247, 0.15)',
                            color: isExecuting ? '#565f89' : '#7aa2f7',
                            border: `1px solid ${isExecuting ? '#292e42' : 'rgba(122, 162, 247, 0.3)'}`,
                            borderRadius: '6px',
                            cursor: isExecuting ? 'not-allowed' : 'pointer',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        }, children: "Approve All" })), hasApprovedSteps && (_jsx("button", { onClick: handleExecute, disabled: isExecuting, style: {
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: isExecuting
                                ? 'rgba(86, 95, 137, 0.3)'
                                : 'rgba(158, 206, 106, 0.15)',
                            color: isExecuting ? '#565f89' : '#9ece6a',
                            border: `1px solid ${isExecuting ? '#292e42' : 'rgba(158, 206, 106, 0.3)'}`,
                            borderRadius: '6px',
                            cursor: isExecuting ? 'not-allowed' : 'pointer',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        }, children: isExecuting ? 'Executing…' : 'Execute Plan' }))] })), activityLog.length > 0 && (_jsxs("div", { style: {
                    borderTop: '1px solid #292e42',
                    maxHeight: '160px',
                    overflow: 'auto',
                }, children: [_jsx("div", { style: {
                            padding: '6px 12px 2px',
                            fontSize: '10px',
                            color: '#565f89',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontFamily: 'monospace',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(22, 22, 30, 0.98)',
                        }, children: "Activity Log" }), activityLog.map((entry, i) => (_jsx(LogEntry, { entry: entry }, `${entry.timestamp}-${i}`))), _jsx("div", { ref: logEndRef })] })), _jsx("style", { children: `
        @keyframes stepSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      ` })] }));
}
