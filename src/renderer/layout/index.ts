/**
 * Layout barrel — re-exports layout service.
 */
export {
  initLayoutWorker,
  disposeLayoutWorker,
  runFullLayout,
  runIncrementalLayout,
  buildLayoutGraph,
  clearAllPins,
  onLayoutProgress,
} from './layout-service';

export type {
  LayoutNode,
  LayoutLink,
  LayoutCallback,
  LayoutProgressCallback,
} from './layout-service';
