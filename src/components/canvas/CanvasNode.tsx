import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { CanvasNode } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, Copy, Eye, AlertCircle } from 'lucide-react';

interface CanvasNodeComponentProps {
  node: CanvasNode;
  onUpdate: (node: CanvasNode) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: CanvasNode) => void;
  onConfigure: (node: CanvasNode) => void;
  onPreview: (node: CanvasNode) => void;
}

export const CanvasNodeComponent: React.FC<CanvasNodeComponentProps> = ({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onConfigure,
  onPreview,
}) => {
  const [showToolbar, setShowToolbar] = useState(false);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'data':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 text-blue-900 dark:text-blue-100';
      case 'agent':
        return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100';
      case 'transform':
        return 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-500 text-purple-900 dark:text-purple-100';
      case 'output':
        return 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-100';
      default:
        return 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100';
    }
  };

  // Check if node is configured
  const isNodeConfigured = () => {
    if (node.type === 'data') {
      return node.config?.source && (node.config.source.path || node.config.source.url);
    }
    // Other types can be configured later
    return false;
  };

  const configured = isNodeConfigured();

  return (
    <Rnd
      size={{ width: node.width, height: node.height }}
      position={{ x: node.x, y: node.y }}
      onDragStop={(_e, d) => {
        onUpdate({ ...node, x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        const width = Number.parseInt(ref.style.width, 10) || node.width;
        const height = Number.parseInt(ref.style.height, 10) || node.height;
        onUpdate({
          ...node,
          width,
          height,
          ...position,
        });
      }}
      bounds="parent"
      className={`rounded-xl border-2 ${getNodeColor(node.type)} shadow-md hover:shadow-xl transition-all duration-200 cursor-move backdrop-blur-sm`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <div className="h-full flex flex-col p-4">
        {/* Configuration Status Indicator */}
        {!configured && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md text-xs font-bold border border-amber-300 dark:border-amber-700">
            <AlertCircle className="h-3 w-3" />
            <span>Not configured</span>
          </div>
        )}
        {configured && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-md text-xs font-bold border border-green-300 dark:border-green-700">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Ready</span>
          </div>
        )}
        
        {/* Toolbar */}
        {showToolbar && (
          <div className="absolute -top-14 left-0 right-0 flex justify-center gap-2 z-10 animate-in fade-in slide-in-from-top-2 duration-150">
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg hover:shadow-xl h-10 w-10 p-0 border border-border rounded-lg transition-all"
              onClick={() => onDuplicate(node)}
              aria-label="Duplicate node"
              title="Duplicate node"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg hover:shadow-xl h-10 w-10 p-0 border border-border rounded-lg transition-all"
              onClick={() => onConfigure(node)}
              aria-label="Configure node"
              title="Configure node"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg hover:shadow-xl h-10 w-10 p-0 border border-border rounded-lg transition-all"
              onClick={() => onPreview(node)}
              aria-label="Preview node"
              title="Preview node"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="shadow-lg hover:shadow-xl h-10 w-10 p-0 rounded-lg transition-all"
              onClick={() => onDelete(node.id)}
              aria-label="Delete node"
              title="Delete node"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Node Header */}
        <div className="font-bold text-base mb-3 pb-3 border-b-2 border-current/30">
          {node.title}
        </div>

        {/* Node Content */}
        <div className="flex-1 overflow-auto text-sm space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-xs uppercase tracking-wide opacity-70">Type:</span>
            <span className="font-medium capitalize">{node.type}</span>
          </div>
          {node.config?.source && (
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-xs uppercase tracking-wide opacity-70">Source:</span>
              <span className="font-medium uppercase">{node.config.source.type}</span>
            </div>
          )}
          {node.config?.source?.path && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-xs uppercase tracking-wide opacity-70">Path:</span>
              <span className="font-mono text-xs truncate bg-black/5 dark:bg-white/5 px-2 py-1 rounded">{node.config.source.path}</span>
            </div>
          )}
          {node.config?.source?.url && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-xs uppercase tracking-wide opacity-70">URL:</span>
              <span className="font-mono text-xs truncate bg-black/5 dark:bg-white/5 px-2 py-1 rounded">{node.config.source.url}</span>
            </div>
          )}
        </div>
      </div>
    </Rnd>
  );
};
