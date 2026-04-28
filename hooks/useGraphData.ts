
import { useMemo } from 'react';
import { ASTNode, FlatGraph, GraphLink } from '../types';
import { logger } from '../logger';

export const useGraphData = (data: ASTNode | FlatGraph) => {
  return useMemo(() => {
    if (!data || !('nodes' in data)) {
      logger.log('useGraphData: no valid data');
      return null;
    }

    // Safety check for empty or invalid node arrays
    if (!Array.isArray(data.nodes)) {
      logger.log('useGraphData: nodes is not an array');
      return null;
    }

    logger.log('useGraphData: data.nodes:', data.nodes.length, 'data.links:', Array.isArray(data.links) ? data.links.length : 0);

    const nodeMap = new Map<string, any>();
    data.nodes.forEach(n => {
      if (n && n.id) nodeMap.set(n.id, n);
    });

    const nodes = Array.from(nodeMap.values());

const links = Array.isArray(data.links) ? data.links
      .filter((d): d is GraphLink => typeof d === 'object' && d !== null && 'source' in d && 'target' in d)
      .map(d => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;

      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);

      // Only create links if both source and target nodes exist
      // This filters out external dependencies that don't have corresponding nodes
      if (!source || !target) {
        return null;
      }

      return { source, target };
    }).filter((l): l is { source: any, target: any } => l !== null) : [];

    logger.log('useGraphData: processed links:', links.length);
    if (links.length === 0 && Array.isArray(data.links) && data.links.length > 0) {
      logger.warn('useGraphData: WARNING - ALL links were dropped! Original count:', data.links.length);
    }

    const degrees = new Map<string, number>();
    links.forEach(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (sId) {
        degrees.set(sId, (degrees.get(sId) || 0) + 1);
      }
      if (tId) {
        degrees.set(tId, (degrees.get(tId) || 0) + 1);
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
