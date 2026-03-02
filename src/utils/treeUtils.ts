import type { FileNode } from '@/types';
import { useFileTreeStore } from '@/stores/fileTreeStore';

/**
 * Reconstruct a nested FileNode[] tree from the flat store.
 * Each returned node gets a `children` array populated from childrenIndex.
 * Optionally limited to a subtree rooted at a specific node id.
 */
export function buildNestedTree(rootId?: string): FileNode[] {
  const { nodes, childrenIndex } = useFileTreeStore.getState();

  function buildNode(id: string): FileNode {
    const node = nodes.get(id)!;
    const childIds = childrenIndex.get(id) ?? [];
    if (node.type === 'directory' && childIds.length > 0) {
      return { ...node, children: childIds.map(buildNode) };
    }
    return { ...node };
  }

  const parentKey = rootId ?? '__root__';
  const topIds = childrenIndex.get(parentKey) ?? [];
  return topIds.map(buildNode);
}
