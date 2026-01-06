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
      className={`group rounded-xl border-2 ${getNodeColor(node.type)} shadow-md hover:shadow-2xl transition-all duration-200 cursor-move backdrop-blur-sm hover:scale-[1.02]`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <div className="h-full flex flex-col p-4 relative">
        {/* Drag Handle Indicator - Always visible for better affordance */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none">
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="w-1 h-1 rounded-full bg-current" />
        </div>

        {/* Configuration Status Indicator - More prominent */}
        {!configured && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 border-amber-400 dark:border-amber-600 shadow-sm">
            <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
            <span>Setup Needed</span>
          </div>
        )}
        {configured && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 border-green-400 dark:border-green-600 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Ready</span>
          </div>
        )}
        
        {/* Quick Action Buttons - Always visible with subtle presence, prominent on hover */}
        <div className="absolute -top-12 left-0 right-0 flex justify-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
          <Button
            size="sm"
            variant="secondary"
            className="bg-card/95 hover:bg-primary hover:text-primary-foreground shadow-lg hover:shadow-xl h-9 w-9 p-0 border-2 border-border hover:border-primary rounded-lg transition-all backdrop-blur-sm"
            onClick={() => onDuplicate(node)}
            aria-label="Duplicate this node"
            title="Duplicate (Ctrl+D)"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className={`bg-card/95 hover:bg-primary hover:text-primary-foreground shadow-lg hover:shadow-xl h-9 w-9 p-0 border-2 ${!configured ? 'border-amber-400 animate-pulse' : 'border-border'} hover:border-primary rounded-lg transition-all backdrop-blur-sm`}
            onClick={() => onConfigure(node)}
            aria-label="Configure this node"
            title="Configure (Double-click node)"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-card/95 hover:bg-primary hover:text-primary-foreground shadow-lg hover:shadow-xl h-9 w-9 p-0 border-2 border-border hover:border-primary rounded-lg transition-all backdrop-blur-sm"
            onClick={() => onPreview(node)}
            aria-label="Preview node data"
            title="Preview"
            disabled={!configured}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="bg-destructive/90 hover:bg-destructive shadow-lg hover:shadow-xl h-9 w-9 p-0 rounded-lg transition-all backdrop-blur-sm border-2 border-destructive/50"
            onClick={() => onDelete(node.id)}
            aria-label="Delete this node"
            title="Delete (Del)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Subtle action hint for unconfigured nodes */}
        {!configured && !showToolbar && (
          <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
            Click <Settings className="h-3 w-3 inline mx-0.5" /> to configure
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
