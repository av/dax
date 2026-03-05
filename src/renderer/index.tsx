import { render } from 'solid-js/web';
import { App } from './gui/App';
import { initScene } from './engine/scene';

/**
 * Renderer entry point.
 * 1. Mounts the Solid.js App shell to the #app overlay div
 * 2. Initializes the Babylon.js 3D scene on the <canvas>
 *    (async for Havok WASM physics loading)
 */
const appRoot = document.getElementById('app');
const canvas = document.getElementById('render-canvas') as HTMLCanvasElement;

if (appRoot) {
  render(() => <App />, appRoot);
}

if (canvas) {
  initScene(canvas).catch((err) => {
    console.error('[dax] Failed to initialize 3D scene:', err);
  });
}
