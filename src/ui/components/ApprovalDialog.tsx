/**
 * ApprovalDialog - Agent execution approval workflow
 * 
 * Prompts user to approve or reject agent-initiated actions
 * such as code execution, file modifications, or other sensitive operations
 */

import React, { useState, useCallback } from 'react';

export interface ApprovalRequest {
  id: string;
  type: 'execute-code' | 'modify-file' | 'delete-file' | 'network-access';
  title: string;
  description: string;
  details?: {
    code?: string;
    language?: string;
    filePath?: string;
    url?: string;
  };
  risks?: string[];
  timestamp: number;
}

interface ApprovalDialogProps {
  request: ApprovalRequest;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  onClose: () => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  request,
  onApprove,
  onReject,
  onClose,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = useCallback(() => {
    setIsProcessing(true);
    onApprove(request.id);
  }, [request.id, onApprove]);

  const handleReject = useCallback(() => {
    if (showRejectInput && rejectReason.trim()) {
      setIsProcessing(true);
      onReject(request.id, rejectReason);
    } else {
      setShowRejectInput(true);
    }
  }, [request.id, rejectReason, showRejectInput, onReject]);

  const handleRejectWithoutReason = useCallback(() => {
    setIsProcessing(true);
    onReject(request.id);
  }, [request.id, onReject]);

  const getTypeIcon = (type: ApprovalRequest['type']): string => {
    switch (type) {
      case 'execute-code':
        return '▶️';
      case 'modify-file':
        return '📝';
      case 'delete-file':
        return '🗑️';
      case 'network-access':
        return '🌐';
      default:
        return '⚠️';
    }
  };

  const getTypeLabel = (type: ApprovalRequest['type']): string => {
    switch (type) {
      case 'execute-code':
        return 'Code Execution';
      case 'modify-file':
        return 'File Modification';
      case 'delete-file':
        return 'File Deletion';
      case 'network-access':
        return 'Network Access';
      default:
        return 'Action';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="approval-overlay">
      <div className="approval-dialog">
        <div className="approval-header">
          <span className="approval-icon">{getTypeIcon(request.type)}</span>
          <div className="approval-title-section">
            <span className="approval-type">{getTypeLabel(request.type)}</span>
            <h3 className="approval-title">{request.title}</h3>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="approval-body">
          <p className="approval-description">{request.description}</p>

          {request.details?.code && (
            <div className="approval-code-section">
              <h4>
                Code to Execute
                {request.details.language && (
                  <span className="language-badge">{request.details.language}</span>
                )}
              </h4>
              <pre className="approval-code">{request.details.code}</pre>
            </div>
          )}

          {request.details?.filePath && (
            <div className="approval-detail">
              <span className="detail-label">File:</span>
              <span className="detail-value">{request.details.filePath}</span>
            </div>
          )}

          {request.details?.url && (
            <div className="approval-detail">
              <span className="detail-label">URL:</span>
              <span className="detail-value">{request.details.url}</span>
            </div>
          )}

          {request.risks && request.risks.length > 0 && (
            <div className="approval-risks">
              <h4>⚠️ Potential Risks</h4>
              <ul>
                {request.risks.map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="approval-meta">
            <span className="approval-time">Requested at {formatTimestamp(request.timestamp)}</span>
          </div>
        </div>

        {showRejectInput && (
          <div className="reject-reason-section">
            <label>Reason for rejection (optional):</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Tell the agent why you're rejecting this action..."
              rows={2}
            />
          </div>
        )}

        <div className="approval-actions">
          {!showRejectInput ? (
            <>
              <button
                className="reject-button"
                onClick={handleReject}
                disabled={isProcessing}
              >
                Reject
              </button>
              <button
                className="approve-button"
                onClick={handleApprove}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Approve'}
              </button>
            </>
          ) : (
            <>
              <button
                className="cancel-button"
                onClick={() => setShowRejectInput(false)}
                disabled={isProcessing}
              >
                Back
              </button>
              <button
                className="reject-button secondary"
                onClick={handleRejectWithoutReason}
                disabled={isProcessing}
              >
                Reject Without Reason
              </button>
              <button
                className="reject-button"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
              >
                {isProcessing ? 'Rejecting...' : 'Reject with Reason'}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .approval-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .approval-dialog {
          background: var(--bg-secondary, #1e1e1e);
          border: 1px solid var(--border-color, #333);
          border-radius: 12px;
          width: 500px;
          max-width: 90vw;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .approval-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-tertiary, #252525);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .approval-icon {
          font-size: 24px;
          line-height: 1;
        }

        .approval-title-section {
          flex: 1;
        }

        .approval-type {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--accent-color, #4a9eff);
          letter-spacing: 0.5px;
        }

        .approval-title {
          margin: 4px 0 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #e0e0e0);
        }

        .close-button {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          cursor: pointer;
          padding: 4px;
          font-size: 16px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .close-button:hover {
          opacity: 1;
        }

        .approval-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .approval-description {
          margin: 0 0 16px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary, #e0e0e0);
        }

        .approval-code-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #888);
        }

        .language-badge {
          padding: 2px 6px;
          background: var(--accent-color, #4a9eff);
          color: #fff;
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
        }

        .approval-code {
          margin: 0;
          padding: 12px;
          background: var(--bg-primary, #1a1a1a);
          border-radius: 6px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          line-height: 1.5;
          overflow-x: auto;
          max-height: 200px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .approval-detail {
          display: flex;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .detail-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #888);
        }

        .detail-value {
          font-size: 12px;
          color: var(--text-primary, #e0e0e0);
          font-family: monospace;
          word-break: break-all;
        }

        .approval-risks {
          margin-top: 16px;
          padding: 12px;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 6px;
        }

        .approval-risks h4 {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
          color: #f87171;
        }

        .approval-risks ul {
          margin: 0;
          padding-left: 20px;
        }

        .approval-risks li {
          font-size: 12px;
          color: var(--text-primary, #e0e0e0);
          margin-bottom: 4px;
        }

        .approval-meta {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color, #333);
        }

        .approval-time {
          font-size: 11px;
          color: var(--text-secondary, #888);
        }

        .reject-reason-section {
          padding: 0 20px 16px;
        }

        .reject-reason-section label {
          display: block;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #888);
        }

        .reject-reason-section textarea {
          width: 100%;
          padding: 10px;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--border-color, #333);
          border-radius: 6px;
          font-size: 13px;
          resize: none;
        }

        .reject-reason-section textarea:focus {
          outline: none;
          border-color: var(--accent-color, #4a9eff);
        }

        .approval-actions {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-tertiary, #252525);
          border-top: 1px solid var(--border-color, #333);
          justify-content: flex-end;
        }

        .approval-actions button {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .approval-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .approve-button {
          background: #4ade80;
          color: #000;
          border: none;
        }

        .reject-button {
          background: #f87171;
          color: #fff;
          border: none;
        }

        .reject-button.secondary {
          background: transparent;
          color: #f87171;
          border: 1px solid #f87171;
        }

        .cancel-button {
          background: transparent;
          color: var(--text-secondary, #888);
          border: 1px solid var(--border-color, #333);
        }
      `}</style>
    </div>
  );
};

export default ApprovalDialog;
