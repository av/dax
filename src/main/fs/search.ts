/**
 * Content search via child process (ripgrep or grep fallback).
 *
 * Spawns a child process to search file contents. Uses ripgrep if available,
 * otherwise falls back to grep.
 *
 * Output parsing extracts: file path, line number, line content.
 * Results are limited to 100 matches.
 */
import { spawn } from 'child_process';
import { join } from 'path';
import { access, constants } from 'fs/promises';
import type { SearchResult } from '../../shared/file-types';

const MAX_RESULTS = 100;

/**
 * Attempt to find the ripgrep binary.
 * Checks:
 * 1. Bundled binary in resources/ (packaged app)
 * 2. System-installed `rg` (dev mode)
 * Falls back to `grep` if neither found.
 */
async function findSearchBinary(): Promise<{ bin: string; isRipgrep: boolean }> {
  // Try bundled ripgrep paths
  const platform = process.platform;
  const arch = process.arch;

  let rgName = 'rg';
  if (platform === 'linux' && arch === 'x64') rgName = 'rg-linux-x64';
  else if (platform === 'darwin' && arch === 'arm64') rgName = 'rg-darwin-arm64';
  else if (platform === 'darwin' && arch === 'x64') rgName = 'rg-darwin-x64';
  else if (platform === 'win32') rgName = 'rg-win32-x64.exe';

  // Check bundled binary
  const bundledPaths = [
    join(__dirname, '..', '..', 'resources', 'ripgrep', rgName),
    join(process.resourcesPath ?? '', 'ripgrep', rgName),
  ];

  for (const p of bundledPaths) {
    try {
      await access(p, constants.X_OK);
      return { bin: p, isRipgrep: true };
    } catch {
      // Not found, continue
    }
  }

  // Try system rg
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('rg', ['--version'], { stdio: 'pipe' });
      proc.on('close', (code) => (code === 0 ? resolve() : reject()));
      proc.on('error', reject);
    });
    return { bin: 'rg', isRipgrep: true };
  } catch {
    // Fall through to grep
  }

  // Fallback to grep
  return { bin: 'grep', isRipgrep: false };
}

/**
 * Search file contents using ripgrep or grep.
 *
 * @param query - Search string
 * @param dir - Directory to search in
 * @returns Array of SearchResult matches (max 100)
 */
export async function searchContent(
  query: string,
  dir: string,
): Promise<SearchResult[]> {
  if (!query || !dir) return [];

  const { bin, isRipgrep } = await findSearchBinary();

  return new Promise<SearchResult[]>((resolve) => {
    const results: SearchResult[] = [];

    let args: string[];
    if (isRipgrep) {
      args = [
        '--no-heading',
        '--line-number',
        '--max-count', String(MAX_RESULTS),
        '--max-filesize', '1M',  // Skip large files
        '--color', 'never',
        '--fixed-strings',       // Treat query as literal (not regex)
        query,
        dir,
      ];
    } else {
      args = [
        '-r',     // recursive
        '-n',     // line numbers
        '-l',     // (won't use -l, we want line numbers)
        '--include=*',  // all files
        '-F',     // fixed strings
        query,
        dir,
      ];
      // For grep, use -rn (recursive with line numbers) without -l
      args = ['-rnF', '--color=never', query, dir];
    }

    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });

    let output = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf-8');
    });

    proc.stderr.on('data', () => {
      // Ignore stderr (permission errors, binary file warnings)
    });

    proc.on('close', () => {
      const lines = output.split('\n').filter(Boolean);

      for (const line of lines) {
        if (results.length >= MAX_RESULTS) break;

        const result = parseLine(line, dir, isRipgrep);
        if (result) {
          results.push(result);
        }
      }

      resolve(results);
    });

    proc.on('error', () => {
      // If spawn fails entirely, return empty results
      resolve([]);
    });
  });
}

/**
 * Parse a single output line from ripgrep or grep.
 *
 * ripgrep format: /absolute/path:lineNumber:lineContent
 * grep format: /absolute/path:lineNumber:lineContent
 */
function parseLine(
  line: string,
  dir: string,
  _isRipgrep: boolean,
): SearchResult | null {
  // Format: filepath:lineNumber:lineContent
  // The filepath may contain colons (Windows), so parse carefully
  // We know the dir, so we can strip it

  // Find the first colon after the dir prefix
  let startIdx = 0;
  if (line.startsWith(dir)) {
    startIdx = dir.length;
    // Skip leading separator
    if (line[startIdx] === '/' || line[startIdx] === '\\') {
      startIdx++;
    }
  }

  // Find the colon that separates path from line number
  const rest = line.slice(startIdx);
  const firstColon = rest.indexOf(':');
  if (firstColon === -1) return null;

  const pathPart = rest.slice(0, firstColon);
  const afterPath = rest.slice(firstColon + 1);

  // Parse line number
  const secondColon = afterPath.indexOf(':');
  if (secondColon === -1) return null;

  const lineNumStr = afterPath.slice(0, secondColon);
  const lineContent = afterPath.slice(secondColon + 1);

  const lineNumber = parseInt(lineNumStr, 10);
  if (isNaN(lineNumber)) return null;

  // Extract name from path
  const name = pathPart.split('/').pop() ?? pathPart;

  return {
    path: pathPart,
    name,
    lineNumber,
    linePreview: lineContent.trim().slice(0, 200), // Limit preview length
  };
}

/**
 * Search by filename (in-memory filtering of the file list).
 * Faster than content search — just string matching.
 *
 * @param query - Search string
 * @param entries - List of all file entries to search through
 * @returns Array of matching SearchResult
 */
export function searchByName(
  query: string,
  entries: Array<{ path: string; name: string }>,
): SearchResult[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;

    if (entry.name.toLowerCase().includes(lowerQuery) ||
        entry.path.toLowerCase().includes(lowerQuery)) {
      results.push({
        path: entry.path,
        name: entry.name,
      });
    }
  }

  return results;
}
