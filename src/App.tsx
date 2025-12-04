import { useState, useEffect, useCallback, useRef } from 'react';
import Viewport from './ui/components/Viewport';
import { ObjectTooltip } from './ui/components/ObjectTooltip';
import { ChatPanel } from './ui/components/ChatPanel';
import { GoalsPanel } from './ui/components/GoalsPanel';
import { NotificationToast } from './ui/components/NotificationToast';
import { EditorPanel } from './ui/components/EditorPanel';
import { SettingsPanel } from './ui/components/SettingsPanel';
import { sceneEvents } from './engine/events';
import { useSceneStore } from './ui/stores/sceneStore';
import { useWorkspaceStore } from './ui/stores/workspaceStore';
import { useSettingsStore } from './ui/stores/settingsStore';
import { createWorkspace, initPersistence } from './services/persistence';
import type { FileObject } from './types';

interface EditorState {
  isOpen: boolean;
  filePath: string | null;
  fileName: string;
  objectId: string | null;
}

function App() {
  const [isReady, setIsReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    isOpen: false,
    filePath: null,
    fileName: '',
    objectId: null,
  });

  const getObject = useSceneStore((state) => state.getObject);
  const updateObject = useSceneStore((state) => state.updateObject);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const handleCloseGoals = useCallback(() => {
    setIsGoalsOpen(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleDoubleClick = useCallback((data: { objectId: string }) => {
    const object = getObject(data.objectId);
    if (!object) return;

    // Only open editor for editable file objects
    if (object.type === 'file') {
      const fileObj = object as FileObject;
      if (fileObj.isEditable && (fileObj.category === 'text' || fileObj.category === 'code')) {
        setEditor({
          isOpen: true,
          filePath: fileObj.path,
          fileName: fileObj.name,
          objectId: data.objectId,
        });
        // Mark file as being edited
        updateObject(data.objectId, { metadata: { ...fileObj.metadata, isBeingEdited: true } });
      }
    }
  }, [getObject, updateObject]);

  // Use ref for double click handler to avoid useEffect dependency issues
  const handleDoubleClickRef = useRef(handleDoubleClick);
  handleDoubleClickRef.current = handleDoubleClick;

  const handleCloseEditor = useCallback(() => {
    if (editor.objectId) {
      const object = getObject(editor.objectId);
      if (object) {
        updateObject(editor.objectId, { 
          metadata: { ...object.metadata, isBeingEdited: false } 
        });
      }
    }
    setEditor({
      isOpen: false,
      filePath: null,
      fileName: '',
      objectId: null,
    });
  }, [editor.objectId, getObject, updateObject]);

  const handleEditorSave = useCallback((path: string, _content: string) => {
    console.log('File saved:', path);
    // Could emit an event here for other components to react
    sceneEvents.emit('file:saved', { path });
  }, []);

  useEffect(() => {
    // Initialize app on startup
    let cleanup: (() => void) | undefined;
    let mounted = true;
    
    const initializeApp = async () => {
      // Load settings from store
      useSettingsStore.getState().loadSettings();
      
      // Create default workspace if none exists
      const workspace = useWorkspaceStore.getState().currentWorkspace;
      if (!workspace) {
        try {
          await createWorkspace({ name: 'Default Workspace' });
          console.log('[App] Created default workspace');
        } catch (error) {
          console.error('[App] Failed to create default workspace:', error);
        }
      }
      
      // Initialize persistence (auto-save, store subscriptions)
      cleanup = initPersistence();
      
      if (mounted) {
        setIsReady(true);
      }
    };
    
    initializeApp();

    // Event handlers that use refs to avoid stale closures
    const onToggleChat = (data: { open: boolean }) => setIsChatOpen(data.open);
    const onToggleSettings = (data: { open: boolean }) => setIsSettingsOpen(data.open);
    const onDoubleClick = (data: { objectId: string }) => handleDoubleClickRef.current(data);

    // Listen for events
    sceneEvents.on('command:toggle-chat', onToggleChat);
    sceneEvents.on('command:toggle-settings', onToggleSettings);
    sceneEvents.on('input:doubleclick', onDoubleClick);

    return () => {
      mounted = false;
      sceneEvents.off('command:toggle-chat', onToggleChat);
      sceneEvents.off('command:toggle-settings', onToggleSettings);
      sceneEvents.off('input:doubleclick', onDoubleClick);
      cleanup?.();
    };
  }, []); // Empty dependency array - runs once on mount

  if (!isReady) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading Dax...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Viewport />
      <ObjectTooltip />
      <ChatPanel isOpen={isChatOpen} onClose={handleCloseChat} />
      <GoalsPanel isOpen={isGoalsOpen} onClose={handleCloseGoals} />
      <EditorPanel
        isOpen={editor.isOpen}
        filePath={editor.filePath}
        fileName={editor.fileName}
        onClose={handleCloseEditor}
        onSave={handleEditorSave}
      />
      <SettingsPanel isOpen={isSettingsOpen} onClose={handleCloseSettings} />
      <NotificationToast />
      
      {/* Goals toggle button */}
      {!isGoalsOpen && (
        <button
          className="goals-toggle-button"
          onClick={() => setIsGoalsOpen(true)}
          aria-label="Open goals"
          title="View agent goals"
        >
          🎯
        </button>
      )}
      
      {/* Settings toggle button */}
      {!isSettingsOpen && (
        <button
          className="settings-toggle-button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings (Ctrl+,)"
        >
          ⚙️
        </button>
      )}
      
      {/* Chat toggle button */}
      {!isChatOpen && (
        <button
          className="chat-toggle-button"
          onClick={() => setIsChatOpen(true)}
          aria-label="Open chat"
          title="Open chat (Enter or /)"
        >
          💬
        </button>
      )}
    </div>
  );
}

export default App;
