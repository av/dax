import { useState, useCallback } from 'react';
import type { BoundaryAction, BoundaryInstruction } from '@/types';
import { sceneEvents } from '@/engine/events';

export interface BoundaryEditorProps {
  isOpen: boolean;
  boundaryId: string;
  label?: string;
  instructions: BoundaryInstruction[];
  onClose: () => void;
  onSave: (label: string, instructions: BoundaryInstruction[]) => void;
}

const INSTRUCTION_TYPES: Array<{
  action: BoundaryAction;
  label: string;
  icon: string;
  description: string;
}> = [
  { 
    action: 'organize', 
    label: 'Organize', 
    icon: '📁',
    description: 'Agent should organize files by type, date, or content' 
  },
  { 
    action: 'summarize', 
    label: 'Summarize', 
    icon: '📝',
    description: 'Agent should create summaries of files' 
  },
  { 
    action: 'review', 
    label: 'Review', 
    icon: '👀',
    description: 'Agent should analyze and report issues' 
  },
  { 
    action: 'ignore', 
    label: 'Ignore', 
    icon: '🚫',
    description: 'Agent should not process files in this zone' 
  },
  { 
    action: 'protect', 
    label: 'Protect', 
    icon: '🛡️',
    description: 'Agent cannot modify or move files' 
  },
  { 
    action: 'custom', 
    label: 'Custom', 
    icon: '⚙️',
    description: 'Define custom agent behavior' 
  },
];

export function BoundaryEditor({
  isOpen,
  boundaryId: _boundaryId,
  label: initialLabel = '',
  instructions: initialInstructions,
  onClose,
  onSave,
}: BoundaryEditorProps) {
  const [label, setLabel] = useState(initialLabel);
  const [instructions, setInstructions] = useState<BoundaryInstruction[]>(initialInstructions);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleAddInstruction = useCallback((action: BoundaryAction) => {
    const newInstruction: BoundaryInstruction = {
      id: crypto.randomUUID(),
      action,
      parameters: action === 'custom' ? { prompt: customPrompt } : {},
      priority: instructions.length + 1,
    };
    setInstructions([...instructions, newInstruction]);
    if (action === 'custom') {
      setCustomPrompt('');
    }
  }, [instructions, customPrompt]);

  const handleRemoveInstruction = useCallback((id: string) => {
    setInstructions(instructions.filter((i) => i.id !== id));
  }, [instructions]);

  const handlePriorityChange = useCallback((id: string, delta: number) => {
    const index = instructions.findIndex((i) => i.id === id);
    if (index === -1) return;
    
    const newIndex = Math.max(0, Math.min(instructions.length - 1, index + delta));
    if (newIndex === index) return;

    const newInstructions = [...instructions];
    const [item] = newInstructions.splice(index, 1);
    if (item) {
      newInstructions.splice(newIndex, 0, item);
    }
    
    // Update priority numbers
    const updated = newInstructions.map((instr, i) => ({
      ...instr,
      priority: i + 1,
    }));
    setInstructions(updated);
  }, [instructions]);

  const handleSave = useCallback(() => {
    onSave(label, instructions);
    sceneEvents.emit('notification', {
      type: 'success',
      title: 'Boundary updated',
      message: `${instructions.length} instruction(s) saved`,
    });
  }, [label, instructions, onSave]);

  if (!isOpen) return null;

  return (
    <div className="boundary-editor-overlay" onClick={onClose}>
      <div className="boundary-editor" onClick={(e) => e.stopPropagation()}>
        <div className="boundary-editor-header">
          <h3>Edit Boundary Zone</h3>
          <button
            className="boundary-editor-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="boundary-editor-content">
          <div className="boundary-editor-field">
            <label htmlFor="boundary-label">Label</label>
            <input
              id="boundary-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Zone name..."
            />
          </div>

          <div className="boundary-editor-section">
            <h4>Instructions</h4>
            <p className="boundary-editor-hint">
              Add instructions for how the agent should handle files in this zone.
            </p>

            <div className="boundary-instructions-list">
              {instructions.length === 0 ? (
                <div className="boundary-instructions-empty">
                  No instructions added. The agent will treat this zone normally.
                </div>
              ) : (
                instructions.map((instr, index) => {
                  const typeInfo = INSTRUCTION_TYPES.find((t) => t.action === instr.action);
                  return (
                    <div key={instr.id} className="boundary-instruction-item">
                      <span className="boundary-instruction-priority">{index + 1}</span>
                      <span className="boundary-instruction-icon">{typeInfo?.icon}</span>
                      <div className="boundary-instruction-info">
                        <span className="boundary-instruction-label">{typeInfo?.label}</span>
                        {instr.action === 'custom' && typeof instr.parameters.prompt === 'string' && (
                          <span className="boundary-instruction-prompt">
                            {instr.parameters.prompt}
                          </span>
                        )}
                      </div>
                      <div className="boundary-instruction-actions">
                        <button
                          onClick={() => handlePriorityChange(instr.id, -1)}
                          disabled={index === 0}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handlePriorityChange(instr.id, 1)}
                          disabled={index === instructions.length - 1}
                          title="Move down"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => handleRemoveInstruction(instr.id)}
                          className="remove"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="boundary-editor-section">
            <h4>Add Instruction</h4>
            <div className="boundary-instruction-types">
              {INSTRUCTION_TYPES.map((type) => (
                <button
                  key={type.action}
                  className="boundary-instruction-type"
                  onClick={() => handleAddInstruction(type.action)}
                  title={type.description}
                >
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-label">{type.label}</span>
                </button>
              ))}
            </div>

            <div className="boundary-custom-prompt">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Custom instruction prompt..."
              />
            </div>
          </div>
        </div>

        <div className="boundary-editor-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default BoundaryEditor;
