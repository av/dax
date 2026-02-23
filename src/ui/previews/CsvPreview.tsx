import { useMemo } from 'react';
import Papa from 'papaparse';
import { theme } from '@/theme';

interface CsvPreviewProps {
  content: string;
}

const MAX_ROWS = 100;

export default function CsvPreview({ content }: CsvPreviewProps) {
  const { fields, rows, totalRowEstimate, error } = useMemo(() => {
    try {
      const result = Papa.parse<Record<string, string>>(content, {
        header: true,
        preview: MAX_ROWS,
        skipEmptyLines: true,
      });

      const parsedFields = result.meta.fields ?? [];
      const parsedRows = result.data;

      // Rough total row count from the raw content
      const lineCount = content.split('\n').filter((l) => l.trim()).length;
      const total = Math.max(0, lineCount - 1); // subtract header

      return {
        fields: parsedFields,
        rows: parsedRows,
        totalRowEstimate: total,
        error: null as string | null,
      };
    } catch (err: unknown) {
      return {
        fields: [] as string[],
        rows: [] as Record<string, string>[],
        totalRowEstimate: 0,
        error: err instanceof Error ? err.message : 'Failed to parse CSV',
      };
    }
  }, [content]);

  if (error) {
    return (
      <div style={{ color: theme.colors.statusError, fontSize: '13px', padding: '12px 0' }}>
        {error}
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div style={{ color: theme.colors.textSecondary, fontSize: '13px', padding: '12px 0' }}>
        No data found
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ color: theme.colors.textSecondary, fontSize: '12px' }}>
        {fields.length} columns · {rows.length} of ~{totalRowEstimate} rows
      </div>

      <style>{`
        .dax-csv-table {
          border-collapse: collapse;
          width: max-content;
          min-width: 100%;
          font-size: 12px;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
        }
        .dax-csv-table th {
          position: sticky;
          top: 0;
          background: ${theme.colors.bgBase};
          color: ${theme.colors.textPrimary};
          padding: 6px 10px;
          text-align: left;
          border-bottom: 2px solid ${theme.colors.borderDefault};
          font-weight: 600;
          white-space: nowrap;
          z-index: 1;
        }
        .dax-csv-table td {
          padding: 4px 10px;
          color: ${theme.colors.textPrimary};
          border-bottom: 1px solid ${theme.colors.bgBase};
          white-space: nowrap;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dax-csv-table tr:hover td {
          background: ${theme.colors.accentPrimary}0D;
        }
      `}</style>

      <div
        style={{
          overflow: 'auto',
          maxHeight: '400px',
          borderRadius: '6px',
          border: `1px solid ${theme.colors.borderDefault}`,
        }}
      >
        <table className="dax-csv-table">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field}>{field}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {fields.map((field) => (
                  <td key={field}>{row[field] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length >= MAX_ROWS && (
        <div
          style={{
            color: theme.colors.textSecondary,
            fontSize: '11px',
            textAlign: 'center',
          }}
        >
          Showing first {MAX_ROWS} rows
        </div>
      )}
    </div>
  );
}
