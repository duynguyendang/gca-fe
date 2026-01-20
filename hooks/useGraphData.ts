
import { useMemo } from 'react';
import { ASTNode, FlatGraph } from '../types';

export const useGraphData = (data: ASTNode | FlatGraph) => {
  return useMemo(() => {
    if (!data || !('nodes' in data)) return null;
    
    // Safety check for empty or invalid node arrays
    if (!Array.isArray(data.nodes)) return null;

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
      
      return source && target ? { source, target } : null;
    }).filter((l): l is { source: any, target: any } => l !== null) : [];

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
