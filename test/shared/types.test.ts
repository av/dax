import { describe, it, expect } from 'vitest';
import {
  MAX_SCAN_DEPTH,
  GROUND_SIZE,
  APP_NAME,
  IPC_TIMEOUT_MS,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
} from '../../src/shared/constants';
import { getFileCategory } from '../../src/shared/file-types';

describe('Shared Constants', () => {
  it('has expected default values', () => {
    expect(MAX_SCAN_DEPTH).toBe(5);
    expect(GROUND_SIZE).toBe(500);
    expect(APP_NAME).toBe('DAX');
    expect(IPC_TIMEOUT_MS).toBe(10_000);
    expect(CAMERA_ZOOM_MIN).toBe(5);
    expect(CAMERA_ZOOM_MAX).toBe(200);
  });
});

describe('getFileCategory', () => {
  it('classifies code files', () => {
    expect(getFileCategory('ts')).toBe('code');
    expect(getFileCategory('tsx')).toBe('code');
    expect(getFileCategory('js')).toBe('code');
    expect(getFileCategory('py')).toBe('code');
    expect(getFileCategory('rs')).toBe('code');
  });

  it('classifies image files', () => {
    expect(getFileCategory('png')).toBe('image');
    expect(getFileCategory('jpg')).toBe('image');
    expect(getFileCategory('svg')).toBe('image');
  });

  it('classifies document files', () => {
    expect(getFileCategory('md')).toBe('document');
    expect(getFileCategory('txt')).toBe('document');
    expect(getFileCategory('pdf')).toBe('document');
  });

  it('classifies data files', () => {
    expect(getFileCategory('json')).toBe('data');
    expect(getFileCategory('yaml')).toBe('data');
    expect(getFileCategory('csv')).toBe('data');
  });

  it('returns unknown for unrecognized extensions', () => {
    expect(getFileCategory('xyz')).toBe('unknown');
    expect(getFileCategory('')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(getFileCategory('TS')).toBe('code');
    expect(getFileCategory('PNG')).toBe('image');
    expect(getFileCategory('JSON')).toBe('data');
  });
});
