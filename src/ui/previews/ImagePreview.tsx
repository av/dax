import { useState, useCallback } from 'react';
import { theme } from '@/theme';

interface ImagePreviewProps {
  base64: string;
  extension: string;
  sizeBytes: number;
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePreview({
  base64,
  extension,
  sizeBytes,
}: ImagePreviewProps) {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mime = MIME_TYPES[extension.toLowerCase()] ?? 'application/octet-stream';
  const dataUri = `data:${mime};base64,${base64}`;

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setLoading(false);
    },
    [],
  );

  const handleError = useCallback(() => {
    setError('Failed to load image');
    setLoading(false);
  }, []);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {loading && !error && (
        <div
          style={{ color: theme.colors.textSecondary, fontSize: '13px', padding: '12px 0' }}
        >
          Loading image…
        </div>
      )}

      {error && (
        <div
          style={{ color: theme.colors.statusError, fontSize: '13px', padding: '12px 0' }}
        >
          {error}
        </div>
      )}

      <img
        src={dataUri}
        alt="Preview"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          maxWidth: '100%',
          maxHeight: '400px',
          objectFit: 'contain',
          borderRadius: '6px',
          background: theme.colors.bgBase,
          display: error ? 'none' : 'block',
        }}
      />

      {dimensions && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          <span>
            {dimensions.width} × {dimensions.height} px
          </span>
          <span>{formatBytes(sizeBytes)}</span>
        </div>
      )}
    </div>
  );
}
