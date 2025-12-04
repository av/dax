/**
 * Common types shared across modules
 * 
 * This module contains utility types and interfaces that are used
 * throughout the codebase for consistent patterns.
 */

/**
 * Generic configuration with defaults pattern
 * Used across the codebase for component configurations
 */
export type WithDefaults<T> = {
  [K in keyof T]-?: T[K];
};

/**
 * Common color constants used across 3D objects
 */
export const COLORS = {
  // Selection states
  selection: 0x00ff88,
  hover: 0xffff00,
  
  // Object states
  editing: 0x00ffff,
  analyzing: 0xff00ff,
  
  // UI elements
  dropIndicator: 0x00ff88,
  
  // Beacons
  attract: 0x00ff00,
  repel: 0xff0000,
  speed: 0xffaa00,
  careful: 0x00aaff,
  notify: 0xff00ff,
  pause: 0xaaaaaa,
} as const;

/**
 * Common size constants for 3D objects
 */
export const SIZES = {
  /** Default label height offset above objects */
  labelHeight: 0.5,
  
  /** Default base size for objects */
  baseSize: 1,
  
  /** Physics body margin */
  physicsMargin: 0.05,
  
  /** LOD distance thresholds */
  lodNear: 30,
  lodMid: 60,
  lodFar: 100,
} as const;

/**
 * Common emissive intensity values
 */
export const EMISSIVE = {
  hover: 0.2,
  editing: 0.3,
  analyzing: 0.4,
  selected: 0.3,
} as const;

/**
 * Base interface for 3D object configurations
 * Provides common configuration properties
 */
export interface Base3DConfig {
  /** Selection highlight color */
  selectionColor?: number;
  /** Hover highlight color */
  hoverColor?: number;
  /** Base size multiplier */
  baseSize?: number;
  /** Show label above object */
  showLabel?: boolean;
  /** Label height offset */
  labelHeight?: number;
}

/**
 * Standard merged config helper
 */
export function mergeConfig<T extends object>(
  defaults: T,
  overrides: Partial<T> = {}
): T {
  return { ...defaults, ...overrides };
}
