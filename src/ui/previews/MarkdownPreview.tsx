import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  content: string;
}

/** Strip dangerous HTML from rendered markdown output. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.resolve(marked.parse(content))
      .then((rawHtml) => {
        if (!cancelled) {
          setHtml(sanitizeHtml(rawHtml));
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to parse markdown',
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (loading) {
    return (
      <div style={{ color: '#565f89', fontSize: '13px', padding: '12px 0' }}>
        Rendering…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#f7768e', fontSize: '13px', padding: '12px 0' }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .dax-md-preview h1,
        .dax-md-preview h2,
        .dax-md-preview h3,
        .dax-md-preview h4,
        .dax-md-preview h5,
        .dax-md-preview h6 { color: #c0caf5; margin: 16px 0 8px; }
        .dax-md-preview h1 { font-size: 1.5em; border-bottom: 1px solid #292e42; padding-bottom: 8px; }
        .dax-md-preview h2 { font-size: 1.3em; }
        .dax-md-preview h3 { font-size: 1.1em; }
        .dax-md-preview p { color: #a9b1d6; margin: 8px 0; line-height: 1.6; }
        .dax-md-preview a { color: #7aa2f7; text-decoration: none; }
        .dax-md-preview a:hover { text-decoration: underline; }
        .dax-md-preview code {
          background: #1a1b2e; padding: 2px 6px; border-radius: 4px;
          font-size: 0.9em; color: #bb9af7;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
        }
        .dax-md-preview pre {
          background: #1a1b2e; padding: 12px; border-radius: 6px;
          overflow-x: auto; margin: 8px 0;
        }
        .dax-md-preview pre code { padding: 0; background: none; }
        .dax-md-preview ul, .dax-md-preview ol { color: #a9b1d6; padding-left: 24px; margin: 8px 0; }
        .dax-md-preview li { margin: 4px 0; line-height: 1.6; }
        .dax-md-preview blockquote {
          border-left: 3px solid #7aa2f7; padding-left: 12px;
          margin: 8px 0; color: #565f89;
        }
        .dax-md-preview img { max-width: 100%; border-radius: 4px; }
        .dax-md-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .dax-md-preview th, .dax-md-preview td {
          border: 1px solid #292e42; padding: 8px;
          text-align: left; color: #a9b1d6;
        }
        .dax-md-preview th { background: #1a1b2e; color: #c0caf5; }
        .dax-md-preview hr { border: none; border-top: 1px solid #292e42; margin: 16px 0; }
        .dax-md-preview strong { color: #c0caf5; }
        .dax-md-preview em { color: #a9b1d6; }
      `}</style>
      <div
        className="dax-md-preview"
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          wordBreak: 'break-word',
          overflow: 'auto',
          maxHeight: '500px',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
