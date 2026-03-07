import { defineConfig, type Plugin } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';
import fs from 'fs';

const HAVOK_WASM_PATH = path.resolve(
  __dirname,
  'node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',
);

/**
 * Vite plugin: serves the Havok Physics WASM binary correctly.
 *
 * Dev mode:  Adds middleware that intercepts /HavokPhysics.wasm requests and
 *            serves the binary from node_modules with the correct MIME type.
 * Production: Emits the WASM file as a build asset alongside the HTML entry.
 */
function havokWasmPlugin(): Plugin {
  return {
    name: 'havok-wasm',
    configureServer(server) {
      // Serve the WASM file directly so Vite's SPA fallback doesn't intercept it
      server.middlewares.use((req, res, next) => {
        if (req.url === '/HavokPhysics.wasm') {
          const stat = fs.statSync(HAVOK_WASM_PATH);
          res.writeHead(200, {
            'Content-Type': 'application/wasm',
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          fs.createReadStream(HAVOK_WASM_PATH).pipe(res);
          return;
        }
        next();
      });
    },
    generateBundle() {
      // Emit the WASM file in the production build output
      if (fs.existsSync(HAVOK_WASM_PATH)) {
        this.emitFile({
          type: 'asset',
          fileName: 'HavokPhysics.wasm',
          source: fs.readFileSync(HAVOK_WASM_PATH),
        });
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [solidPlugin(), havokWasmPlugin()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
});
