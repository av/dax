/**
 * WorkspaceMenu Component
 * Provides workspace management UI (new, open, save)
 */

import React, { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useWorkspace } from '../hooks/useWorkspace';

interface WorkspaceMenuProps {
  onClose?: () => void;
}

export function WorkspaceMenu({ onClose }: WorkspaceMenuProps) {
  const {
    currentWorkspace,
    recentWorkspaces,
    isDirty,
    isLoading,
    isSaving,
    error,
    createNewWorkspace,
    saveWorkspace,
    loadWorkspace,
    exportWorkspace,
    closeWorkspace,
    hasUnsavedChanges,
    confirmClose,
  } = useWorkspace();
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  
  const handleNew = useCallback(async () => {
    if (hasUnsavedChanges()) {
      const confirmed = await confirmClose();
      if (!confirmed) return;
    }
    setShowNewDialog(true);
  }, [hasUnsavedChanges, confirmClose]);
  
  const handleCreateNew = useCallback(async () => {
    if (!newWorkspaceName.trim()) return;
    
    try {
      // Ask for save location
      const path = await save({
        title: 'Save New Workspace',
        defaultPath: `${newWorkspaceName}.dax`,
        filters: [{ name: 'DAX Workspace', extensions: ['dax'] }],
      });
      
      if (path) {
        await createNewWorkspace({
          name: newWorkspaceName.trim(),
          description: newWorkspaceDescription.trim(),
          path,
        });
        setShowNewDialog(false);
        setNewWorkspaceName('');
        setNewWorkspaceDescription('');
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    }
  }, [newWorkspaceName, newWorkspaceDescription, createNewWorkspace, onClose]);
  
  const handleOpen = useCallback(async () => {
    if (hasUnsavedChanges()) {
      const confirmed = await confirmClose();
      if (!confirmed) return;
    }
    
    try {
      const selected = await open({
        title: 'Open Workspace',
        multiple: false,
        filters: [{ name: 'DAX Workspace', extensions: ['dax', 'json'] }],
      });
      
      if (selected && typeof selected === 'string') {
        await loadWorkspace(selected);
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to open workspace:', err);
    }
  }, [hasUnsavedChanges, confirmClose, loadWorkspace, onClose]);
  
  const handleSave = useCallback(async () => {
    try {
      await saveWorkspace();
    } catch (err) {
      console.error('Failed to save workspace:', err);
    }
  }, [saveWorkspace]);
  
  const handleSaveAs = useCallback(async () => {
    try {
      const path = await save({
        title: 'Save Workspace As',
        defaultPath: currentWorkspace?.name ? `${currentWorkspace.name}.dax` : 'workspace.dax',
        filters: [{ name: 'DAX Workspace', extensions: ['dax'] }],
      });
      
      if (path) {
        await exportWorkspace(path);
      }
    } catch (err) {
      console.error('Failed to save workspace:', err);
    }
  }, [currentWorkspace, exportWorkspace]);
  
  const handleOpenRecent = useCallback(async (path: string) => {
    if (hasUnsavedChanges()) {
      const confirmed = await confirmClose();
      if (!confirmed) return;
    }
    
    try {
      await loadWorkspace(path);
      onClose?.();
    } catch (err) {
      console.error('Failed to open recent workspace:', err);
    }
  }, [hasUnsavedChanges, confirmClose, loadWorkspace, onClose]);
  
  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges()) {
      const confirmed = await confirmClose();
      if (!confirmed) return;
    }
    closeWorkspace();
    onClose?.();
  }, [hasUnsavedChanges, confirmClose, closeWorkspace, onClose]);
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📁 Workspace</h3>
        {currentWorkspace && (
          <span style={styles.workspaceName}>
            {currentWorkspace.name}
            {isDirty && <span style={styles.dirtyIndicator}>•</span>}
          </span>
        )}
      </div>
      
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}
      
      <div style={styles.actions}>
        <button
          style={styles.button}
          onClick={handleNew}
          disabled={isLoading}
        >
          ➕ New Workspace
        </button>
        
        <button
          style={styles.button}
          onClick={handleOpen}
          disabled={isLoading}
        >
          📂 Open Workspace
        </button>
        
        <button
          style={styles.button}
          onClick={handleSave}
          disabled={!currentWorkspace || isSaving}
        >
          💾 Save {isSaving && '...'}
        </button>
        
        <button
          style={styles.button}
          onClick={handleSaveAs}
          disabled={!currentWorkspace || isSaving}
        >
          📄 Save As...
        </button>
        
        {currentWorkspace && (
          <button
            style={styles.buttonDanger}
            onClick={handleClose}
            disabled={isLoading}
          >
            ✕ Close Workspace
          </button>
        )}
      </div>
      
      {recentWorkspaces.length > 0 && (
        <div style={styles.recentSection}>
          <h4 style={styles.recentTitle}>Recent Workspaces</h4>
          <div style={styles.recentList}>
            {recentWorkspaces.slice(0, 5).map((workspace) => (
              <button
                key={workspace.id}
                style={styles.recentItem}
                onClick={() => handleOpenRecent(workspace.path)}
                disabled={isLoading}
              >
                <span style={styles.recentName}>{workspace.name}</span>
                <span style={styles.recentPath}>{workspace.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* New Workspace Dialog */}
      {showNewDialog && (
        <div style={styles.dialogOverlay} onClick={() => setShowNewDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.dialogTitle}>Create New Workspace</h4>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="My Workspace"
                style={styles.input}
                autoFocus
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Description (optional)</label>
              <textarea
                value={newWorkspaceDescription}
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                placeholder="A brief description..."
                style={styles.textarea}
              />
            </div>
            
            <div style={styles.dialogActions}>
              <button
                style={styles.buttonSecondary}
                onClick={() => setShowNewDialog(false)}
              >
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={handleCreateNew}
                disabled={!newWorkspaceName.trim() || isLoading}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    minWidth: '280px',
  },
  header: {
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    color: '#fff',
  },
  workspaceName: {
    fontSize: '12px',
    color: '#888',
  },
  dirtyIndicator: {
    marginLeft: '4px',
    color: '#ffa500',
    fontWeight: 'bold',
  },
  error: {
    padding: '8px',
    marginBottom: '12px',
    backgroundColor: '#ff4444',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  button: {
    padding: '10px 16px',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    transition: 'background-color 0.2s',
  },
  buttonDanger: {
    padding: '10px 16px',
    backgroundColor: '#4a2020',
    border: '1px solid #ff4444',
    borderRadius: '4px',
    color: '#ff8888',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
  },
  buttonPrimary: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
  },
  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
  },
  recentSection: {
    marginTop: '20px',
    borderTop: '1px solid #333',
    paddingTop: '16px',
  },
  recentTitle: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  recentItem: {
    padding: '8px 12px',
    backgroundColor: '#252525',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recentName: {
    fontSize: '13px',
    color: '#fff',
  },
  recentPath: {
    fontSize: '10px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    minWidth: '320px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  dialogTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    color: '#fff',
  },
  formGroup: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '12px',
    color: '#888',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    resize: 'vertical',
    minHeight: '60px',
    boxSizing: 'border-box',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
};

export default WorkspaceMenu;
