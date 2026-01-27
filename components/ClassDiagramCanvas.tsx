
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';

interface ClassDiagramNode {
  id: string;
  name: string;
  kind: 'struct' | 'func' | 'interface' | 'field' | 'file' | 'package';
  filePath?: string;
  start_line?: number;
  end_line?: number;
  parent?: string;
  inDegree?: number;
}

interface ClassDiagramLink {
  source: string;
  target: string;
  relation: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
}

interface ClassDiagramCanvasProps {
  nodes: ClassDiagramNode[];
  links: ClassDiagramLink[];
  onNodeClick: (node: ClassDiagramNode) => void;
  width?: number;
  height?: number;
}

export const ClassDiagramCanvas: React.FC<ClassDiagramCanvasProps> = ({
  nodes,
  links,
  onNodeClick,
  width = 800,
  height = 600
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const getNodeColor = (kind: string) => {
      switch (kind) {
        case 'struct': return '#10b981';
        case 'interface': return '#f59e0b';
        case 'func': return '#6366f1';
        case 'file': return '#0ea5e9';
        case 'package': return '#8b5cf6';
        default: return '#94a3b8';
      }
    };

    const gGraph = new dagre.graphlib.Graph();
    gGraph.setGraph({ rankdir: 'LR', ranksep: 60, nodesep: 30 });
    gGraph.setDefaultEdgeLabel(() => ({ relation: '' }));

    nodes.forEach(node => {
      gGraph.setNode(node.id, {
        label: node.name,
        width: Math.max(120, node.name.length * 10),
        height: node.kind === 'struct' || node.kind === 'file' ? 45 : 30,
        kind: node.kind
      });
    });

    // Store link metadata for styling
    const linkMetadata = new Map<string, { source_type?: 'ast' | 'virtual'; weight?: number; relation: string }>();
    links.forEach(link => {
      if (nodeMap.has(link.source) && nodeMap.has(link.target)) {
        const edgeKey = `${link.source}->${link.target}`;
        linkMetadata.set(edgeKey, {
          source_type: link.source_type,
          weight: link.weight,
          relation: link.relation
        });
        gGraph.setEdge(link.source, link.target, { ...link });
      }
    });

    dagre.layout(gGraph);

    g.selectAll('g.node')
      .data(gGraph.nodes())
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => {
        const nodeData = gGraph.node(d);
        return `translate(${nodeData.x - nodeData.width / 2},${nodeData.y - nodeData.height / 2})`;
      })
      .style('cursor', 'pointer')
      .on('click', (_: any, d: any) => {
        const originalNode = nodeMap.get(d);
        if (originalNode) onNodeClick(originalNode);
      })
      .each(function (this: SVGGElement, d: any) {
        const nodeData = gGraph.node(d);
        const el = d3.select(this);
        const color = getNodeColor(nodeData.kind || 'func');
        const isStructOrFile = nodeData.kind === 'struct' || nodeData.kind === 'file' || nodeData.kind === 'interface';

        el.append('rect')
          .attr('width', nodeData.width)
          .attr('height', nodeData.height)
          .attr('rx', isStructOrFile ? 6 : 4)
          .attr('fill', `rgba(${hexToRgb(color)}, 0.15)`)
          .attr('stroke', color)
          .attr('stroke-width', 1.5);

        el.append('text')
          .attr('x', nodeData.width / 2)
          .attr('y', nodeData.height / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#f1f5f9')
          .attr('font-size', isStructOrFile ? '11px' : '10px')
          .attr('font-weight', isStructOrFile ? '700' : '500')
          .text(nodeData.label);
      });

    const linkGroup = g.append('g').attr('class', 'links');

    // Helper to check if link is virtual
    const isVirtualLink = (link: ClassDiagramLink): boolean => {
      if (link.source_type === 'virtual') return true;
      return link.relation?.startsWith('v:') || false;
    };

    // Helper to get link color
    const getLinkColor = (link: ClassDiagramLink): string => {
      return isVirtualLink(link) ? '#a855f7' : '#475569';
    };

    // Helper to get link opacity
    const getLinkOpacity = (link: ClassDiagramLink): number => {
      if (link.weight !== undefined) {
        return 0.2 + (link.weight * 0.8);
      }
      return isVirtualLink(link) ? 0.6 : 0.6;
    };

    const linkColor = '#475569';

    gGraph.edges().forEach((edge: any) => {
      const sourceData = gGraph.node(edge.v);
      const targetData = gGraph.node(edge.w);
      if (!sourceData || !targetData) return;

      const edgeKey = `${edge.v}->${edge.w}`;
      const metadata = linkMetadata.get(edgeKey) || { source_type: undefined, weight: undefined, relation: '' };
      const isVirtual = metadata.source_type === 'virtual' || metadata.relation?.startsWith('v:');
      const color = isVirtual ? '#a855f7' : linkColor;
      const opacity = metadata.weight !== undefined ? (0.2 + (metadata.weight * 0.8)) : 0.6;

      // DAGRE layout: 'x' and 'y' are center coordinates
      // Source anchor: Right edge (x + width/2)
      // Target anchor: Left edge (x - width/2)
      const sourceX = sourceData.x + (sourceData.width / 2);
      const sourceY = sourceData.y;
      const targetX = targetData.x - (targetData.width / 2);
      const targetY = targetData.y;

      // Adjust target for arrowhead padding (so it doesn't touch the node border)
      // We want the arrow tip to be at targetX - padding.
      // Actually, marker-end attaches to the end of the path.
      // If we stop the path short, the arrow will be drawn there.
      // Let's stop 8px before the target node to give space for the arrow.
      const arrowPadding = 8;
      const adjustedTargetX = targetX - arrowPadding;

      const path = d3.path();

      // Bump Curve Logic (Horizontal)
      // Equivalent to d3.curveBumpX logic
      const curvature = 0.5;
      const xi = d3.interpolateNumber(sourceX, adjustedTargetX);
      const x0 = xi(curvature);
      const x1 = xi(1 - curvature);

      path.moveTo(sourceX, sourceY);
      path.bezierCurveTo(x0, sourceY, x1, targetY, adjustedTargetX, targetY);

      const pathElement = linkGroup.append('path')
        .attr('d', path.toString())
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', isVirtual ? 2 : 1.5)
        .attr('stroke-opacity', opacity)
        .attr('marker-end', 'url(#arrow)');

      if (isVirtual) {
        pathElement.attr('stroke-dasharray', '5,5');
      }
    });

    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', linkColor);

    const initialTransform = d3.zoomIdentity
      .translate(width / 2, 50)
      .scale(0.9);
    svg.call(zoom.transform, initialTransform);

  }, [nodes, links, onNodeClick, width, height]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0a1118] rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" width={width} height={height} />
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center opacity-30">
            <i className="fas fa-sitemap text-4xl mb-2"></i>
            <p className="text-[10px] uppercase font-black tracking-[0.2em]">No Class Diagram</p>
          </div>
        </div>
      )}
    </div>
  );
};

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '148,163,184';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export default ClassDiagramCanvas;
