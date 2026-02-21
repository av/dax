import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerSrc;
const MAX_WIDTH = 280;
function base64ToUint8Array(b64) {
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}
export default function PdfPreview({ base64 }) {
    const canvasRef = useRef(null);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        let pdfDocument = null;
        setLoading(true);
        setError(null);
        const render = async () => {
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
                if (cancelled)
                    return;
                const baseViewport = page.getViewport({ scale: 1.0 });
                const scale = MAX_WIDTH / baseViewport.width;
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                if (!canvas)
                    return;
                const context = canvas.getContext('2d');
                if (!context)
                    return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: context, viewport }).promise;
                if (!cancelled) {
                    setLoading(false);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to render PDF');
                    setLoading(false);
                }
            }
        };
        void render();
        return () => {
            cancelled = true;
            if (pdfDocument)
                void pdfDocument.destroy();
        };
    }, [base64]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [loading && !error && (_jsx("div", { style: { color: '#565f89', fontSize: '13px', padding: '12px 0' }, children: "Rendering PDF\u2026" })), error && (_jsx("div", { style: { color: '#f7768e', fontSize: '13px', padding: '12px 0' }, children: error })), _jsx("canvas", { ref: canvasRef, style: {
                    maxWidth: '100%',
                    borderRadius: '6px',
                    background: '#fff',
                    display: error ? 'none' : 'block',
                } }), pageCount > 0 && !error && (_jsxs("div", { style: { color: '#565f89', fontSize: '12px' }, children: ["Page 1 of ", pageCount] }))] }));
}
