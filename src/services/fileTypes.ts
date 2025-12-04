import type { FileCategory } from '@/types';

export interface FileTypeInfo {
  category: FileCategory;
  color: number;
  icon: string;
  isEditable: boolean;
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
  // Text files
  txt: { category: 'text', color: 0x4a90d9, icon: 'file-text', isEditable: true },
  md: { category: 'text', color: 0x4a90d9, icon: 'file-text', isEditable: true },
  markdown: { category: 'text', color: 0x4a90d9, icon: 'file-text', isEditable: true },
  json: { category: 'text', color: 0xf5c542, icon: 'file-json', isEditable: true },
  xml: { category: 'text', color: 0xe37933, icon: 'file-code', isEditable: true },
  yaml: { category: 'text', color: 0xcb171e, icon: 'file-code', isEditable: true },
  yml: { category: 'text', color: 0xcb171e, icon: 'file-code', isEditable: true },
  toml: { category: 'text', color: 0x9c4221, icon: 'file-code', isEditable: true },
  ini: { category: 'text', color: 0x6b7280, icon: 'file-code', isEditable: true },
  cfg: { category: 'text', color: 0x6b7280, icon: 'file-code', isEditable: true },
  conf: { category: 'text', color: 0x6b7280, icon: 'file-code', isEditable: true },
  log: { category: 'text', color: 0x6b7280, icon: 'file-text', isEditable: true },

  // Code files
  ts: { category: 'code', color: 0x3178c6, icon: 'file-code', isEditable: true },
  tsx: { category: 'code', color: 0x3178c6, icon: 'file-code', isEditable: true },
  js: { category: 'code', color: 0xf7df1e, icon: 'file-code', isEditable: true },
  jsx: { category: 'code', color: 0x61dafb, icon: 'file-code', isEditable: true },
  rs: { category: 'code', color: 0xdea584, icon: 'file-code', isEditable: true },
  py: { category: 'code', color: 0x3776ab, icon: 'file-code', isEditable: true },
  go: { category: 'code', color: 0x00add8, icon: 'file-code', isEditable: true },
  java: { category: 'code', color: 0xb07219, icon: 'file-code', isEditable: true },
  c: { category: 'code', color: 0x555555, icon: 'file-code', isEditable: true },
  cpp: { category: 'code', color: 0xf34b7d, icon: 'file-code', isEditable: true },
  h: { category: 'code', color: 0xa97bff, icon: 'file-code', isEditable: true },
  hpp: { category: 'code', color: 0xa97bff, icon: 'file-code', isEditable: true },
  cs: { category: 'code', color: 0x178600, icon: 'file-code', isEditable: true },
  rb: { category: 'code', color: 0x701516, icon: 'file-code', isEditable: true },
  php: { category: 'code', color: 0x4f5d95, icon: 'file-code', isEditable: true },
  swift: { category: 'code', color: 0xffac45, icon: 'file-code', isEditable: true },
  kt: { category: 'code', color: 0xa97bff, icon: 'file-code', isEditable: true },
  scala: { category: 'code', color: 0xdc322f, icon: 'file-code', isEditable: true },
  sh: { category: 'code', color: 0x89e051, icon: 'file-code', isEditable: true },
  bash: { category: 'code', color: 0x89e051, icon: 'file-code', isEditable: true },
  zsh: { category: 'code', color: 0x89e051, icon: 'file-code', isEditable: true },
  fish: { category: 'code', color: 0x89e051, icon: 'file-code', isEditable: true },
  ps1: { category: 'code', color: 0x012456, icon: 'file-code', isEditable: true },
  vue: { category: 'code', color: 0x41b883, icon: 'file-code', isEditable: true },
  svelte: { category: 'code', color: 0xff3e00, icon: 'file-code', isEditable: true },
  html: { category: 'code', color: 0xe34c26, icon: 'file-code', isEditable: true },
  css: { category: 'code', color: 0x563d7c, icon: 'file-code', isEditable: true },
  scss: { category: 'code', color: 0xc6538c, icon: 'file-code', isEditable: true },
  sass: { category: 'code', color: 0xc6538c, icon: 'file-code', isEditable: true },
  less: { category: 'code', color: 0x1d365d, icon: 'file-code', isEditable: true },

