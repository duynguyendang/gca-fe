
import { useMemo } from 'react';
import { ASTNode, FlatGraph } from '../types';

export const useGraphData = (data: ASTNode | FlatGraph) => {
  return useMemo(() => {
    if (!data || !('nodes' in data)) {
      console.log('useGraphData: no valid data');
      return null;
    }

    // Safety check for empty or invalid node arrays
    if (!Array.isArray(data.nodes)) {
      console.log('useGraphData: nodes is not an array');
      return null;
    }

    console.log('useGraphData: data.nodes:', data.nodes.length, 'data.links:', data.links?.length);

    const nodeMap = new Map();
    data.nodes.forEach(n => {
      if (n && n.id) nodeMap.set(n.id, n);
    });

    const nodes = Array.from(nodeMap.values());

    const links = Array.isArray(data.links) ? data.links.map(d => {
      if (!d) return null;
      const sourceId = typeof d.source === 'object' ? (d.source as any).id : d.source;
      const targetId = typeof d.target === 'object' ? (d.target as any).id : d.target;

      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);

      if (!source || !target) {
        console.warn('useGraphData: link dropped', {
          sourceId,
          targetId,
          sourceFound: !!source,
          targetFound: !!target,
          availableNodesSample: nodes.slice(0, 5).map(n => n.id) // Show first 5 IDs for context
        });
        return null;
      }

      return source && target ? { source, target } : null;
    }).filter((l): l is { source: any, target: any } => l !== null) : [];

    console.log('useGraphData: processed links:', links.length);
    if (links.length === 0 && data.links?.length > 0) {
      console.warn('useGraphData: WARNING - ALL links were dropped! Original count:', data.links.length);
    }

    const degrees = new Map<string, number>();
    links.forEach(l => {
      const s = l.source as any;
      const t = l.target as any;
      if (s && s.id) {
        degrees.set(s.id, (degrees.get(s.id) || 0) + 1);
      }
      if (t && t.id) {
        degrees.set(t.id, (degrees.get(t.id) || 0) + 1);
      }
    });

    const nodeRadii = new Map<string, number>();
    nodes.forEach(n => {
      const node = n as any;
      const degree = degrees.get(node.id) || 0;
      nodeRadii.set(node.id, Math.sqrt(degree || 1) * 8 + 4);
    });

    return { nodes, links, degrees, nodeRadii };
  }, [data]);
};
