import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import Papa from 'papaparse';
const MAX_ROWS = 100;
export default function CsvPreview({ content }) {
    const { fields, rows, totalRowEstimate, error } = useMemo(() => {
        try {
            const result = Papa.parse(content, {
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
                error: null,
            };
        }
        catch (err) {
            return {
                fields: [],
                rows: [],
                totalRowEstimate: 0,
                error: err instanceof Error ? err.message : 'Failed to parse CSV',
            };
        }
    }, [content]);
    if (error) {
        return (_jsx("div", { style: { color: '#f7768e', fontSize: '13px', padding: '12px 0' }, children: error }));
    }
    if (fields.length === 0) {
        return (_jsx("div", { style: { color: '#565f89', fontSize: '13px', padding: '12px 0' }, children: "No data found" }));
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsxs("div", { style: { color: '#565f89', fontSize: '12px' }, children: [fields.length, " columns \u00B7 ", rows.length, " of ~", totalRowEstimate, " rows"] }), _jsx("style", { children: `
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
          background: #1a1b2e;
          color: #c0caf5;
          padding: 6px 10px;
          text-align: left;
          border-bottom: 2px solid #292e42;
          font-weight: 600;
          white-space: nowrap;
          z-index: 1;
        }
        .dax-csv-table td {
          padding: 4px 10px;
          color: #a9b1d6;
          border-bottom: 1px solid #1a1b2e;
          white-space: nowrap;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dax-csv-table tr:hover td {
          background: rgba(122, 162, 247, 0.05);
        }
      ` }), _jsx("div", { style: {
                    overflow: 'auto',
                    maxHeight: '400px',
                    borderRadius: '6px',
                    border: '1px solid #292e42',
                }, children: _jsxs("table", { className: "dax-csv-table", children: [_jsx("thead", { children: _jsx("tr", { children: fields.map((field) => (_jsx("th", { children: field }, field))) }) }), _jsx("tbody", { children: rows.map((row, i) => (_jsx("tr", { children: fields.map((field) => (_jsx("td", { children: row[field] ?? '' }, field))) }, i))) })] }) }), rows.length >= MAX_ROWS && (_jsxs("div", { style: {
                    color: '#565f89',
                    fontSize: '11px',
                    textAlign: 'center',
                }, children: ["Showing first ", MAX_ROWS, " rows"] }))] }));
}
