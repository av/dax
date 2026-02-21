import { useState, useEffect } from 'react';
import type { FileNode } from '@/types';
import CodePreview from './CodePreview';
import MarkdownPreview from './MarkdownPreview';
import ImagePreview from './ImagePreview';
import PdfPreview from './PdfPreview';
import CsvPreview from './CsvPreview';

// ── Extension category maps ─────────────────────────────

type PreviewType = 'code' | 'markdown' | 'image' | 'pdf' | 'csv' | 'none';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.c', '.cpp', '.h',
  '.java', '.rb', '.css', '.scss', '.html', '.xml', '.sh', '.bash', '.zsh',
  '.sql', '.yaml', '.yml', '.toml', '.json', '.env', '.conf',
]);

const PLAINTEXT_EXTENSIONS = new Set(['.txt', '.log', '.cfg', '.ini']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const CSV_EXTENSIONS = new Set(['.csv', '.tsv']);

function getPreviewType(extension: string | null): PreviewType {
  if (!extension) return 'none';
  const ext = extension.toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (PLAINTEXT_EXTENSIONS.has(ext)) return 'code'; // plain text uses CodePreview
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (CSV_EXTENSIONS.has(ext)) return 'csv';
  return 'none';
}

// ── Constants ───────────────────────────────────────────

const MAX_TEXT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BINARY_SIZE = 50 * 1024 * 1024; // 50 MB

// ── Sub-components ──────────────────────────────────────

function NoPreview({ node }: { node: FileNode }) {
  const handleOpen = (): void => {
    window.electronAPI.openExternal(node.path).catch((err: unknown) => {
      console.error('Failed to open externally:', err);
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '24px 0',
      }}
    >
      <div style={{ fontSize: '40px', opacity: 0.4 }}>📄</div>
      <div style={{ color: '#565f89', fontSize: '13px', textAlign: 'center' }}>
        No preview available for this file type
      </div>
      <button
        onClick={handleOpen}
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          background: 'rgba(122, 162, 247, 0.1)',
          color: '#7aa2f7',
          border: '1px solid #7aa2f733',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Open Externally
      </button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────

export default function FilePreview({ node }: { node: FileNode }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const previewType = getPreviewType(node.extension);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    if (previewType === 'none') {
      setLoading(false);
      return;
    }

    const isBinary = previewType === 'image' || previewType === 'pdf';
    const sizeLimit = isBinary ? MAX_BINARY_SIZE : MAX_TEXT_SIZE;

    if (node.sizeBytes > sizeLimit) {
      setError(`File too large to preview (${(node.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`);
      setLoading(false);
      return;
    }

    const load = async (): Promise<void> => {
      try {
        const data = isBinary
          ? await window.electronAPI.readBinaryFile(node.path)
          : await window.electronAPI.readFileContent(node.path);

        if (!cancelled) {
          setContent(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load file',
          );
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [node.path, previewType, node.sizeBytes]);

  // No-preview type: render immediately without loading content
  if (previewType === 'none') {
    return <NoPreview node={node} />;
  }

  if (loading) {
    return (
      <div style={{ color: '#565f89', fontSize: '13px', padding: '12px 0' }}>
        Loading preview…
      </div>
    );
  }

  if (error || content === null) {
    return (
      <div style={{ color: '#f7768e', fontSize: '13px', padding: '12px 0' }}>
        {error ?? 'Failed to load file'}
      </div>
    );
  }

  switch (previewType) {
    case 'code':
      return <CodePreview content={content} extension={node.extension} />;
    case 'markdown':
      return <MarkdownPreview content={content} />;
    case 'image':
      return (
        <ImagePreview
          base64={content}
          extension={node.extension!}
          sizeBytes={node.sizeBytes}
        />
      );
    case 'pdf':
      return <PdfPreview base64={content} />;
    case 'csv':
      return <CsvPreview content={content} />;
  }
}
