
import { useMemo } from 'react';
import { ASTNode, FlatGraph } from '../types';

export const useGraphData = (data: ASTNode | FlatGraph) => {
  return useMemo(() => {
    if (!data || !('nodes' in data)) return null;
    
    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => {
      const sourceId = typeof d.source === 'object' ? (d.source as any).id : d.source;
      const targetId = typeof d.target === 'object' ? (d.target as any).id : d.target;
      return {
        source: nodes.find(n => n.id === sourceId),
        target: nodes.find(n => n.id === targetId)
      };
    }).filter(l => l.source && l.target);

    const degrees = new Map<string, number>();
    links.forEach(l => {
      if (l.source && l.target) {
        degrees.set(l.source.id, (degrees.get(l.source.id) || 0) + 1);
        degrees.set(l.target.id, (degrees.get(l.target.id) || 0) + 1);
      }
    });

    return { nodes, links, degrees };
  }, [data]);
};
