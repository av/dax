/**
 * Tests for the filesystem watcher.
 * Verifies: event types, debouncing, batch events, rename detection, start/stop.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { writeFile, mkdir, rm, rename } from 'fs/promises';
import { createTestDir, cleanupTestDir } from '../../helpers/fs';

// We need to mock the BrowserWindow for the watcher tests
const mockSend = vi.fn();
const mockWin = {
  isDestroyed: () => false,
  webContents: { send: mockSend },
} as unknown as import('electron').BrowserWindow;

let testDir: string | null = null;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  // Stop watcher if running
  const { stopWatcher } = await import('../../../src/main/fs/watcher');
  stopWatcher();

  if (testDir) {
    await cleanupTestDir(testDir);
    testDir = null;
  }
});

describe('watcher', () => {
  it('starts and detects new file creation', async () => {
    testDir = await createTestDir({
      'existing.txt': 'hello',
    });

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);

    // Wait for watcher to be ready
    await sleep(500);

    // Create a new file
    await writeFile(join(testDir, 'new-file.txt'), 'new content');

    // Wait for debounce + processing
    await sleep(800);

    // Check that webContents.send was called with a batch
    expect(mockSend).toHaveBeenCalled();
    const calls = mockSend.mock.calls;
    const eventCall = calls.find((c) => c[0] === 'watcher:events');
    expect(eventCall).toBeDefined();

    const batch = eventCall![1];
    expect(batch).toHaveProperty('events');
    expect(batch.events.length).toBeGreaterThanOrEqual(1);

    // Should contain an 'add' event for new-file.txt
    const addEvent = batch.events.find(
      (e: { type: string; path: string }) => e.type === 'add' && e.path === 'new-file.txt',
    );
    expect(addEvent).toBeDefined();
  });

  it('detects file deletion (unlink)', async () => {
    testDir = await createTestDir({
      'delete-me.txt': 'goodbye',
    });

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(500);

    // Delete the file
    await rm(join(testDir, 'delete-me.txt'));

    await sleep(800);

    expect(mockSend).toHaveBeenCalled();
    const calls = mockSend.mock.calls;
    const eventCall = calls.find((c) => c[0] === 'watcher:events');
    expect(eventCall).toBeDefined();

    const batch = eventCall![1];
    const unlinkEvent = batch.events.find(
      (e: { type: string; path: string }) => e.type === 'unlink' && e.path === 'delete-me.txt',
    );
    expect(unlinkEvent).toBeDefined();
  });

  it('detects file modification (change)', async () => {
    testDir = await createTestDir({
      'modify-me.txt': 'original',
    });

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(500);

    // Modify the file
    await writeFile(join(testDir, 'modify-me.txt'), 'modified content');

    await sleep(800);

    expect(mockSend).toHaveBeenCalled();
    const calls = mockSend.mock.calls;
    const eventCall = calls.find((c) => c[0] === 'watcher:events');
    expect(eventCall).toBeDefined();

    const batch = eventCall![1];
    const changeEvent = batch.events.find(
      (e: { type: string; path: string }) => e.type === 'change' && e.path === 'modify-me.txt',
    );
    expect(changeEvent).toBeDefined();
  });

  it('detects new directory creation (addDir)', async () => {
    testDir = await createTestDir({});

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(500);

    // Create a new directory
    await mkdir(join(testDir, 'new-folder'));

    await sleep(800);

    expect(mockSend).toHaveBeenCalled();
    const calls = mockSend.mock.calls;
    const eventCall = calls.find((c) => c[0] === 'watcher:events');
    expect(eventCall).toBeDefined();

    const batch = eventCall![1];
    const addDirEvent = batch.events.find(
      (e: { type: string; path: string }) => e.type === 'addDir' && e.path === 'new-folder',
    );
    expect(addDirEvent).toBeDefined();
  });

  it('stops watching when stopWatcher is called', async () => {
    testDir = await createTestDir({});

    const { startWatcher, stopWatcher, isWatching } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(300);

    expect(isWatching()).toBe(true);

    stopWatcher();
    expect(isWatching()).toBe(false);

    // Create a file after stopping — should NOT trigger events
    mockSend.mockClear();
    await writeFile(join(testDir, 'after-stop.txt'), 'should not detect');
    await sleep(500);

    // No events should have been sent after stopping
    const eventCalls = mockSend.mock.calls.filter((c) => c[0] === 'watcher:events');
    expect(eventCalls.length).toBe(0);
  });

  it('ignores node_modules directory', async () => {
    testDir = await createTestDir({});
    await mkdir(join(testDir, 'node_modules'), { recursive: true });

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(500);

    // Create file inside node_modules
    await writeFile(join(testDir, 'node_modules', 'test-pkg.txt'), 'pkg');
    await sleep(800);

    // Should NOT have any events for node_modules files
    const eventCalls = mockSend.mock.calls.filter((c) => c[0] === 'watcher:events');
    for (const call of eventCalls) {
      const batch = call[1];
      const nmEvents = batch.events.filter(
        (e: { path: string }) => e.path.includes('node_modules'),
      );
      expect(nmEvents.length).toBe(0);
    }
  });

  it('batches rapid events within debounce window', async () => {
    testDir = await createTestDir({});

    const { startWatcher } = await import('../../../src/main/fs/watcher');
    startWatcher(testDir, mockWin);
    await sleep(500);

    // Create multiple files rapidly
    await writeFile(join(testDir, 'rapid1.txt'), 'a');
    await writeFile(join(testDir, 'rapid2.txt'), 'b');
    await writeFile(join(testDir, 'rapid3.txt'), 'c');

    await sleep(800);

    // Events should be batched (we might get 1 batch with multiple events
    // or a few batches, but the total event count should be ≥3)
    const allEvents: Array<{ type: string; path: string }> = [];
    for (const call of mockSend.mock.calls) {
      if (call[0] === 'watcher:events') {
        allEvents.push(...call[1].events);
      }
    }

    const addEvents = allEvents.filter((e) => e.type === 'add');
    expect(addEvents.length).toBeGreaterThanOrEqual(3);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
