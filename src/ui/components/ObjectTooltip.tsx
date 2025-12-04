import { useEffect, useState, useCallback } from 'react';
import { sceneEvents } from '@/engine/events';
import { useSceneStore } from '@/ui/stores/sceneStore';
import type { FileObject } from '@/types';
import { getFileTypeInfo } from '@/services/fileTypes';

interface TooltipPosition {
  x: number;
  y: number;
}

interface TooltipData {
  id: string;
  position: TooltipPosition;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ObjectTooltip() {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const getObject = useSceneStore((state) => state.getObject);

  const handleHover = useCallback(
    (payload: { id: string | null; screenPosition: { x: number; y: number } | null }) => {
      if (payload.id && payload.screenPosition) {
        setTooltipData({
          id: payload.id,
          position: payload.screenPosition,
        });
        // Delay showing tooltip for smoother experience
        setTimeout(() => setIsVisible(true), 150);
      } else {
        setIsVisible(false);
        // Delay clearing data to allow fade out animation
        setTimeout(() => setTooltipData(null), 200);
      }
    },
    []
  );

  useEffect(() => {
    sceneEvents.on('object:hovered', handleHover);
    return () => {
      sceneEvents.off('object:hovered', handleHover);
    };
  }, [handleHover]);

  if (!tooltipData) return null;

  const object = getObject(tooltipData.id);
  if (!object) return null;

  const isFile = object.type === 'file';
  const fileObject = isFile ? (object as FileObject) : null;
  const typeInfo = fileObject ? getFileTypeInfo(fileObject.path) : null;

  // Position tooltip with offset and boundary checks
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: tooltipData.position.x + 16,
    top: tooltipData.position.y - 8,
    opacity: isVisible ? 1 : 0,
    transform: `translateY(${isVisible ? 0 : 8}px)`,
    transition: 'opacity 0.15s ease, transform 0.15s ease',
    pointerEvents: 'none',
    zIndex: 1000,
  };

  return (
    <div
      style={tooltipStyle}
      className="tooltip-container"
    >
      <div
        style={{
          background: 'rgba(24, 24, 27, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px 16px',
          minWidth: '200px',
          maxWidth: '320px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {typeInfo && (
            <span style={{ fontSize: '18px' }}>{typeInfo.icon}</span>
          )}
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileObject?.name ?? object.id.slice(0, 8)}
          </span>
        </div>

        {/* File details */}
        {fileObject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <TooltipRow label="Type" value={typeInfo?.category ?? 'Unknown'} />
            <TooltipRow label="Size" value={formatFileSize(fileObject.sizeBytes)} />
            {fileObject.extension && (
              <TooltipRow label="Extension" value={`.${fileObject.extension}`} />
            )}
            <TooltipRow label="Modified" value={formatDate(fileObject.lastModified)} />
            {fileObject.path && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '6px 8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  wordBreak: 'break-all',
                  lineHeight: 1.4,
                }}
              >
                {fileObject.path}
              </div>
            )}
          </div>
        )}

        {/* Non-file object info */}
        {!isFile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <TooltipRow label="Type" value={object.type} />
            <TooltipRow label="ID" value={object.id.slice(0, 12) + '...'} />
          </div>
        )}
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
