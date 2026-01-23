/**
 * Pathfinding utilities for graph traversal
 * Supports BFS and Dijkstra algorithms for finding shortest paths
 */

export interface GraphNode {
  id: string;
  [key: string]: any;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight?: number;
  [key: string]: any;
}

export interface PathResult {
  path: string[];
  nodes: GraphNode[];
  links: GraphLink[];
  length: number;
}

/**
 * Build an adjacency list from nodes and links
 */
function buildAdjacencyList(
  nodes: GraphNode[],
  links: GraphLink[]
): Map<string, Array<{ node: GraphNode; link: GraphLink; weight: number }>> {
  const adjList = new Map<string, Array<{ node: GraphNode; link: GraphLink; weight: number }>>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Initialize adjacency list
  nodes.forEach(node => {
    adjList.set(node.id, []);
  });

  // Build edges
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);

    if (sourceNode && targetNode) {
      // Add forward edge
      const neighbors = adjList.get(sourceId) || [];
      neighbors.push({
        node: targetNode,
        link,
        weight: link.weight || 1
      });
      adjList.set(sourceId, neighbors);

      // Add reverse edge (undirected graph for trace path)
      const reverseNeighbors = adjList.get(targetId) || [];
      reverseNeighbors.push({
        node: sourceNode,
        link,
        weight: link.weight || 1
      });
      adjList.set(targetId, reverseNeighbors);
    }
  });

  return adjList;
}

/**
 * BFS (Breadth-First Search) for finding shortest path in unweighted graph
 */
export function bfsPath(
  nodes: GraphNode[],
  links: GraphLink[],
  startId: string,
  endId: string
): PathResult | null {
  if (startId === endId) {
    return { path: [startId], nodes: [], links: [], length: 0 };
  }

  const adjList = buildAdjacencyList(nodes, links);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, { node: string; link: GraphLink }>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === endId) {
      // Reconstruct path
      const path: string[] = [];
      const pathNodes: GraphNode[] = [];
      const pathLinks: GraphLink[] = [];

      let curr = currentId;
      while (curr !== startId) {
        path.unshift(curr);
        const parentInfo = parent.get(curr);
        if (parentInfo) {
          pathLinks.unshift(parentInfo.link);
          curr = parentInfo.node;
        } else {
          break;
        }
      }
      path.unshift(startId);

      // Get node objects
      path.forEach(id => {
        const node = nodeMap.get(id);
        if (node) pathNodes.push(node);
      });

      return {
        path,
        nodes: pathNodes,
        links: pathLinks,
        length: pathLinks.length
      };
    }

    const neighbors = adjList.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.node.id)) {
        visited.add(neighbor.node.id);
        parent.set(neighbor.node.id, { node: currentId, link: neighbor.link });
        queue.push(neighbor.node.id);
      }
    }
  }

  return null; // No path found
}

/**
 * Dijkstra's algorithm for finding shortest path in weighted graph
 */
export function dijkstraPath(
  nodes: GraphNode[],
  links: GraphLink[],
  startId: string,
  endId: string
): PathResult | null {
  if (startId === endId) {
    return { path: [startId], nodes: [], links: [], length: 0 };
  }

  const adjList = buildAdjacencyList(nodes, links);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Initialize distances and parent pointers
  const distances = new Map<string, number>();
  const parent = new Map<string, { node: string; link: GraphLink }>();
  const unvisited = new Set<string>();

  nodes.forEach(node => {
    distances.set(node.id, node.id === startId ? 0 : Infinity);
    unvisited.add(node.id);
  });

  while (unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let currentId: string | null = null;
    let minDist = Infinity;

    for (const id of unvisited) {
      const dist = distances.get(id) || Infinity;
      if (dist < minDist) {
        minDist = dist;
        currentId = id;
      }
    }

    if (currentId === null || minDist === Infinity) {
      break; // No reachable nodes
    }

    if (currentId === endId) {
      // Reconstruct path
      const path: string[] = [];
      const pathNodes: GraphNode[] = [];
      const pathLinks: GraphLink[] = [];

      let curr = currentId;
      while (curr !== startId) {
        path.unshift(curr);
        const parentInfo = parent.get(curr);
        if (parentInfo) {
          pathLinks.unshift(parentInfo.link);
          curr = parentInfo.node;
        } else {
          break;
        }
      }
      path.unshift(startId);

      // Get node objects
      path.forEach(id => {
        const node = nodeMap.get(id);
        if (node) pathNodes.push(node);
      });

      return {
        path,
        nodes: pathNodes,
        links: pathLinks,
        length: minDist
      };
    }

    unvisited.delete(currentId);

    // Update distances to neighbors
    const neighbors = adjList.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (unvisited.has(neighbor.node.id)) {
        const newDist = (distances.get(currentId) || 0) + neighbor.weight;
        const currentDist = distances.get(neighbor.node.id) || Infinity;

        if (newDist < currentDist) {
          distances.set(neighbor.node.id, newDist);
          parent.set(neighbor.node.id, { node: currentId, link: neighbor.link });
        }
      }
    }
  }

  return null; // No path found
}

/**
 * Find shortest path using either BFS (unweighted) or Dijkstra (weighted)
 */
export function findShortestPath(
  nodes: GraphNode[],
  links: GraphLink[],
  startId: string,
  endId: string,
  useWeights = true
): PathResult | null {
  // Check if any links have weights
  const hasWeights = links.some(link => link.weight !== undefined);

  if (useWeights && hasWeights) {
    return dijkstraPath(nodes, links, startId, endId);
  } else {
    return bfsPath(nodes, links, startId, endId);
  }
}
