+ Ability to drag files with a mouse
  - File must physically interact with other files
  - Directory fence should be an actual physical boundary file objects cannot be pushed through by other files
  - When dragging with a mouse, file can be dragged between directories and dropped into another directory to move it on the actual filesystem
+ Directory boundaries should not be crossable by files unless those are being dragged by a user or an agent
+ Camera should change its angle depending on the zoom level:
  - When zoomed out - looks more from the top down
  - When zoomed in - looks more from the side
  - When moving - camera should slightly tilt in the direction of movement

+ Some folders lack borders when drawn, I've seen layour changing after some of the reload
  - Borders must be drawn for all folders, and they should be consistent across reloads
  - Layout computation should be deterministic and not change across reloads

+ There shouldn't be any height difference between floors of different directories, they should all be on the same level, and the directory fence should be the only thing separating them vertically, files should not be able to get "under" the directory fence

- [Renderer] Uncaught Error: recursive use of an object detected which would lead to unsafe aliasing in rust (http://localhost:5173/node_modules/.vite/deps/chunk-JIJQ3IOI.js?v=6e8728b8:2632)

---


- Directory floor should have a white rectangle drawn on it to indicate where files can be placed

- Directories should be resizable by dragging the directory fence corner with a mouse



- Respect .gitignore when loading workspace

- Tools
  - Reset layout - recompute the layout and reset to default
  - Magnet - attracts nearby files
  - Looking glass


- When trying to open ~/.cache folder with a lot of files:
```
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/everlier/.cache/chrome-devtools-mcp/chrome-profile/Default/Cache/Cache_Data/21f6ec9d4649b268_0'
    at FSWatcher.<computed> (node:internal/fs/watchers:247:19)
    at watch (node:fs:2491:36)
    at createFsWatchInstance (/home/everlier/code/dax/node_modules/chokidar/handler.js:131:31)
    at setFsWatchListener (/home/everlier/code/dax/node_modules/chokidar/handler.js:176:19)
    at NodeFsHandler._watchWithNodeFs (/home/everlier/code/dax/node_modules/chokidar/handler.js:330:22)
    at NodeFsHandler._handleFile (/home/everlier/code/dax/node_modules/chokidar/handler.js:396:29)
    at NodeFsHandler._addToNodeFs (/home/everlier/code/dax/node_modules/chokidar/handler.js:620:31)
```

- File names are rendered on top of the side panel and modal
- File tooltips are scaling with zoom, they should stay contant size on the screen, same as the rest of the UI, for readability

```
Error occurred in handler for 'fs:moveFile': Error: ENOENT: no such file or directory, rename '/home/everlier/Documents/dax/notes/craft/ci.md' -> '/home/everlier/Documents/dax/notes/jitera/ci.md'
    at async Object.rename (node:internal/fs/promises:782:10)
    at async /home/everlier/code/dax/dist-electron/main.js:94:5
    at async WebContents.<anonymous> (node:electron/js2c/browser_init:2:87428) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'rename',
  path: '/home/everlier/Documents/dax/notes/craft/ci.md',
  dest: '/home/everlier/Documents/dax/notes/jitera/ci.md'
}
```