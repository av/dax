import type { Vector3 } from '@/types';

export interface PathNode {
  x: number;
  z: number;
  g: number;  // Cost from start
  h: number;  // Heuristic (estimated cost to goal)
  f: number;  // Total cost (g + h)
  parent: PathNode | null;
}

export interface Obstacle {
  position: Vector3;
  radius: number;
}

export interface RepelBeacon {
  position: Vector3;
  radius: number;
  intensity: number;  // 0-1, how strongly to avoid
}

export interface PathfindingConfig {
  gridSize: number;       // Size of each grid cell
  maxIterations: number;  // Max A* iterations
  smoothPath: boolean;    // Whether to smooth the final path
  repelCostMultiplier: number; // Cost multiplier for cells in repel zones
}

const DEFAULT_CONFIG: PathfindingConfig = {
  gridSize: 0.5,
  maxIterations: 1000,
  smoothPath: true,
  repelCostMultiplier: 5.0,
};

/**
 * A* pathfinding implementation for agent navigation
 */
export class Pathfinding {
  private config: PathfindingConfig;
  private obstacles: Obstacle[] = [];
  private repelBeacons: RepelBeacon[] = [];
  private gridCache: Map<string, boolean> = new Map();
  private costCache: Map<string, number> = new Map();

  constructor(config: Partial<PathfindingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set obstacles to avoid
   */
  public setObstacles(obstacles: Obstacle[]): void {
    this.obstacles = obstacles;
    this.clearCaches();
  }

  /**
   * Add an obstacle
   */
  public addObstacle(obstacle: Obstacle): void {
    this.obstacles.push(obstacle);
    this.clearCaches();
  }

  /**
   * Remove an obstacle by position
   */
  public removeObstacle(position: Vector3): void {
    this.obstacles = this.obstacles.filter(
      (o) => o.position.x !== position.x || o.position.z !== position.z
    );
    this.clearCaches();
  }

  /**
   * Clear all obstacles
   */
  public clearObstacles(): void {
    this.obstacles = [];
    this.clearCaches();
  }

  /**
   * Set repel beacons for pathfinding avoidance
   */
  public setRepelBeacons(beacons: RepelBeacon[]): void {
    this.repelBeacons = beacons;
    this.clearCaches();
  }

  /**
   * Add a repel beacon
   */
  public addRepelBeacon(beacon: RepelBeacon): void {
    this.repelBeacons.push(beacon);
    this.clearCaches();
  }

  /**
   * Remove a repel beacon by position
   */
  public removeRepelBeacon(position: Vector3): void {
    this.repelBeacons = this.repelBeacons.filter(
      (b) => b.position.x !== position.x || b.position.z !== position.z
    );
    this.clearCaches();
  }

  /**
   * Clear all repel beacons
   */
  public clearRepelBeacons(): void {
    this.repelBeacons = [];
    this.clearCaches();
  }

  /**
   * Clear all caches
   */
  private clearCaches(): void {
    this.gridCache.clear();
    this.costCache.clear();
  }

  /**
   * Find a path from start to goal using A*
   */
  public findPath(start: Vector3, goal: Vector3): Vector3[] {
    const gridSize = this.config.gridSize;
    
    // Convert to grid coordinates
    const startNode: PathNode = {
      x: Math.round(start.x / gridSize),
      z: Math.round(start.z / gridSize),
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    };
    
    const goalNode: PathNode = {
      x: Math.round(goal.x / gridSize),
      z: Math.round(goal.z / gridSize),
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    };
    
    // Check if goal is blocked
    if (this.isBlocked(goalNode.x, goalNode.z)) {
      // Find nearest unblocked cell to goal
      const nearestGoal = this.findNearestUnblocked(goalNode);
      if (!nearestGoal) {
        return [start, goal]; // Fallback to direct path
      }
      goalNode.x = nearestGoal.x;
      goalNode.z = nearestGoal.z;
    }
    
    // A* algorithm
    const openList: PathNode[] = [startNode];
    const closedSet = new Set<string>();
    
    startNode.h = this.heuristic(startNode, goalNode);
    startNode.f = startNode.h;
    
    let iterations = 0;
    
    while (openList.length > 0 && iterations < this.config.maxIterations) {
      iterations++;
      
      // Get node with lowest f cost
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      
      // Check if we reached the goal
      if (current.x === goalNode.x && current.z === goalNode.z) {
        return this.reconstructPath(current, gridSize, start.y);
      }
      
      const key = `${current.x},${current.z}`;
      if (closedSet.has(key)) continue;
      closedSet.add(key);
      
      // Check neighbors
      const neighbors = this.getNeighbors(current);
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.z}`;
        
        if (closedSet.has(neighborKey)) continue;
        if (this.isBlocked(neighbor.x, neighbor.z)) continue;
        
        const tentativeG = current.g + this.distance(current, neighbor);
        
        const existing = openList.find((n) => n.x === neighbor.x && n.z === neighbor.z);
        
        if (!existing) {
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, goalNode);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;
          openList.push(neighbor);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = existing.g + existing.h;
          existing.parent = current;
        }
      }
    }
    
    // No path found, return direct path
    return [start, goal];
  }

  /**
   * Get neighbor nodes (8-directional movement)
   */
  private getNeighbors(node: PathNode): PathNode[] {
    const directions = [
      { x: 0, z: 1 },   // North
      { x: 1, z: 0 },   // East
      { x: 0, z: -1 },  // South
      { x: -1, z: 0 },  // West
      { x: 1, z: 1 },   // NE
      { x: 1, z: -1 },  // SE
      { x: -1, z: -1 }, // SW
      { x: -1, z: 1 },  // NW
    ];
    
    return directions.map((d) => ({
      x: node.x + d.x,
      z: node.z + d.z,
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    }));
  }

  /**
   * Calculate heuristic (octile distance)
   */
  private heuristic(a: PathNode, b: PathNode): number {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    const D = 1;
    const D2 = Math.SQRT2;
    return D * (dx + dz) + (D2 - 2 * D) * Math.min(dx, dz);
  }

  /**
   * Calculate distance between two nodes (including repel beacon cost)
   */
  private distance(a: PathNode, b: PathNode): number {
    const baseCost = a.x === b.x || a.z === b.z ? 1 : Math.SQRT2;
    const repelCost = this.getRepelCost(b.x, b.z);
    return baseCost * (1 + repelCost);
  }

  /**
   * Calculate additional cost from repel beacons
   */
  private getRepelCost(x: number, z: number): number {
    const key = `repel:${x},${z}`;
    
    // Check cache
    if (this.costCache.has(key)) {
      return this.costCache.get(key)!;
    }
    
    const worldX = x * this.config.gridSize;
    const worldZ = z * this.config.gridSize;
    
    let totalCost = 0;
    
    for (const beacon of this.repelBeacons) {
      const dx = worldX - beacon.position.x;
      const dz = worldZ - beacon.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < beacon.radius) {
        // Closer to center = higher cost
        const normalizedDistance = distance / beacon.radius;
        const influence = (1 - normalizedDistance) * beacon.intensity;
        totalCost += influence * this.config.repelCostMultiplier;
      }
    }
    
    this.costCache.set(key, totalCost);
    return totalCost;
  }

  /**
   * Check if a grid cell is blocked
   */
  private isBlocked(x: number, z: number): boolean {
    const key = `${x},${z}`;
    
    // Check cache
    if (this.gridCache.has(key)) {
      return this.gridCache.get(key)!;
    }
    
    const worldX = x * this.config.gridSize;
    const worldZ = z * this.config.gridSize;
    
    const blocked = this.obstacles.some((obstacle) => {
      const dx = worldX - obstacle.position.x;
      const dz = worldZ - obstacle.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      return distance < obstacle.radius;
    });
    
    this.gridCache.set(key, blocked);
    return blocked;
  }

  /**
   * Find the nearest unblocked cell
   */
  private findNearestUnblocked(node: PathNode): { x: number; z: number } | null {
    const maxRadius = 10;
    
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          
          const x = node.x + dx;
          const z = node.z + dz;
          
          if (!this.isBlocked(x, z)) {
            return { x, z };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Reconstruct path from goal node
   */
  private reconstructPath(goalNode: PathNode, gridSize: number, y: number): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | null = goalNode;
    
    while (current !== null) {
      path.unshift({
        x: current.x * gridSize,
        y,
        z: current.z * gridSize,
      });
      current = current.parent;
    }
    
    if (this.config.smoothPath) {
      return this.smoothPath(path);
    }
    
    return path;
  }

  /**
   * Smooth the path by removing unnecessary waypoints
   */
  private smoothPath(path: Vector3[]): Vector3[] {
    if (path.length <= 2) return path;
    
    const smoothed: Vector3[] = [path[0]!];
    let current = 0;
    
    while (current < path.length - 1) {
      // Try to skip waypoints
      let farthest = current + 1;
      
      for (let i = path.length - 1; i > current + 1; i--) {
        if (this.hasLineOfSight(path[current]!, path[i]!)) {
          farthest = i;
          break;
        }
      }
      
      smoothed.push(path[farthest]!);
      current = farthest;
    }
    
    return smoothed;
  }

  /**
   * Check if there's a clear line between two points
   */
  private hasLineOfSight(from: Vector3, to: Vector3): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(distance / this.config.gridSize);
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const z = from.z + dz * t;
      
      const gridX = Math.round(x / this.config.gridSize);
      const gridZ = Math.round(z / this.config.gridSize);
      
      if (this.isBlocked(gridX, gridZ)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate total path length
   */
  public getPathLength(path: Vector3[]): number {
    let length = 0;
    
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]!;
      const curr = path[i]!;
      const dx = curr.x - prev.x;
      const dz = curr.z - prev.z;
      length += Math.sqrt(dx * dx + dz * dz);
    }
    
    return length;
  }

  /**
   * Estimate time to traverse path at given speed
   */
  public estimateTime(path: Vector3[], speed: number): number {
    return this.getPathLength(path) / speed;
  }
}
