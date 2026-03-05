/**
 * Path and filename validation utilities.
 * Checks for invalid characters, path traversal, and length limits.
 */

/** Characters forbidden in filenames (cross-platform) */
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

/** Reserved names on Windows */
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;

/** Maximum filename length (most filesystems) */
const MAX_NAME_LENGTH = 255;

/** Maximum path length */
const MAX_PATH_LENGTH = 4096;

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a filename (without path separators).
 */
export function validateFilename(name: string): ValidateResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Filename cannot be empty' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Filename exceeds ${MAX_NAME_LENGTH} character limit` };
  }

  if (INVALID_CHARS.test(name)) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }

  if (RESERVED_NAMES.test(name)) {
    return { valid: false, error: `"${name}" is a reserved name` };
  }

  if (name === '.' || name === '..') {
    return { valid: false, error: 'Filename cannot be "." or ".."' };
  }

  if (name.startsWith(' ') || name.endsWith(' ') || name.endsWith('.')) {
    return { valid: false, error: 'Filename cannot start/end with spaces or end with a dot' };
  }

  return { valid: true };
}

/**
 * Validate that a path doesn't escape the workspace root via traversal.
 */
export function validatePathTraversal(rootDir: string, targetPath: string): ValidateResult {
  // Normalize both paths for comparison
  const { resolve } = require('path') as typeof import('path');
  const resolved = resolve(rootDir, targetPath);

  if (!resolved.startsWith(resolve(rootDir))) {
    return { valid: false, error: 'Path traversal detected: path escapes workspace root' };
  }

  return { valid: true };
}

/**
 * Validate a full path.
 */
export function validatePath(filePath: string): ValidateResult {
  if (!filePath || filePath.trim().length === 0) {
    return { valid: false, error: 'Path cannot be empty' };
  }

  if (filePath.length > MAX_PATH_LENGTH) {
    return { valid: false, error: `Path exceeds ${MAX_PATH_LENGTH} character limit` };
  }

  return { valid: true };
}
