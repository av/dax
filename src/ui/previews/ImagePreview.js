import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function ImagePreview({ base64, extension, sizeBytes, }) {
    const [dimensions, setDimensions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mime = MIME_TYPES[extension.toLowerCase()] ?? 'application/octet-stream';
    const dataUri = `data:${mime};base64,${base64}`;
    const handleLoad = useCallback((e) => {
        const img = e.currentTarget;
        setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setLoading(false);
    }, []);
    const handleError = useCallback(() => {
        setError('Failed to load image');
        setLoading(false);
    }, []);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [loading && !error && (_jsx("div", { style: { color: '#565f89', fontSize: '13px', padding: '12px 0' }, children: "Loading image\u2026" })), error && (_jsx("div", { style: { color: '#f7768e', fontSize: '13px', padding: '12px 0' }, children: error })), _jsx("img", { src: dataUri, alt: "Preview", onLoad: handleLoad, onError: handleError, style: {
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    background: '#1a1b2e',
                    display: error ? 'none' : 'block',
                } }), dimensions && (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#565f89',
                }, children: [_jsxs("span", { children: [dimensions.width, " \u00D7 ", dimensions.height, " px"] }), _jsx("span", { children: formatBytes(sizeBytes) })] }))] }));
}
