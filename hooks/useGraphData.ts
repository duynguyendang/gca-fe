
import { useMemo } from 'react';
import { ASTNode, FlatGraph } from '../types';

export const useGraphData = (data: ASTNode | FlatGraph) => {
  return useMemo(() => {
    if (!data || !('nodes' in data)) return null;
    
    // IMPORTANT: Do NOT clone nodes with { ...n }. D3 mutates objects with x, y, vx, vy.
    // Preserving the original reference allows D3 to maintain state across re-renders.
    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
    const nodes = Array.from(nodeMap.values());

    const links = data.links.map(d => {
      const sourceId = typeof d.source === 'object' ? (d.source as any).id : d.source;
      const targetId = typeof d.target === 'object' ? (d.target as any).id : d.target;
      
      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);
      
      return source && target ? { source, target } : null;
    }).filter((l): l is { source: any, target: any } => l !== null);

    const degrees = new Map<string, number>();
    links.forEach(l => {
      degrees.set(l.source.id, (degrees.get(l.source.id) || 0) + 1);
      degrees.set(l.target.id, (degrees.get(l.target.id) || 0) + 1);
    });

    return { nodes, links, degrees };
  }, [data]);
};
