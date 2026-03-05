/**
 * Tests for filename and path validators.
 */
import { describe, it, expect } from 'vitest';
import { validateFilename, validatePath, validatePathTraversal } from '../../../src/main/fs/validators';

describe('validateFilename', () => {
  it('accepts valid filenames', () => {
    expect(validateFilename('hello.txt')).toEqual({ valid: true });
    expect(validateFilename('my-file_v2.ts')).toEqual({ valid: true });
    expect(validateFilename('CamelCase.tsx')).toEqual({ valid: true });
    expect(validateFilename('noext')).toEqual({ valid: true });
    expect(validateFilename('.gitignore')).toEqual({ valid: true });
  });

  it('rejects empty filenames', () => {
    const result = validateFilename('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects whitespace-only filenames', () => {
    const result = validateFilename('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects filenames with invalid characters', () => {
    expect(validateFilename('file<name>').valid).toBe(false);
    expect(validateFilename('file:name').valid).toBe(false);
    expect(validateFilename('file"name').valid).toBe(false);
    expect(validateFilename('file|name').valid).toBe(false);
    expect(validateFilename('file?name').valid).toBe(false);
    expect(validateFilename('file*name').valid).toBe(false);
    expect(validateFilename('file/name').valid).toBe(false);
    expect(validateFilename('file\\name').valid).toBe(false);
  });

  it('rejects reserved names (Windows)', () => {
    expect(validateFilename('CON').valid).toBe(false);
    expect(validateFilename('PRN').valid).toBe(false);
    expect(validateFilename('AUX').valid).toBe(false);
    expect(validateFilename('NUL').valid).toBe(false);
    expect(validateFilename('COM1').valid).toBe(false);
    expect(validateFilename('LPT9').valid).toBe(false);
    expect(validateFilename('con').valid).toBe(false);   // case insensitive
    expect(validateFilename('CON.txt').valid).toBe(false); // with extension
  });

  it('rejects . and ..', () => {
    expect(validateFilename('.').valid).toBe(false);
    expect(validateFilename('..').valid).toBe(false);
  });

  it('rejects filenames starting/ending with spaces', () => {
    expect(validateFilename(' leading').valid).toBe(false);
    expect(validateFilename('trailing ').valid).toBe(false);
  });

  it('rejects filenames ending with a dot', () => {
    expect(validateFilename('file.').valid).toBe(false);
  });

  it('rejects filenames exceeding 255 characters', () => {
    const longName = 'a'.repeat(256);
    expect(validateFilename(longName).valid).toBe(false);
  });

  it('accepts filenames at exactly 255 characters', () => {
    const maxName = 'a'.repeat(255);
    expect(validateFilename(maxName).valid).toBe(true);
  });
});

describe('validatePath', () => {
  it('accepts valid paths', () => {
    expect(validatePath('/home/user/file.txt').valid).toBe(true);
    expect(validatePath('relative/path/file.ts').valid).toBe(true);
  });

  it('rejects empty paths', () => {
    expect(validatePath('').valid).toBe(false);
    expect(validatePath('   ').valid).toBe(false);
  });

  it('rejects paths exceeding 4096 characters', () => {
    const longPath = '/' + 'a'.repeat(4096);
    expect(validatePath(longPath).valid).toBe(false);
  });
});

describe('validatePathTraversal', () => {
  it('accepts paths within workspace root', () => {
    expect(validatePathTraversal('/workspace', 'src/file.ts').valid).toBe(true);
    expect(validatePathTraversal('/workspace', 'deep/nested/path').valid).toBe(true);
  });

  it('rejects paths that escape workspace root', () => {
    expect(validatePathTraversal('/workspace', '../outside').valid).toBe(false);
    expect(validatePathTraversal('/workspace', '../../etc/passwd').valid).toBe(false);
  });

  it('accepts paths that look like traversal but resolve inside root', () => {
    expect(validatePathTraversal('/workspace', 'src/../src/file.ts').valid).toBe(true);
  });
});
