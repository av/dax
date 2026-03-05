/**
 * FS module barrel — re-exports scanner, watcher, validators, operations.
 */
export { scanDirectory } from './scanner';
export type { ScanOptions } from './scanner';
export { startWatcher, stopWatcher, isWatching } from './watcher';
export { validateFilename, validatePathTraversal, validatePath } from './validators';
export type { ValidateResult } from './validators';
export {
  createFileOrFolder,
  renameFileOrFolder,
  moveFileOrFolder,
  deleteFileOrFolder,
  openFile,
  getFileStat,
  readTextFile,
  calculateFolderSize,
  hasPendingOperation,
  clearPendingOperation,
} from './operations';
