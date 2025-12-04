import { useState, useEffect, useCallback } from 'react';
import Viewport from './ui/components/Viewport';
import { ObjectTooltip } from './ui/components/ObjectTooltip';
import { ChatPanel } from './ui/components/ChatPanel';
import { GoalsPanel } from './ui/components/GoalsPanel';
import { NotificationToast } from './ui/components/NotificationToast';
import { EditorPanel } from './ui/components/EditorPanel';
import { sceneEvents } from './engine/events';
import { useSceneStore } from './ui/stores/sceneStore';
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
  const [editor, setEditor] = useState<EditorState>({
    isOpen: false,
    filePath: null,
    fileName: '',
    objectId: null,
  });

  const getObject = useSceneStore((state) => state.getObject);
  const updateObject = useSceneStore((state) => state.updateObject);

  const handleToggleChat = useCallback((data: { open: boolean }) => {
    setIsChatOpen(data.open);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const handleCloseGoals = useCallback(() => {
    setIsGoalsOpen(false);
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
    setIsReady(true);

    // Listen for chat toggle events
    sceneEvents.on('command:toggle-chat', handleToggleChat);
    
    // Listen for double-click events to open editor
    sceneEvents.on('input:doubleclick', handleDoubleClick);

    return () => {
      sceneEvents.off('command:toggle-chat', handleToggleChat);
      sceneEvents.off('input:doubleclick', handleDoubleClick);
    };
  }, [handleToggleChat, handleDoubleClick]);

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
