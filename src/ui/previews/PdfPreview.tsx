import { useState, useEffect, useRef } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { theme } from '@/theme';

GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfPreviewProps {
  base64: string;
}

const MAX_WIDTH = 280;

function base64ToUint8Array(b64: string): Uint8Array {
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export default function PdfPreview({ base64 }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pdfDocument: { destroy(): Promise<void> } | null = null;

    setLoading(true);
    setError(null);

    const render = async (): Promise<void> => {
      try {
        const bytes = base64ToUint8Array(base64);
        const pdf = await getDocument({ data: bytes }).promise;

        if (cancelled) {
          void pdf.destroy();
          return;
        }
        pdfDocument = pdf;

        setPageCount(pdf.numPages);

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        const scale = MAX_WIDTH / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to render PDF',
          );
          setLoading(false);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (pdfDocument) void pdfDocument.destroy();
    };
  }, [base64]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {loading && !error && (
        <div
          style={{ color: theme.colors.textSecondary, fontSize: '13px', padding: '12px 0' }}
        >
          Rendering PDF…
        </div>
      )}

      {error && (
        <div
          style={{ color: theme.colors.statusError, fontSize: '13px', padding: '12px 0' }}
        >
          {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          borderRadius: '6px',
          background: theme.colors.bgSurface,
          display: error ? 'none' : 'block',
        }}
      />

      {pageCount > 0 && !error && (
        <div style={{ color: theme.colors.textSecondary, fontSize: '12px' }}>
          Page 1 of {pageCount}
        </div>
      )}
    </div>
  );
}
