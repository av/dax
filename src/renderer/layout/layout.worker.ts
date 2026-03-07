/**
 * Web Worker for d3-force layout simulation.
 *
 * Receives graph data (nodes + links) via postMessage, runs d3-force
 * simulation, and posts back the computed positions.
 *
 * This worker has NO imports from app modules — it is standalone.
 * Only imports d3-force.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

// ── Types ──

export interface LayoutNode extends SimulationNodeDatum {
  id: string;
  parentId: string | null;
  type: 'file' | 'folder';
  /** If pinned, fx/fy are set and the node won't move */
  isPinned: boolean;
  /** Collision radius based on mesh size */
  radius: number;
}

export interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  source: string;
  target: string;
}

export interface LayoutRequest {
  type: 'full' | 'incremental';
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutResult {
  type: 'positions';
  nodes: Array<{
    id: string;
    x: number;
    y: number;
  }>;
  elapsed: number;
}

export interface LayoutProgress {
  type: 'progress';
  alpha: number;
  tickCount: number;
}

// ── Worker message handler ──

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const request = event.data;
  runSimulation(request);
};

function runSimulation(request: LayoutRequest): void {
  const startTime = performance.now();

  const nodes: LayoutNode[] = request.nodes.map((n) => ({
    ...n,
    // For pinned nodes, set fx/fy to their current positions
    ...(n.isPinned && n.x != null && n.y != null
      ? { fx: n.x, fy: n.y }
      : {}),
  }));

  // Build a node index for fast lookup
  const nodeById = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  // Filter links to only include those where both source and target exist
  const validLinks: LayoutLink[] = request.links.filter(
    (link) => nodeById.has(link.source as string) && nodeById.has(link.target as string),
  );

  // Configure simulation
  const simulation = forceSimulation<LayoutNode>(nodes)
    // Parent-child clustering: short links between parent and children
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(validLinks)
        .id((d) => d.id)
        .distance((link) => {
          // Shorter distance for folder-child links
          const target = typeof link.target === 'string'
            ? nodeById.get(link.target)
            : (link.target as LayoutNode);
          if (target && target.type === 'folder') return 4;
          return 6;
        })
        .strength(0.8),
    )
    // Repulsion: push unrelated nodes apart
    .force(
      'charge',
      forceManyBody<LayoutNode>()
        .strength((d) => (d.type === 'folder' ? -150 : -80))
        .distanceMax(100),
    )
    // No overlap: collision detection based on radius
    .force(
      'collide',
      forceCollide<LayoutNode>()
        .radius((d) => d.radius + 0.3)
        .iterations(2),
    )
    // Center the layout around origin
    .force('center', forceCenter(0, 0).strength(0.1))
    // Pull toward center to prevent extreme spread
    .force('x', forceX<LayoutNode>(0).strength(0.05))
    .force('y', forceY<LayoutNode>(0).strength(0.05));

  // For incremental layout, run fewer ticks
  const maxTicks = request.type === 'incremental' ? 100 : 300;

  // Set alpha based on layout type
  if (request.type === 'incremental') {
    simulation.alpha(0.3).alphaMin(0.01).alphaDecay(0.02);
  } else {
    simulation.alpha(1).alphaMin(0.001).alphaDecay(0.0228);
  }

  // Run simulation synchronously (we're in a worker)
  let tickCount = 0;
  simulation.stop(); // Don't auto-run

  while (simulation.alpha() > simulation.alphaMin() && tickCount < maxTicks) {
    simulation.tick();
    tickCount++;

    // Send progress updates every 50 ticks
    if (tickCount % 50 === 0) {
      const progress: LayoutProgress = {
        type: 'progress',
        alpha: simulation.alpha(),
        tickCount,
      };
      self.postMessage(progress);
    }
  }

  const elapsed = performance.now() - startTime;

  // Clamp positions to ±200 to stay within the 250-unit physics boundary
  const POSITION_CLAMP = 200;
  for (const n of nodes) {
    if (n.x != null) n.x = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, n.x));
    if (n.y != null) n.y = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, n.y));
  }

  // Extract positions
  const result: LayoutResult = {
    type: 'positions',
    nodes: nodes.map((n) => ({
      id: n.id,
      x: n.x ?? 0,
      y: n.y ?? 0,
    })),
    elapsed,
  };

  self.postMessage(result);
}
