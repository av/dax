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
        return 'bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-100';
      case 'agent':
        return 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600 text-green-900 dark:text-green-100';
      case 'transform':
        return 'bg-purple-100 dark:bg-purple-900 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-purple-100';
      case 'output':
        return 'bg-orange-100 dark:bg-orange-900 border-orange-400 dark:border-orange-600 text-orange-900 dark:text-orange-100';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100';
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
        onUpdate({
          ...node,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position,
        });
      }}
      bounds="parent"
      className={`rounded-lg border-2 ${getNodeColor(node.type)} shadow-lg backdrop-blur-sm`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <div className="h-full flex flex-col p-2">
        {/* Toolbar */}
        {showToolbar && (
          <div className="absolute -top-10 left-0 right-0 flex justify-center gap-1 z-10">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white dark:bg-slate-800 shadow-md"
              onClick={() => onDuplicate(node)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white dark:bg-slate-800 shadow-md"
              onClick={() => onConfigure(node)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white dark:bg-slate-800 shadow-md"
              onClick={() => onPreview(node)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="shadow-md"
              onClick={() => onDelete(node.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Node Header */}
        <div className="font-semibold text-sm mb-2 border-b border-current pb-1">
          {node.title}
        </div>

        {/* Node Content */}
        <div className="flex-1 overflow-auto text-xs">
          <div className="space-y-1">
            <div>Type: {node.type}</div>
            {node.config?.source && (
              <div>Source: {node.config.source.type}</div>
            )}
            {node.config?.source?.path && (
              <div className="truncate">Path: {node.config.source.path}</div>
            )}
            {node.config?.source?.url && (
              <div className="truncate">URL: {node.config.source.url}</div>
            )}
          </div>
        </div>
      </div>
    </Rnd>
  );
};
