/**
 * FS service barrel — re-exports filesystem service.
 */
export {
  scanDirectory,
  startWatcher,
  stopWatcher,
  onWatcherEvents,
  validateFileName,
  createFile,
  renameFile,
  moveFile,
  deleteFile,
  openFile,
  getFileStat,
  readTextFile,
  getFolderSize,
  copyToClipboard,
} from './fs-service';
