export { initScene, getEngine, getScene, sceneReady } from './scene';
export {
  setupLighting,
  getShadowGenerator,
  getGroundMesh,
  enableShadows,
  setShadowMapSize,
} from './lighting';
export { getMaterial, getCategoryColor3, clearMaterialCache, CATEGORY_COLORS } from './materials';
export { fadeIn, dissolve, pulse, renameFlash, searchScan } from './animations';
export {
  createFileMesh,
  createFolderMesh,
  createMeshForEntry,
  getMeshByPath,
  disposeMeshByPath,
  updateMeshLabel,
  renameMesh,
  getMeshCount,
  clearMeshTracking,
} from './mesh-factory';
export { populateScene, handleFSEventBatch, resetLayout } from './scene-bridge';
export type { SceneBridgeCallbacks } from './scene-bridge';

// M4: Physics
export {
  initPhysics,
  getPhysicsPlugin,
  createGroundBody,
  createBoundaryWalls,
  addFilePhysicsBody,
  addFolderPhysicsBody,
  getAggregate,
  disposeAggregate,
  disposePhysics,
} from './physics';

// M4: Camera
export {
  createRTSCamera,
  restoreCameraState,
  resetCameraToDefault,
  getCamera,
  onCameraStateChange,
  flyToPosition,
  disposeCamera,
} from './camera';

// M4: LOD
export { setupLOD, verifyFrustumCulling, clearLODCache } from './lod';

// M5: Selection
export {
  initSelectionSystem,
  addSelectionHighlight,
  removeSelectionHighlight,
  clearAllHighlights,
  addFolderDropHighlight,
  removeFolderDropHighlight,
  clearFolderHighlights,
  createGhostOutline,
  removeGhostOutline,
  clearAllGhosts,
  getHighlightLayer,
  applySearchHighlights,
  clearSearchHighlights,
  disposeSelectionSystem,
} from './selection';

// M5: Interaction
export {
  initInteractionSystem,
  selectAll,
  cycleSelection,
  disposeInteractionSystem,
} from './interaction';

// M4: Instance mesh pool
export {
  getMasterMesh,
  createPoolInstance,
  hasMasterMesh,
  getPoolSize,
  getInstanceCount,
  clearMeshPool,
} from './mesh-pool';

// M4: Performance monitoring
export {
  startPerformanceMonitor,
  stopPerformanceMonitor,
  getPerformanceStats,
} from './performance-monitor';
