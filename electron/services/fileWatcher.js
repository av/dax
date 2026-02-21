import { watch } from 'chokidar';
import fs from 'fs/promises';
import nodePath from 'path';
import crypto from 'crypto';
function hashPath(absolutePath) {
    return crypto.createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
}
export class FileWatcherService {
    watcher = null;
    debounceTimers = new Map();
    window = null;
    watch(rootPath, window) {
        this.stop();
        this.window = window;
        this.watcher = watch(rootPath, {
            ignoreInitial: true,
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/dist-electron/**',
                '**/dist-renderer/**',
            ],
            persistent: true,
        });
        const sendEventWithStat = (type) => (filePath) => {
            fs.stat(filePath)
                .then((stat) => {
                const name = nodePath.basename(filePath);
                const isDirectory = stat.isDirectory();
                this.debouncedSend({
                    type,
                    path: filePath,
                    fileInfo: {
                        id: hashPath(filePath),
                        name,
                        extension: isDirectory ? null : nodePath.extname(name) || null,
                        sizeBytes: stat.size,
                        modifiedAt: stat.mtimeMs,
                    },
                });
            })
                .catch(() => {
                // File may have been removed between event firing and stat
                this.debouncedSend({ type, path: filePath });
            });
        };
        const sendEvent = (type) => (filePath) => {
            this.debouncedSend({ type, path: filePath });
        };
        this.watcher.on('add', sendEventWithStat('add'));
        this.watcher.on('change', sendEventWithStat('change'));
        this.watcher.on('unlink', sendEvent('unlink'));
        this.watcher.on('addDir', sendEventWithStat('addDir'));
        this.watcher.on('unlinkDir', sendEvent('unlinkDir'));
    }
    stop() {
        if (this.watcher) {
            void this.watcher.close();
            this.watcher = null;
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.window = null;
    }
    debouncedSend(event) {
        const key = `${event.type}:${event.path}`;
        const existing = this.debounceTimers.get(key);
        if (existing !== undefined) {
            clearTimeout(existing);
        }
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.send('fs:fileChange', event);
            }
        }, 300);
        this.debounceTimers.set(key, timer);
    }
}
