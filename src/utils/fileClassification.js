// ── File Classification Utilities ───────────────────────
const CODE_EXTENSIONS = new Set([
    'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'c', 'cpp', 'cc', 'cxx',
    'h', 'hpp', 'java', 'rb', 'css', 'scss', 'sass', 'less', 'html', 'htm',
    'vue', 'svelte', 'swift', 'kt', 'kts', 'scala', 'php', 'sh', 'bash',
    'zsh', 'fish', 'lua', 'r', 'pl', 'pm', 'ex', 'exs', 'erl', 'hs', 'ml',
    'elm', 'clj', 'dart', 'zig', 'nim', 'v', 'asm', 's',
]);
const IMAGE_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif',
    'avif', 'heic', 'heif', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav',
    'flac', 'ogg', 'aac', 'm4a',
]);
const ARCHIVE_EXTENSIONS = new Set([
    'zip', 'tar', 'gz', 'bz2', 'xz', 'rar', '7z', 'tgz', 'zst', 'lz4',
]);
const DOCUMENT_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages', 'tex', 'epub',
]);
const SPREADSHEET_EXTENSIONS = new Set([
    'csv', 'xlsx', 'xls', 'ods', 'tsv',
]);
const DATA_EXTENSIONS = new Set([
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
    'graphql', 'gql', 'proto', 'sql',
]);
/** Determine 3D shape from file extension */
export function getFileShape(extension) {
    if (!extension)
        return 'box';
    const ext = extension.replace(/^\./, '').toLowerCase();
    if (CODE_EXTENSIONS.has(ext))
        return 'cylinder';
    if (IMAGE_EXTENSIONS.has(ext))
        return 'sphere';
    if (ARCHIVE_EXTENSIONS.has(ext))
        return 'torus';
    // Documents, spreadsheets, data, and unknown all get box
    return 'box';
}
/** Color hex string by extension group */
export function getFileColor(extension) {
    if (!extension)
        return '#888888';
    const ext = extension.replace(/^\./, '').toLowerCase();
    if (CODE_EXTENSIONS.has(ext))
        return '#4A90D9'; // Blue
    if (SPREADSHEET_EXTENSIONS.has(ext))
        return '#4AD97A'; // Green
    if (DOCUMENT_EXTENSIONS.has(ext))
        return '#D9944A'; // Orange
    if (IMAGE_EXTENSIONS.has(ext))
        return '#9A4AD9'; // Purple
    if (ARCHIVE_EXTENSIONS.has(ext))
        return '#D94A4A'; // Red
    if (DATA_EXTENSIONS.has(ext))
        return '#4AD9D9'; // Cyan
    return '#888888'; // Gray
}
/** Logarithmic scale for file size → object scale, clamped [0.3, 2.0] */
export function getFileScale(sizeBytes) {
    if (sizeBytes <= 0)
        return 0.3;
    // log10 of bytes: 0B→0.3, ~10B→0.3, 1KB→~0.6, 1MB→~1.2, 100MB→~1.6, 1GB→~1.8
    const log = Math.log10(Math.max(sizeBytes, 1));
    // Map log range [0, 10] → [0.3, 2.0]
    const t = log / 10;
    const scale = 0.3 + t * 1.7;
    return Math.max(0.3, Math.min(2.0, scale));
}
/** Human-readable file size */
export function formatFileSize(bytes) {
    if (bytes < 0)
        return '0 B';
    if (bytes === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
/** Format a timestamp (ms since epoch) into a readable date string */
export function formatModifiedDate(timestamp) {
    if (!timestamp)
        return '';
    return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
