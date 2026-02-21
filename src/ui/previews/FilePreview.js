import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import CodePreview from './CodePreview';
import MarkdownPreview from './MarkdownPreview';
import ImagePreview from './ImagePreview';
import PdfPreview from './PdfPreview';
import CsvPreview from './CsvPreview';
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
function getPreviewType(extension) {
    if (!extension)
        return 'none';
    const ext = extension.toLowerCase();
    if (CODE_EXTENSIONS.has(ext))
        return 'code';
    if (PLAINTEXT_EXTENSIONS.has(ext))
        return 'code'; // plain text uses CodePreview
    if (MARKDOWN_EXTENSIONS.has(ext))
        return 'markdown';
    if (IMAGE_EXTENSIONS.has(ext))
        return 'image';
    if (PDF_EXTENSIONS.has(ext))
        return 'pdf';
    if (CSV_EXTENSIONS.has(ext))
        return 'csv';
    return 'none';
}
// ── Constants ───────────────────────────────────────────
const MAX_TEXT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BINARY_SIZE = 50 * 1024 * 1024; // 50 MB
// ── Sub-components ──────────────────────────────────────
function NoPreview({ node }) {
    const handleOpen = () => {
        window.electronAPI.openExternal(node.path).catch((err) => {
            console.error('Failed to open externally:', err);
        });
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '24px 0',
        }, children: [_jsx("div", { style: { fontSize: '40px', opacity: 0.4 }, children: "\uD83D\uDCC4" }), _jsx("div", { style: { color: '#565f89', fontSize: '13px', textAlign: 'center' }, children: "No preview available for this file type" }), _jsx("button", { onClick: handleOpen, style: {
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: 'rgba(122, 162, 247, 0.1)',
                    color: '#7aa2f7',
                    border: '1px solid #7aa2f733',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }, children: "Open Externally" })] }));
}
// ── Main component ──────────────────────────────────────
export default function FilePreview({ node }) {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
        const load = async () => {
            try {
                const data = isBinary
                    ? await window.electronAPI.readBinaryFile(node.path)
                    : await window.electronAPI.readFileContent(node.path);
                if (!cancelled) {
                    setContent(data);
                    setLoading(false);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load file');
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
        return _jsx(NoPreview, { node: node });
    }
    if (loading) {
        return (_jsx("div", { style: { color: '#565f89', fontSize: '13px', padding: '12px 0' }, children: "Loading preview\u2026" }));
    }
    if (error || content === null) {
        return (_jsx("div", { style: { color: '#f7768e', fontSize: '13px', padding: '12px 0' }, children: error ?? 'Failed to load file' }));
    }
    switch (previewType) {
        case 'code':
            return _jsx(CodePreview, { content: content, extension: node.extension });
        case 'markdown':
            return _jsx(MarkdownPreview, { content: content });
        case 'image':
            return (_jsx(ImagePreview, { base64: content, extension: node.extension, sizeBytes: node.sizeBytes }));
        case 'pdf':
            return _jsx(PdfPreview, { base64: content });
        case 'csv':
            return _jsx(CsvPreview, { content: content });
    }
}
