/**
 * Test FS helper: creates tmp directory structures and cleans up after tests.
 */
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Create a temporary test directory with a structured filesystem inside.
 * Returns the root path. Caller must clean up with cleanupTestDir().
 */
export async function createTestDir(structure?: Record<string, string | null>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dax-test-'));

  if (structure) {
    for (const [path, content] of Object.entries(structure)) {
      const fullPath = join(root, path);
      if (content === null) {
        // null = directory
        await mkdir(fullPath, { recursive: true });
      } else {
        // Ensure parent dir exists
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        await mkdir(parentDir, { recursive: true });
        await writeFile(fullPath, content);
      }
    }
  }

  return root;
}

/**
 * Create a symlink in the test directory.
 */
export async function createSymlink(target: string, linkPath: string): Promise<void> {
  await symlink(target, linkPath);
}

/**
 * Clean up a test directory.
 */
export async function cleanupTestDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}