  // Image files
  png: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  jpg: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  jpeg: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  gif: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  webp: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  svg: { category: 'image', color: 0xffb13b, icon: 'file-image', isEditable: true },
  bmp: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  ico: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  tiff: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  psd: { category: 'image', color: 0x31a8ff, icon: 'file-image', isEditable: false },
  ai: { category: 'image', color: 0xff9a00, icon: 'file-image', isEditable: false },
  raw: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  heic: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },
  avif: { category: 'image', color: 0xff6b6b, icon: 'file-image', isEditable: false },

  // Document files
  pdf: { category: 'document', color: 0xf40f02, icon: 'file-pdf', isEditable: false },
  doc: { category: 'document', color: 0x2b579a, icon: 'file-doc', isEditable: false },
  docx: { category: 'document', color: 0x2b579a, icon: 'file-doc', isEditable: false },
  xls: { category: 'document', color: 0x217346, icon: 'file-spreadsheet', isEditable: false },
  xlsx: { category: 'document', color: 0x217346, icon: 'file-spreadsheet', isEditable: false },
  ppt: { category: 'document', color: 0xd24726, icon: 'file-presentation', isEditable: false },
  pptx: { category: 'document', color: 0xd24726, icon: 'file-presentation', isEditable: false },
  odt: { category: 'document', color: 0x2b579a, icon: 'file-doc', isEditable: false },
  ods: { category: 'document', color: 0x217346, icon: 'file-spreadsheet', isEditable: false },
  odp: { category: 'document', color: 0xd24726, icon: 'file-presentation', isEditable: false },
  rtf: { category: 'document', color: 0x2b579a, icon: 'file-doc', isEditable: false },
  tex: { category: 'document', color: 0x3d6117, icon: 'file-doc', isEditable: true },
  epub: { category: 'document', color: 0x83b81a, icon: 'file-doc', isEditable: false },

  // Data files
  csv: { category: 'data', color: 0x217346, icon: 'file-data', isEditable: true },
  tsv: { category: 'data', color: 0x217346, icon: 'file-data', isEditable: true },
  parquet: { category: 'data', color: 0x4a8f51, icon: 'file-data', isEditable: false },
  sql: { category: 'data', color: 0xe38c00, icon: 'file-data', isEditable: true },
  db: { category: 'data', color: 0x003b57, icon: 'file-data', isEditable: false },
  sqlite: { category: 'data', color: 0x003b57, icon: 'file-data', isEditable: false },
  mdb: { category: 'data', color: 0xa4373a, icon: 'file-data', isEditable: false },
  accdb: { category: 'data', color: 0xa4373a, icon: 'file-data', isEditable: false },
  ndjson: { category: 'data', color: 0xf5c542, icon: 'file-data', isEditable: true },
  jsonl: { category: 'data', color: 0xf5c542, icon: 'file-data', isEditable: true },

  // Archive files
  zip: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  tar: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  gz: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  bz2: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  xz: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  '7z': { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  rar: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  tgz: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },
  tbz2: { category: 'archive', color: 0xf9a03f, icon: 'file-archive', isEditable: false },

  // Media files
  mp3: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  wav: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  flac: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  aac: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  ogg: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  wma: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  m4a: { category: 'media', color: 0x1db954, icon: 'file-audio', isEditable: false },
  mp4: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  mkv: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  avi: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  mov: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  wmv: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  flv: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  webm: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
  m4v: { category: 'media', color: 0xe50914, icon: 'file-video', isEditable: false },
};

const DEFAULT_TYPE_INFO: FileTypeInfo = {
  category: 'unknown',
  color: 0x6b7280,
  icon: 'file',
  isEditable: false,
};

/**
 * Get file type information based on file extension
 */
export function getFileTypeInfo(extension: string): FileTypeInfo {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return FILE_TYPE_MAP[ext] ?? DEFAULT_TYPE_INFO;
}

/**
 * Get file category from extension
 */
export function getFileCategory(extension: string): FileCategory {
  return getFileTypeInfo(extension).category;
}

/**
 * Get color for file type (for 3D visualization)
 */
export function getFileColor(extension: string): number {
  return getFileTypeInfo(extension).color;
}

/**
 * Check if file is editable based on extension
 */
export function isFileEditable(extension: string): boolean {
  return getFileTypeInfo(extension).isEditable;
}

/**
 * Get size multiplier based on file size for 3D representation
 */
export function getFileSizeMultiplier(sizeBytes: number): number {
  // Logarithmic scale: 1KB = 1x, 1MB = 1.5x, 100MB = 2x
  const kb = sizeBytes / 1024;
  if (kb <= 1) return 0.8;
  if (kb <= 10) return 0.9;
  if (kb <= 100) return 1.0;
  if (kb <= 1024) return 1.1;
  if (kb <= 10240) return 1.2;
  if (kb <= 102400) return 1.5;
  return 2.0;
}

/**
 * Get geometry type for file category
 */
export type GeometryType = 'box' | 'cylinder' | 'octahedron' | 'sphere' | 'dodecahedron' | 'tetrahedron' | 'icosahedron';

export function getGeometryType(category: FileCategory): GeometryType {
  switch (category) {
    case 'text':
      return 'box';
    case 'code':
      return 'octahedron';
    case 'image':
      return 'cylinder';
    case 'document':
      return 'box';
    case 'data':
      return 'icosahedron';
    case 'archive':
      return 'dodecahedron';
    case 'media':
      return 'sphere';
    default:
      return 'tetrahedron';
  }
}
