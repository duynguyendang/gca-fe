
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ASTNode, FlatGraph } from '../../types';
import { useGraphData } from '../../hooks/useGraphData';

interface TreeVisualizerProps {
  data: ASTNode | FlatGraph;
  onNodeSelect: (node: any) => void;
  onNodeHover: (node: any | null) => void;
  mode: 'force' | 'dagre' | 'radial' | 'circlePacking';
  layoutStyle: 'organic' | 'flow';
  selectedId?: string;
}

const buildHierarchy = (nodes: any[]) => {
  const root: any = { name: "root", children: {} };
  nodes.forEach(node => {
    const parts = node.id.split('/');
    let current = root;
    parts.forEach((part: string, i: number) => {
      const isFile = i === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = { name: part, children: {} };
      }
      if (isFile) {
        current.children[part] = { ...node, name: part, value: (node.end_line - node.start_line) || 1 };
      }
      current = current.children[part];
    });
  });

  const convert = (node: any): any => {
    const childrenArr = Object.values(node.children || {}).map(convert);
    return childrenArr.length > 0 
      ? { name: node.name, children: childrenArr } 
      : { ...node };
  };

  return { name: "root", children: Object.values(root.children).map(convert) };
};

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, onNodeSelect, onNodeHover, mode, selectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const processedData = useGraphData(data);

  const getSymbol = (kind: string) => {
    switch(kind?.toLowerCase()) {
      case 'func': return 'Σ';
      case 'struct': return '{}';
      case 'interface': return 'I';
      default: return '◈';
    }
  };

  const getAccent = (kind: string) => {
    switch(kind?.toLowerCase()) {
      case 'func': return '#00f2ff';
      case 'struct': return '#10b981';
      case 'interface': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  useEffect(() => {
    if (!processedData || !containerRef.current || !svgRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 10])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const { nodes, links, nodeRadii } = processedData;

    if (mode === 'force') {
      const simulation = d3.forceSimulation(nodes as any)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(140))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((d: any) => (nodeRadii.get(d.id) || 30) + 50));

      const link = g.append("g").selectAll("line").data(links).join("line")
        .attr("stroke", "rgba(255,255,255,0.06)").attr("stroke-width", 1);

      const nodeGroup = g.append("g").selectAll("g").data(nodes).join("g")
        .attr("cursor", "pointer")
        .on("click", (e, d) => onNodeSelect(d))
        .on("mouseenter", (e, d) => {
          onNodeHover(d);
          nodeGroup.style("opacity", (n: any) => n.id === d.id ? 1 : 0.15);
          link.style("opacity", (l: any) => (l.source as any).id === d.id || (l.target as any).id === d.id ? 1 : 0.05);
        })
        .on("mouseleave", () => {
          onNodeHover(null);
          nodeGroup.style("opacity", 1);
          link.style("opacity", 1);
        });

      nodeGroup.append("circle")
        .attr("r", (d: any) => (nodeRadii.get(d.id) || 15) + 6)
        .attr("fill", "transparent")
        .attr("stroke", (d: any) => getAccent(d.kind))
        .attr("stroke-width", 2)
        .attr("stroke-opacity", (d: any) => d.id === selectedId ? 1 : 0.2)
        .style("filter", (d: any) => `drop-shadow(0 0 8px ${getAccent(d.kind)})`);

      nodeGroup.append("circle")
        .attr("r", (d: any) => nodeRadii.get(d.id) || 15)
        .attr("fill", "#0a1118")
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-width", 1);

      nodeGroup.append("text")
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("font-size", "12px").attr("font-weight", "900")
        .attr("fill", (d: any) => getAccent(d.kind))
        .text((d: any) => getSymbol(d.kind));

      nodeGroup.append("text")
        .attr("text-anchor", "middle").attr("dy", "2.8em")
        .attr("font-size", "8px").attr("fill", "rgba(255,255,255,0.4)")
        .text((d: any) => d.name || d.id.split(':').pop());

      simulation.on("tick", () => {
        link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
        nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      return () => simulation.stop();
    } 
    
    else if (mode === 'dagre') {
      const ranks = new Map<string, number>();
      const visited = new Set<string>();
      const calculateRank = (id: string): number => {
        if (ranks.has(id)) return ranks.get(id)!;
        if (visited.has(id)) return 0;
        visited.add(id);
        const predecessors = links.filter(l => (l.target as any).id === id);
        const r = predecessors.length === 0 ? 0 : Math.max(...predecessors.map(l => calculateRank((l.source as any).id))) + 1;
        ranks.set(id, r);
        return r;
      };
      nodes.forEach(n => calculateRank(n.id));
      const maxRank = Math.max(...Array.from(ranks.values()), 1);
      const groups = d3.group(nodes, n => ranks.get(n.id) || 0);
      groups.forEach((group, rank) => {
        const xStep = width / (group.length + 1);
        group.forEach((n, i) => {
          (n as any).x = (i + 1) * xStep;
          (n as any).y = (rank / maxRank) * (height - 200) + 100;
        });
      });

      g.append("g").selectAll("path").data(links).join("path")
        .attr("fill", "none").attr("stroke", "rgba(255,255,255,0.05)")
        .attr("d", (d: any) => `M${d.source.x},${d.source.y}C${d.source.x},${(d.source.y+d.target.y)/2} ${d.target.x},${(d.source.y+d.target.y)/2} ${d.target.x},${d.target.y}`);

      const nodeGroup = g.append("g").selectAll("g").data(nodes).join("g")
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
        .on("click", (e, d) => onNodeSelect(d));

      nodeGroup.append("rect").attr("x", -20).attr("y", -10).attr("width", 40).attr("height", 20).attr("rx", 4)
        .attr("fill", "#0a1118").attr("stroke", (d: any) => getAccent(d.kind)).attr("stroke-width", 1);
      
      nodeGroup.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("font-size", "8px").attr("fill", "white").text((d: any) => d.name);
    }

    else if (mode === 'circlePacking') {
      const hierarchy = d3.hierarchy(buildHierarchy(nodes))
        .sum(d => d.value || 1)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      d3.pack().size([width - 40, height - 40]).padding(10)(hierarchy);

      const leaf = g.selectAll("g").data(hierarchy.descendants()).join("g")
        .attr("transform", d => `translate(${d.x + 20},${d.y + 20})`);

      leaf.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => d.children ? "rgba(255,255,255,0.02)" : "#0d171d")
        .attr("stroke", d => d.children ? "rgba(255,255,255,0.05)" : getAccent((d.data as any).kind))
        .attr("stroke-width", 1)
        .on("click", (e, d) => !d.children && onNodeSelect(d.data));

      leaf.filter(d => !d.children && d.r > 15).append("text")
        .attr("text-anchor", "middle").attr("dy", "0.3em").attr("font-size", d => Math.min(d.r / 3, 10))
        .attr("fill", "white").text(d => (d.data as any).name);
    }
    
    else if (mode === 'radial') {
      const hierarchy = d3.hierarchy(buildHierarchy(nodes));
      const tree = d3.tree().size([2 * Math.PI, Math.min(width, height) / 2 - 100]);
      tree(hierarchy);

      g.attr("transform", `translate(${width / 2},${height / 2})`);

      g.append("g").selectAll("path").data(hierarchy.links()).join("path")
        .attr("fill", "none").attr("stroke", "rgba(255,255,255,0.05)")
        .attr("d", d3.linkRadial<any, any>().angle((d: any) => d.x).radius((d: any) => d.y) as any);

      const nodeGroup = g.append("g").selectAll("g").data(hierarchy.descendants()).join("g")
        .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
        .on("click", (e, d) => onNodeSelect(d.data));

      nodeGroup.append("circle").attr("r", 4).attr("fill", (d: any) => d.children ? "white" : getAccent((d.data as any).kind));
      nodeGroup.filter(d => !!(d.data as any).name).append("text")
        .attr("dy", "0.31em").attr("x", (d: any) => d.x < Math.PI ? 6 : -6)
        .attr("text-anchor", (d: any) => d.x < Math.PI ? "start" : "end")
        .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
        .attr("font-size", "8px").attr("fill", "rgba(255,255,255,0.5)").text((d: any) => (d.data as any).name);
    }

  }, [processedData, mode, selectedId, onNodeSelect, onNodeHover]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full absolute inset-0" />
    </div>
  );
};

export default TreeVisualizer;
