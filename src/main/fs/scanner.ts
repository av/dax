/**
 * Recursive directory scanner.
 * Reads a directory tree up to a configurable depth limit.
 * Returns FileEntry[] for use by the renderer to create 3D meshes.
 *
 * Features:
 * - Respects depth limit (default: MAX_SCAN_DEPTH = 5)
 * - Skips .gitignore patterns (node_modules, .git, etc.)
 * - Handles symlinks gracefully (skips)
 * - Handles permission errors (skips, logs)
 * - Never duplicates filesystem data — only tracks paths
 */
import { readdir, stat, lstat, readFile } from 'fs/promises';
import { join, relative, extname, basename, dirname } from 'path';
import { MAX_SCAN_DEPTH } from '@shared/constants';
import { getFileCategory } from '@shared/file-types';
import type { FileEntry } from '@shared/file-types';

/** Default ignore patterns (applied even without .gitignore) */
const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.DS_Store',
  'Thumbs.db',
  '.idea',
  '.vscode',
  '__pycache__',
  '.cache',
  '.next',
  '.nuxt',
  'dist',
  'build',
  '.turbo',
]);

/**
 * Parse a .gitignore file and return a set of directory/file names to ignore.
 * This is a simplified parser — handles basic patterns (not full glob).
 */
function parseGitignore(content: string): Set<string> {
  const patterns = new Set<string>();
  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;
    // Strip trailing slashes for directory matching
    const pattern = line.replace(/\/+$/, '');
    // Skip negation patterns and complex globs for now
    if (pattern.startsWith('!') || pattern.includes('*') || pattern.includes('?')) continue;
    // Add simple name patterns
    if (!pattern.includes('/')) {
      patterns.add(pattern);
    }
  }
  return patterns;
}

/**
 * Load .gitignore patterns from the root directory.
 */
async function loadGitignorePatterns(rootDir: string): Promise<Set<string>> {
  try {
    const content = await readFile(join(rootDir, '.gitignore'), 'utf-8');
    return parseGitignore(content);
  } catch {
    // No .gitignore or not readable — that's fine
    return new Set();
  }
}

export interface ScanOptions {
  /** Maximum depth to recurse (default: MAX_SCAN_DEPTH) */
  maxDepth?: number;
  /** Additional patterns to ignore */
  extraIgnore?: string[];
}

/**
 * Scan a directory recursively and return FileEntry[] for all files and folders.
 *
 * @param rootDir - Absolute path to the root directory to scan
 * @param options - Optional scan configuration
 * @returns Array of FileEntry objects representing the directory tree
 */
export async function scanDirectory(
  rootDir: string,
  options: ScanOptions = {},
): Promise<FileEntry[]> {
  const maxDepth = options.maxDepth ?? MAX_SCAN_DEPTH;
  const entries: FileEntry[] = [];

  // Build ignore set from defaults + .gitignore + extra patterns
  const gitignorePatterns = await loadGitignorePatterns(rootDir);
  const ignoreSet = new Set([
    ...DEFAULT_IGNORE,
    ...gitignorePatterns,
    ...(options.extraIgnore ?? []),
  ]);

  async function walk(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    let dirents: string[];
    try {
      dirents = await readdir(dirPath);
    } catch {
      // Permission denied or other error — skip this directory
      return;
    }

    for (const name of dirents) {
      // Skip ignored names
      if (ignoreSet.has(name)) continue;
      // Skip hidden files/folders (starting with .) except .gitignore itself
      if (name.startsWith('.') && name !== '.gitignore') continue;

      const fullPath = join(dirPath, name);
      const relPath = relative(rootDir, fullPath);

      // Check for symlinks — skip them to avoid cycles
      let linkStat;
      try {
        linkStat = await lstat(fullPath);
      } catch {
        continue; // Can't stat, skip
      }

      if (linkStat.isSymbolicLink()) {
        continue; // Skip symlinks
      }

      const parentPath = dirname(relPath);
      const normalizedParent = parentPath === '.' ? null : parentPath;

      if (linkStat.isDirectory()) {
        const ext = '';
        const entry: FileEntry = {
          path: relPath,
          name,
          extension: ext,
          type: 'folder',
          category: 'unknown',
          parentPath: normalizedParent,
        };
        entries.push(entry);

        // Recurse into subdirectory
        await walk(fullPath, depth + 1);
      } else if (linkStat.isFile()) {
        const ext = extname(name).slice(1); // Remove the dot
        const entry: FileEntry = {
          path: relPath,
          name,
          extension: ext,
          type: 'file',
          category: getFileCategory(ext),
          parentPath: normalizedParent,
        };
        entries.push(entry);
      }
      // Skip other types (block devices, FIFOs, etc.)
    }
  }

  await walk(rootDir, 0);
  return entries;
}
