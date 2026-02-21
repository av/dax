import { useState, useEffect } from 'react';
import { codeToHtml } from 'shiki';

interface CodePreviewProps {
  content: string;
  extension: string | null;
}

const MAX_LINES = 200;

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.java': 'java',
  '.rb': 'ruby',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.xml': 'xml',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sql': 'sql',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.json': 'json',
  '.env': 'dotenv',
  '.conf': 'ini',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.cfg': 'ini',
  '.ini': 'ini',
};

function addLineNumbers(html: string): string {
  let lineNum = 0;
  return html.replace(/<span class="line[^"]*">/g, (match) => {
    lineNum++;
    return `${match}<span style="display:inline-block;width:3ch;margin-right:1.5ch;text-align:right;color:#565f89;user-select:none;pointer-events:none;flex-shrink:0">${lineNum}</span>`;
  });
}

export default function CodePreview({ content, extension }: CodePreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lineCount = content.split('\n').length;
  const truncated = lineCount > MAX_LINES;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const lines = content.split('\n').slice(0, MAX_LINES);
    const code = lines.join('\n');
    const lang = extension ? (EXT_TO_LANG[extension.toLowerCase()] ?? 'plaintext') : 'plaintext';

    const highlight = async (): Promise<void> => {
      let highlighted: string;
      try {
        highlighted = await codeToHtml(code, { lang, theme: 'github-dark' });
      } catch {
        try {
          highlighted = await codeToHtml(code, { lang: 'plaintext', theme: 'github-dark' });
        } catch (e: unknown) {
          throw new Error(
            `Highlight failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (!cancelled) {
        setHtml(addLineNumbers(highlighted));
        setLoading(false);
      }
    };

    highlight().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to highlight code');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content, extension]);

  if (loading) {
    return (
      <div style={{ color: '#565f89', fontSize: '13px', padding: '12px 0' }}>
        Highlighting…
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
        .dax-code-preview pre {
          margin: 0 !important;
          padding: 12px !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
          overflow-x: auto !important;
        }
        .dax-code-preview code {
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace !important;
        }
      `}</style>
      <div
        className="dax-code-preview"
        style={{ overflow: 'auto', maxHeight: '500px' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {truncated && (
        <div
          style={{
            color: '#565f89',
            fontSize: '11px',
            padding: '8px 0 0',
            textAlign: 'center',
          }}
        >
          Showing first {MAX_LINES} of {lineCount} lines
        </div>
      )}
    </div>
  );
}
