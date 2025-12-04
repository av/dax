/**
 * HelpPanel Component
 * Displays keyboard shortcuts and documentation
 */

import React, { useState } from 'react';

interface ShortcutCategory {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['W', 'A', 'S', 'D'], description: 'Pan camera' },
      { keys: ['Mouse Drag'], description: 'Orbit camera' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Middle Mouse'], description: 'Pan camera' },
      { keys: ['R'], description: 'Reset camera' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: ['Click'], description: 'Select object' },
      { keys: ['Shift + Click'], description: 'Add to selection' },
      { keys: ['Ctrl + Click'], description: 'Toggle selection' },
      { keys: ['Ctrl + A'], description: 'Select all' },
      { keys: ['Escape'], description: 'Clear selection' },
      { keys: ['Click + Drag'], description: 'Box select' },
    ],
  },
  {
    title: 'Objects',
    shortcuts: [
      { keys: ['Delete', 'Backspace'], description: 'Delete selected' },
      { keys: ['Ctrl + D'], description: 'Duplicate selected' },
      { keys: ['G'], description: 'Group selected' },
      { keys: ['U'], description: 'Ungroup selected' },
      { keys: ['N'], description: 'Create snippet' },
    ],
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select tool' },
      { keys: ['B'], description: 'Boundary tool' },
      { keys: ['K'], description: 'Beacon tool' },
      { keys: ['T'], description: 'Text/Snippet tool' },
    ],
  },
  {
    title: 'Agent',
    shortcuts: [
      { keys: ['Space'], description: 'Open chat panel' },
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift + Enter'], description: 'New line in chat' },
      { keys: ['Ctrl + .'], description: 'Quick action menu' },
    ],
  },
  {
    title: 'Workspace',
    shortcuts: [
      { keys: ['Ctrl + S'], description: 'Save workspace' },
      { keys: ['Ctrl + O'], description: 'Open workspace' },
      { keys: ['Ctrl + N'], description: 'New workspace' },
      { keys: ['Ctrl + Shift + S'], description: 'Save as' },
      { keys: ['Ctrl + Z'], description: 'Undo' },
      { keys: ['Ctrl + Shift + Z'], description: 'Redo' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { keys: ['Ctrl + E'], description: 'Extract to snippet' },
      { keys: ['Ctrl + /'], description: 'Toggle comment' },
      { keys: ['Ctrl + F'], description: 'Find in file' },
      { keys: ['Ctrl + H'], description: 'Find and replace' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['F1'], description: 'Help panel' },
      { keys: ['F2'], description: 'Settings panel' },
      { keys: ['F3'], description: 'Toggle performance overlay' },
      { keys: ['F11'], description: 'Fullscreen' },
      { keys: ['Ctrl + \\'], description: 'Toggle sidebar' },
    ],
  },
];

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(SHORTCUTS.map((c) => c.title))
  );
  
  if (!isOpen) return null;
  
  const filteredShortcuts = SHORTCUTS.map((category) => ({
    ...category,
    shortcuts: category.shortcuts.filter(
      (s) =>
        searchQuery === '' ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  })).filter((c) => c.shortcuts.length > 0);
  
  const toggleCategory = (title: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedCategories(newExpanded);
  };
  
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>⌨️ Keyboard Shortcuts</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div style={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            style={styles.searchInput}
            autoFocus
          />
        </div>
        
        <div style={styles.content}>
          {filteredShortcuts.map((category) => (
            <div key={category.title} style={styles.category}>
              <button
                style={styles.categoryHeader}
                onClick={() => toggleCategory(category.title)}
              >
                <span style={styles.categoryTitle}>{category.title}</span>
                <span style={styles.categoryArrow}>
                  {expandedCategories.has(category.title) ? '▼' : '▶'}
                </span>
              </button>
              
              {expandedCategories.has(category.title) && (
                <div style={styles.shortcutList}>
                  {category.shortcuts.map((shortcut, idx) => (
                    <div key={idx} style={styles.shortcutRow}>
                      <div style={styles.keys}>
                        {shortcut.keys.map((key, kidx) => (
                          <React.Fragment key={kidx}>
                            {kidx > 0 && <span style={styles.keySeparator}>+</span>}
                            <kbd style={styles.kbd}>{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      <span style={styles.description}>{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {filteredShortcuts.length === 0 && (
            <div style={styles.noResults}>
              No shortcuts found matching "{searchQuery}"
            </div>
          )}
        </div>
        
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Press <kbd style={styles.kbdSmall}>F1</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
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
  panel: {
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    width: '600px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#fff',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  searchContainer: {
    padding: '12px 20px',
    borderBottom: '1px solid #333',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px',
  },
  category: {
    marginBottom: '12px',
  },
  categoryHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#252525',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  categoryTitle: {
    color: '#4ade80',
  },
  categoryArrow: {
    color: '#888',
    fontSize: '10px',
  },
  shortcutList: {
    padding: '8px 0 0 12px',
  },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  keys: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  keySeparator: {
    color: '#666',
    fontSize: '12px',
  },
  kbd: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#333',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    fontFamily: 'monospace',
    boxShadow: '0 2px 0 #222',
  },
  description: {
    color: '#ccc',
    fontSize: '13px',
  },
  noResults: {
    textAlign: 'center',
    color: '#666',
    padding: '40px 0',
    fontSize: '14px',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #333',
    textAlign: 'center',
  },
  footerText: {
    margin: 0,
    color: '#666',
    fontSize: '12px',
  },
  kbdSmall: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#333',
    border: '1px solid #555',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
};

export default HelpPanel;
