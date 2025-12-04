/**
 * useWorkspace Hook
 * Provides workspace load/save operations and state management
 */

import { useState, useCallback, useEffect } from 'react';
import { useWorkspaceStore, type WorkspaceState } from '../stores/workspaceStore';
import { 
  PersistenceService, 
  type CreateWorkspaceOptions,
  type ExportedWorkspace 
} from '../../services/persistence';
import type { Workspace } from '../../types';

export interface UseWorkspaceResult {
  // Current workspace state
  currentWorkspace: Workspace | null;
  recentWorkspaces: WorkspaceState['recentWorkspaces'];
  isDirty: boolean;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  createNewWorkspace: (options: CreateWorkspaceOptions) => Promise<void>;
  saveWorkspace: () => Promise<void>;
  loadWorkspace: (path: string) => Promise<ExportedWorkspace>;
  exportWorkspace: (path: string) => Promise<void>;
  closeWorkspace: () => void;
  
  // Dirty tracking
  hasUnsavedChanges: () => boolean;
  confirmClose: () => Promise<boolean>;
}

export function useWorkspace(): UseWorkspaceResult {
  const workspaceStore = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize persistence system on mount
  useEffect(() => {
    const cleanup = PersistenceService.initPersistence();
    return cleanup;
  }, []);
  
  const createNewWorkspace = useCallback(async (options: CreateWorkspaceOptions) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await PersistenceService.createWorkspace(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const saveWorkspace = useCallback(async () => {
    if (!workspaceStore.currentWorkspace) {
      setError('No workspace to save');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      await PersistenceService.saveWorkspace();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save workspace';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [workspaceStore.currentWorkspace]);
  
  const loadWorkspace = useCallback(async (path: string): Promise<ExportedWorkspace> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const workspace = await PersistenceService.loadWorkspace(path);
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const exportWorkspace = useCallback(async (path: string) => {
    if (!workspaceStore.currentWorkspace) {
      setError('No workspace to export');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      await PersistenceService.exportWorkspace(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export workspace';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [workspaceStore.currentWorkspace]);
  
  const closeWorkspace = useCallback(() => {
    PersistenceService.stopAutoSave();
    workspaceStore.setWorkspace(null);
  }, [workspaceStore]);
  
  const hasUnsavedChanges = useCallback(() => {
    return PersistenceService.hasUnsavedChanges();
  }, []);
  
  const confirmClose = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges()) {
      return true;
    }
    
    // In a real implementation, this would show a dialog
    // For now, we return true (allow close)
    return window.confirm('You have unsaved changes. Are you sure you want to close?');
  }, [hasUnsavedChanges]);
  
  return {
    currentWorkspace: workspaceStore.currentWorkspace,
    recentWorkspaces: workspaceStore.recentWorkspaces,
    isDirty: workspaceStore.isDirty,
    
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
  };
}

export default useWorkspace;
