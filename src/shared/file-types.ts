export type FileCategory =
  | 'code'
  | 'image'
  | 'document'
  | 'data'
  | 'archive'
  | 'media'
  | 'binary'
  | 'unknown';

export interface FileEntry {
  /** Relative path from workspace root (e.g. 'src/index.ts') */
  path: string;
  /** Filename only (e.g. 'index.ts') */
  name: string;
  /** File extension without dot (e.g. 'ts'), empty string for extensionless */
  extension: string;
  /** 'file' or 'folder' */
  type: 'file' | 'folder';
  /** Categorization derived from extension */
  category: FileCategory;
  /** Relative path of parent folder, null for root-level items */
  parentPath: string | null;
}

export interface FileStat {
  path: string;
  name: string;
  extension: string;
  type: 'file' | 'folder';
  sizeBytes: number;
  sizeHuman: string;
  createdAt: number;
  modifiedAt: number;
  permissions: string;
  childCount?: number;
}

export interface SearchResult {
  path: string;
  name: string;
  lineNumber?: number;
  linePreview?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Map of file extensions to categories */
const EXTENSION_MAP: Record<string, FileCategory> = {
  // Code
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', py: 'code', rs: 'code',
  go: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code', hpp: 'code',
  cs: 'code', rb: 'code', php: 'code', swift: 'code', kt: 'code', scala: 'code',
  lua: 'code', sh: 'code', bash: 'code', zsh: 'code', fish: 'code',
  html: 'code', css: 'code', scss: 'code', less: 'code', vue: 'code', svelte: 'code',
  // Images
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image',
  webp: 'image', ico: 'image', bmp: 'image', tiff: 'image',
  // Documents
  pdf: 'document', doc: 'document', docx: 'document', txt: 'document',
  md: 'document', rst: 'document', rtf: 'document', odt: 'document',
  // Data
  json: 'data', csv: 'data', xml: 'data', yaml: 'data', yml: 'data',
  toml: 'data', ini: 'data', env: 'data',
  // Archives
  zip: 'archive', tar: 'archive', gz: 'archive', bz2: 'archive',
  xz: 'archive', rar: 'archive', '7z': 'archive',
  // Media
  mp3: 'media', mp4: 'media', wav: 'media', ogg: 'media', flac: 'media',
  avi: 'media', mkv: 'media', mov: 'media', webm: 'media',
  // Binary
  exe: 'binary', bin: 'binary', dll: 'binary', so: 'binary', dylib: 'binary',
  wasm: 'binary', o: 'binary',
};

export function getFileCategory(extension: string): FileCategory {
  return EXTENSION_MAP[extension.toLowerCase()] ?? 'unknown';
}
