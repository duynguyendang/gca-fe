
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface ClassDiagramNode {
  id: string;
  name: string;
  kind: 'struct' | 'func' | 'interface' | 'field';
  filePath?: string;
  start_line?: number;
  end_line?: number;
  parent?: string;
  inDegree?: number;
}

interface ClassDiagramLink {
  source: string;
  target: string;
  relation: 'contains' | 'implements' | 'calls' | 'has_field' | 'method_of';
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
  width = 400,
  height = 300
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const structs = nodes.filter(n => n.kind === 'struct' || n.kind === 'interface');
    const methods = nodes.filter(n => n.kind === 'func');

    const methodToStruct = new Map<string, string>();
    links.filter(l => l.relation === 'method_of' || l.relation === 'contains').forEach(l => {
      methodToStruct.set(l.source, l.target);
    });

    const structMembers = new Map<string, ClassDiagramNode[]>();
    methods.forEach(m => {
      const parentStruct = methodToStruct.get(m.id) || m.parent;
      if (parentStruct && nodeMap.has(parentStruct)) {
        if (!structMembers.has(parentStruct)) {
          structMembers.set(parentStruct, []);
        }
        structMembers.get(parentStruct)!.push(m);
      }
    });

    const getNodeColor = (kind: string) => {
      switch (kind) {
        case 'struct': return '#10b981';
        case 'interface': return '#f59e0b';
        case 'func': return '#6366f1';
        default: return '#94a3b8';
      }
    };

    const graph: any = {
      directed: true,
      graph: {
        rankdir: 'TB',
        ranksep: 50,
        nodesep: 25
      },
      nodes: [] as any[],
      edges: [] as any[]
    };

    structs.forEach(s => {
      const members = structMembers.get(s.id) || [];
      const nodeWidth = Math.max(140, s.name.length * 10 + 40 + Math.max(0, members.length * 15));
      const nodeHeight = 45 + (members.length > 0 ? members.length * 22 : 0);
      
      graph.nodes.push({
        id: s.id,
        label: s.name,
        kind: s.kind,
        width: nodeWidth,
        height: nodeHeight,
        type: 'struct',
        members: members
      });
    });

    methods.forEach(f => {
      if (!methodToStruct.has(f.id) && !f.parent) {
        graph.nodes.push({
          id: f.id,
          label: f.name,
          kind: f.kind,
          width: Math.max(100, f.name.length * 9),
          height: 28,
          type: 'func',
          inDegree: f.inDegree || 0
        });
      }
    });

    graph.edges = links
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => {
        const sourceNode = nodeMap.get(l.source)!;
        const targetNode = nodeMap.get(l.target)!;
        if (sourceNode.kind === 'func' && targetNode.kind === 'struct' && l.relation === 'contains') {
          return { v: l.target, w: l.source, relation: 'method_of' };
        }
        return { v: l.source, w: l.target, relation: l.relation };
      });

    try {
      const layout = (d3 as any).dagre()
        .graphObj(graph)
        .run();

      const nodeElements = g.selectAll('g.node')
        .data(layout.nodes())
        .join('g')
        .attr('class', 'node')
        .attr('transform', (d: any) => `translate(${d.x - d.width / 2},${d.y - d.height / 2})`)
        .style('cursor', 'pointer')
        .on('click', (_: any, d: any) => {
          const originalNode = nodeMap.get(d.id);
          if (originalNode) onNodeClick(originalNode);
        });

      nodeElements.each(function(this: SVGGElement, d: any) {
        const el = d3.select(this);
        const color = getNodeColor(d.kind);
        
        el.append('rect')
          .attr('width', d.width)
          .attr('height', d.height)
          .attr('rx', 6)
          .attr('fill', `rgba(${hexToRgb(color)}, 0.15)`)
          .attr('stroke', color)
          .attr('stroke-width', 1.5);

        el.append('text')
          .attr('x', d.width / 2)
          .attr('y', 20)
          .attr('text-anchor', 'middle')
          .attr('fill', '#f1f5f9')
          .attr('font-size', '11px')
          .attr('font-weight', '700')
          .text(d.label);

        if (d.members && d.members.length > 0) {
          d.members.forEach((member: any, idx: number) => {
            el.append('rect')
              .attr('x', 8)
              .attr('y', 32 + idx * 18)
              .attr('width', d.width - 16)
              .attr('height', 16)
              .attr('rx', 3)
              .attr('fill', 'rgba(99,102,241,0.1)')
              .attr('stroke', 'rgba(99,102,241,0.3)')
              .attr('stroke-width', 0.5);

            el.append('text')
              .attr('x', 12)
              .attr('y', 44 + idx * 18)
              .attr('fill', '#a5b4fc')
              .attr('font-size', '9px')
              .text(member.name);
          });
        }
      });

      const linkGroup = g.append('g').attr('class', 'links');
      const linkColor = '#334155';

      layout.edges().forEach((edge: any) => {
        const isMethodLink = edge.relation === 'method_of';
        const sourceY = edge.source.y + (edge.source.height || 30) / 2;
        const targetY = edge.target.y - (edge.target.height || 30) / 2;
        
        const points = [
          { x: edge.source.x, y: sourceY },
          { x: edge.source.x, y: sourceY + (isMethodLink ? 15 : 25) },
          { x: edge.target.x, y: targetY - (isMethodLink ? 15 : 25) },
          { x: edge.target.x, y: targetY }
        ];

        const lineGenerator = d3.line<{ x: number; y: number }>()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveBasis);

        linkGroup.append('path')
          .attr('d', lineGenerator(points))
          .attr('fill', 'none')
          .attr('stroke', linkColor)
          .attr('stroke-width', isMethodLink ? 1 : 1.5)
          .attr('stroke-opacity', isMethodLink ? 0.4 : 0.6)
          .attr('stroke-dasharray', isMethodLink ? '3,2' : 'none')
          .attr('marker-end', isMethodLink ? '' : 'url(#arrow)');
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
        .translate(width / 2, height / 2)
        .scale(0.8)
        .translate(-width / 2, -height / 2);
      svg.call(zoom.transform, initialTransform);

    } catch (e) {
      console.warn('Dagre layout failed, using simple fallback:', e);
      
      const nodeGroup = g.selectAll('g')
        .data(nodes)
        .join('g')
        .attr('transform', (_: any, i: number) => `translate(${(i % 2) * 180 + 60},${Math.floor(i / 2) * 100 + 50})`)
        .style('cursor', 'pointer')
        .on('click', (_: any, d: any) => onNodeClick(d));

      nodeGroup.append('rect')
        .attr('width', 150)
        .attr('height', d => d.kind === 'struct' ? 50 : 30)
        .attr('rx', 6)
        .attr('fill', d => d.kind === 'struct' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)')
        .attr('stroke', d => d.kind === 'struct' ? '#10b981' : '#6366f1')
        .attr('stroke-width', 1.5);

      nodeGroup.append('text')
        .attr('x', 75)
        .attr('y', d => d.kind === 'struct' ? 28 : 18)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#f1f5f9')
        .attr('font-size', '10px')
        .attr('font-weight', d => d.kind === 'struct' ? '700' : '500')
        .text(d => d.name);
    }

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
