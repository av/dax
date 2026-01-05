import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { CanvasNode } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, Copy, Eye } from 'lucide-react';

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
        return 'bg-blue-50 dark:bg-blue-950 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-50';
      case 'agent':
        return 'bg-green-50 dark:bg-green-950 border-green-500 dark:border-green-500 text-green-900 dark:text-green-50';
      case 'transform':
        return 'bg-purple-50 dark:bg-purple-950 border-purple-500 dark:border-purple-500 text-purple-900 dark:text-purple-50';
      case 'output':
        return 'bg-orange-50 dark:bg-orange-950 border-orange-500 dark:border-orange-500 text-orange-900 dark:text-orange-50';
      default:
        return 'bg-gray-50 dark:bg-gray-950 border-gray-500 dark:border-gray-500 text-gray-900 dark:text-gray-50';
    }
  };

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
      className={`rounded-lg border-2 ${getNodeColor(node.type)} shadow-lg hover:shadow-2xl transition-all duration-200 cursor-move`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <div className="h-full flex flex-col p-4">
        {/* Toolbar */}
        {showToolbar && (
          <div className="absolute -top-12 left-0 right-0 flex justify-center gap-1 z-10 animate-in fade-in slide-in-from-top-2 duration-200">
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg h-9 w-9 p-0 border border-border"
              onClick={() => onDuplicate(node)}
              aria-label="Duplicate node"
              title="Duplicate node"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg h-9 w-9 p-0 border border-border"
              onClick={() => onConfigure(node)}
              aria-label="Configure node"
              title="Configure node"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-card hover:bg-accent shadow-lg h-9 w-9 p-0 border border-border"
              onClick={() => onPreview(node)}
              aria-label="Preview node"
              title="Preview node"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="shadow-lg h-9 w-9 p-0"
              onClick={() => onDelete(node.id)}
              aria-label="Delete node"
              title="Delete node"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Node Header */}
        <div className="font-semibold text-base mb-3 pb-2 border-b-2 border-current/20">
          {node.title}
        </div>

        {/* Node Content */}
        <div className="flex-1 overflow-auto text-sm space-y-2 opacity-90">
          <div className="font-medium">Type: <span className="font-normal">{node.type}</span></div>
          {node.config?.source && (
            <div className="font-medium">Source: <span className="font-normal">{node.config.source.type}</span></div>
          )}
          {node.config?.source?.path && (
            <div className="truncate">
              <span className="font-medium">Path:</span> <span className="font-normal">{node.config.source.path}</span>
            </div>
          )}
          {node.config?.source?.url && (
            <div className="truncate">
              <span className="font-medium">URL:</span> <span className="font-normal">{node.config.source.url}</span>
            </div>
          )}
        </div>
      </div>
    </Rnd>
  );
};
