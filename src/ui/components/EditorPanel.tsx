import { useState, useEffect, useRef, useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readFile, saveFile, watchFile, unwatchFile, type FileChangeEvent } from '@/services/tauri';
import { sceneEvents } from '@/engine/events';
import { showSuccess, showError } from './NotificationToast';

export interface EditorPanelProps {
  isOpen: boolean;
  filePath: string | null;
  fileName: string;
  onClose: () => void;
  onSave?: (path: string, content: string) => void;
}

export function EditorPanel({ isOpen, filePath, fileName, onClose, onSave }: EditorPanelProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [externalChange, setExternalChange] = useState(false);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentPathRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Determine file type for syntax highlighting hint
  const getFileType = useCallback((path: string | null): string => {
    if (!path) return 'text';
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp'];
    const markdownExtensions = ['md', 'markdown'];
    const jsonExtensions = ['json', 'jsonc'];
    const configExtensions = ['yaml', 'yml', 'toml', 'ini', 'env'];
    
    if (codeExtensions.includes(ext)) return 'code';
    if (markdownExtensions.includes(ext)) return 'markdown';
    if (jsonExtensions.includes(ext)) return 'json';
    if (configExtensions.includes(ext)) return 'config';
    return 'text';
  }, []);

  const fileType = getFileType(filePath);

  const updateLineNumbers = useCallback((text: string) => {
    const lines = text.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, []);

  // Load file content
  useEffect(() => {
    if (!isOpen || !filePath) return;

    const loadFile = async () => {
      setIsLoading(true);
      try {
        const result = await readFile(filePath);
        const text = result.text || '';
        setContent(text);
        setOriginalContent(text);
        setHasUnsavedChanges(false);
        setExternalChange(false);
        updateLineNumbers(text);
      } catch (error) {
        console.error('Failed to load file:', error);
        showError('Failed to load file', String(error));
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [isOpen, filePath, updateLineNumbers]);

  // Set up file watcher
  useEffect(() => {
    if (!isOpen || !filePath) return;

    currentPathRef.current = filePath;

    const setupWatcher = async () => {
      try {
        await watchFile(filePath);

        unlistenRef.current = await listen<FileChangeEvent>('file-changed', (event) => {
          if (event.payload.path === currentPathRef.current) {
            if (event.payload.changeType === 'modified') {
              setExternalChange(true);
            } else if (event.payload.changeType === 'removed') {
              showError('File deleted', 'The file was deleted externally.');
              onClose();
            }
          }
        });
      } catch (error) {
        console.error('Failed to set up file watcher:', error);
      }
    };

    setupWatcher();

    return () => {
      // Cleanup watcher
      if (currentPathRef.current) {
        unwatchFile(currentPathRef.current).catch(console.error);
        currentPathRef.current = null;
      }
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [isOpen, filePath, onClose]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(newContent !== originalContent);
    updateLineNumbers(newContent);
  };

  const handleSave = async () => {
    if (!filePath || isSaving) return;

    setIsSaving(true);
    try {
      await saveFile(filePath, content);
      setOriginalContent(content);
      setHasUnsavedChanges(false);
      setExternalChange(false);
      showSuccess('File saved', fileName);
      onSave?.(filePath, content);
    } catch (error) {
      console.error('Failed to save file:', error);
      showError('Failed to save file', String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReload = async () => {
    if (!filePath) return;

    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Reload anyway?');
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      const result = await readFile(filePath);
      const text = result.text || '';
      setContent(text);
      setOriginalContent(text);
      setHasUnsavedChanges(false);
      setExternalChange(false);
      updateLineNumbers(text);
    } catch (error) {
      console.error('Failed to reload file:', error);
      showError('Failed to reload file', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Close anyway?');
      if (!confirmed) return;
    }
    onClose();
  };

  /**
   * Extract selected text to a new snippet
   */
  const handleExtractToSnippet = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) {
      showError('No selection', 'Please select some text to extract as a snippet.');
      return;
    }

    const selectedText = content.substring(start, end);
    
    // Calculate line numbers for the selection
    const textBeforeSelection = content.substring(0, start);
    const startLine = textBeforeSelection.split('\n').length;
    const endLine = startLine + selectedText.split('\n').length - 1;

    // Create snippet from selection
    sceneEvents.emit('command:spawn-object', {
      type: 'snippet',
      position: { x: Math.random() * 4 - 2, y: 0.5, z: Math.random() * 4 - 2 },
      data: {
        title: `${fileName} (lines ${startLine}-${endLine})`,
        content: selectedText,
        tags: ['extracted', fileType],
        color: '#45b7d1', // Code color
        sourceFileId: filePath, // Will be linked when ObjectManager processes it
        sourceRange: {
          startLine,
          startColumn: start - textBeforeSelection.lastIndexOf('\n') - 1,
          endLine,
          endColumn: end - content.substring(0, end).lastIndexOf('\n') - 1,
        },
      },
    });

    showSuccess('Snippet created', `Extracted ${selectedText.split('\n').length} lines`);
  }, [content, fileName, filePath, fileType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Ctrl+Shift+E to extract to snippet
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      handleExtractToSnippet();
    }
    // Escape to close
    if (e.key === 'Escape') {
      handleClose();
    }
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
        setContent(newContent);
        setHasUnsavedChanges(newContent !== originalContent);
        // Set cursor position after indent
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  const renderMarkdownPreview = () => {
    // Simple markdown rendering (for a full implementation, use a library like marked)
    const html = content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');

    return (
      <div
        className="editor-markdown-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <div className="editor-title">
          <span className="editor-filename">
            {fileName}
            {hasUnsavedChanges && <span className="editor-unsaved">•</span>}
          </span>
          <span className="editor-filetype">{fileType}</span>
        </div>
        <div className="editor-actions">
          {externalChange && (
            <button
              className="editor-action reload"
              onClick={handleReload}
              title="File changed externally - click to reload"
            >
              ⟳ Reload
            </button>
          )}
          {fileType === 'markdown' && (
            <button
              className={`editor-action preview ${isMarkdownPreview ? 'active' : ''}`}
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              title="Toggle preview"
            >
              👁 Preview
            </button>
          )}
          <button
            className="editor-action extract"
            onClick={handleExtractToSnippet}
            title="Extract selection to snippet (Ctrl+Shift+E)"
          >
            📝 Extract
          </button>
          <button
            className="editor-action save"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            title="Save (Ctrl+S)"
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>
          <button
            className="editor-close"
            onClick={handleClose}
            aria-label="Close editor"
          >
            ×
          </button>
        </div>
      </div>

      <div className="editor-content">
        {isLoading ? (
          <div className="editor-loading">Loading...</div>
        ) : isMarkdownPreview && fileType === 'markdown' ? (
          renderMarkdownPreview()
        ) : (
          <div className="editor-code-area">
            <div className="editor-line-numbers">
              {lineNumbers.map((num) => (
                <div key={num} className="editor-line-number">
                  {num}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className={`editor-textarea editor-${fileType}`}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              spellCheck={fileType === 'text' || fileType === 'markdown'}
              wrap="off"
            />
          </div>
        )}
      </div>

      <div className="editor-footer">
        <span className="editor-stats">
          {content.split('\n').length} lines, {content.length} characters
        </span>
        <span className="editor-hint">Ctrl+S to save, Esc to close</span>
      </div>
    </div>
  );
}

export default EditorPanel;
