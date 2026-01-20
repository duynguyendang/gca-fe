
import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { ASTNode, FlatGraph } from '../types';

interface TreeVisualizerProps {
  data: ASTNode | FlatGraph;
  onNodeSelect: (node: any) => void;
  onNodeHover: (node: any | null) => void;
  mode: 'force' | 'radial' | 'circlePacking' | 'sankey';
  layoutStyle: 'organic' | 'flow';
  selectedId?: string;
}

const getShortName = (d: any): string => {
  const candidate = d.display_name || d.name || d.label;
  if (candidate) return candidate;
  return d.id ? (d.id.split(/[/:]/).pop() || d.id) : "Unknown";
};

const getNodeStyle = (node: any) => {
  const kind = node.kind?.toLowerCase();
  switch(kind) {
    case 'func':
    case 'function': return { color: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' };
    case 'struct': return { color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' };
    case 'interface': return { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' };
    case 'package': return { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' };
    default: return { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.2)' };
  }
};

const buildHierarchy = (nodes: any[]) => {
  const root: any = { name: "root", children: [] };
  nodes.forEach(node => {
    const parts = node.id.split('/');
    let current = root;
    parts.forEach((part: string, i: number) => {
      let child = current.children?.find((c: any) => c.name === part);
      if (!child) {
        child = { name: part, children: [] };
        if (i === parts.length - 1) {
          child = { ...node, value: (node.meta?.line_count || (node.end_line - node.start_line)) || 10 };
        }
        if (!current.children) current.children = [];
        current.children.push(child);
      }
      current = child;
    });
  });
  return root;
};

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, onNodeSelect, onNodeHover, mode, layoutStyle, selectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const processedData = useMemo(() => {
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

  useEffect(() => {
    if (!processedData || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    svg.append("defs").selectAll("marker")
      .data(["end"])
      .join("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#334155")
      .attr("d", "M0,-5L10,0L0,5");

    const zoom = d3.zoom<SVGSVGElement, any>()
      .scaleExtent([0.1, 8])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    switch(mode) {
      case 'force': renderNetwork(g, width, height, zoom); break;
      case 'radial': renderRadial(g, width, height); break;
      case 'circlePacking': renderPacking(g, width, height); break;
      case 'sankey': renderSankey(g, width, height); break;
    }
  }, [processedData, mode, layoutStyle, selectedId]);

  const renderNetwork = (g: any, width: number, height: number, zoom: any) => {
    if (!processedData) return;
    const { nodes, links, degrees } = processedData;

    if (layoutStyle === 'organic') {
      nodes.forEach(n => { n.fx = null; n.fy = null; });
    } else {
      const ranks = new Map<string, number>();
      const calculateRank = (id: string, visited = new Set<string>()): number => {
        if (ranks.has(id)) return ranks.get(id)!;
        if (visited.has(id)) return 0;
        visited.add(id);
        const callers = links.filter(l => (l.target as any).id === id);
        const r = callers.length === 0 ? 0 : Math.max(...callers.map(l => calculateRank((l.source as any).id, visited))) + 1;
        ranks.set(id, r);
        return r;
      };
      nodes.forEach(n => calculateRank(n.id));
      const maxRank = Math.max(...Array.from(ranks.values()), 1);
      const rankGroups = d3.group(nodes, n => ranks.get(n.id) || 0);
      rankGroups.forEach((group, rank) => {
        const xStep = width / (group.length + 1);
        group.forEach((n, i) => {
          n.fx = (i + 1) * xStep;
          n.fy = (rank / maxRank) * (height - 200) + 100;
        });
      });
    }

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => Math.sqrt(degrees.get(d.id) || 1) * 10 + 35));

    if (layoutStyle === 'flow') simulation.stop();

    const link = g.append("g").selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#1e293b")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    const nodeGroup = g.append("g").selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (e, d) => onNodeSelect(d))
      .on("mouseenter", (e, d) => {
        onNodeHover(d);
        const related = new Set([d.id]);
        links.forEach(l => {
          const sId = (l.source as any).id;
          const tId = (l.target as any).id;
          if (sId === d.id) related.add(tId);
          if (tId === d.id) related.add(sId);
        });
        nodeGroup.transition().duration(200).style("opacity", (n: any) => related.has(n.id) ? 1 : 0.05);
        link.transition().duration(200).style("opacity", (l: any) => (l.source as any).id === d.id || (l.target as any).id === d.id ? 1 : 0.05);
      })
      .on("mouseleave", () => {
        onNodeHover(null);
        nodeGroup.transition().duration(200).style("opacity", 1);
        link.transition().duration(200).style("opacity", 0.6);
      });

    nodeGroup.append("circle")
      .attr("r", (d: any) => Math.sqrt(degrees.get(d.id) || 1) * 8 + 4)
      .attr("fill", d => getNodeStyle(d).color)
      .attr("stroke", d => d.id === selectedId ? "#fff" : "#020617")
      .attr("stroke-width", d => d.id === selectedId ? 3 : 1.5)
      .style("filter", d => `drop-shadow(0 0 10px ${getNodeStyle(d).glow})`);

    // Primary Label: Short Name
    nodeGroup.append("text")
      .attr("dy", "2.2em")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("fill", "#f1f5f9")
      .text(d => getShortName(d));

    // Secondary Label: Full ID Path
    nodeGroup.append("text")
      .attr("dy", "3.6em")
      .attr("text-anchor", "middle")
      .attr("font-size", "7px")
      .attr("font-weight", "400")
      .attr("fill", "#64748b")
      .style("pointer-events", "none")
      .text(d => d.id.length > 30 ? '...' + d.id.slice(-27) : d.id);

    const updatePositions = () => {
      link.attr("d", (d: any) => {
        if (layoutStyle === 'flow') {
          const x0 = d.source.x, y0 = d.source.y, x1 = d.target.x, y1 = d.target.y;
          return `M${x0},${y0}C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`;
        }
        return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      });
      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    };

    if (layoutStyle === 'organic') {
      simulation.on("tick", updatePositions);
    } else {
      nodeGroup.transition().duration(800).ease(d3.easeCubicOut)
        .attrTween("transform", (d: any) => {
          const ix = d3.interpolate(d.x || width/2, d.fx);
          const iy = d3.interpolate(d.y || height/2, d.fy);
          return (t) => {
            d.x = ix(t); d.y = iy(t);
            updatePositions();
            return `translate(${d.x},${d.y})`;
          };
        });
    }

    if (selectedId) {
      const selected = nodes.find(n => n.id === selectedId);
      if (selected) {
        d3.select(svgRef.current).transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-(selected as any).x || -width/2, -(selected as any).y || -height/2)
        );
      }
    }
  };

  const renderRadial = (g: any, width: number, height: number) => {
    if (!processedData) return;
    const radius = Math.min(width, height) / 2 - 140;
    const root = d3.hierarchy(buildHierarchy(processedData.nodes)).sort((a, b) => d3.ascending(a.data.name, b.data.name));
    d3.cluster().size([360, radius])(root);
    const group = g.append("g").attr("transform", `translate(${width / 2},${height / 2})`);
    group.append("g").attr("fill", "none").attr("stroke", "#1e293b").selectAll("path").data(root.links()).join("path")
      .attr("d", d3.linkRadial<any, any>().angle((d: any) => d.x * Math.PI / 180).radius((d: any) => d.y) as any);
    const node = group.append("g").selectAll("g").data(root.descendants()).join("g")
      .attr("transform", (d: any) => `rotate(${d.x - 90}) translate(${d.y},0)`);
    node.append("circle").attr("r", 5).attr("fill", (d: any) => getNodeStyle(d.data).color).attr("stroke", (d: any) => d.data.id === selectedId ? "#fff" : "none").on("click", (e, d) => onNodeSelect(d.data));
    node.append("text").attr("dy", "0.31em").attr("x", (d: any) => d.x < 180 === !d.children ? 10 : -10).attr("text-anchor", (d: any) => d.x < 180 === !d.children ? "start" : "end").attr("transform", (d: any) => d.x >= 180 ? "rotate(180)" : null).attr("font-size", "10px").attr("fill", "#f1f5f9").text((d: any) => getShortName(d.data));
  };

  const renderPacking = (g: any, width: number, height: number) => {
    if (!processedData) return;
    const root = d3.hierarchy(buildHierarchy(processedData.nodes)).sum(d => d.value || 10).sort((a, b) => b.value! - a.value!);
    d3.pack().size([width, height]).padding(8)(root);
    const node = g.selectAll("g").data(root.descendants()).join("g").attr("transform", (d: any) => `translate(${d.x},${d.y})`).on("click", (e, d) => onNodeSelect(d.data));
    node.append("circle").attr("r", (d: any) => d.r).attr("fill", (d: any) => d.children ? "#0f172a" : getNodeStyle(d.data).color).attr("fill-opacity", (d: any) => d.children ? 0.3 : 0.8).attr("stroke", (d: any) => d.data.id === selectedId ? "#fff" : "#1e293b");
    node.filter((d: any) => !d.children && d.r > 20).append("text").attr("text-anchor", "middle").attr("dy", "0.3em").attr("font-size", (d: any) => Math.min(d.r / 3, 12)).attr("fill", "#fff").text((d: any) => getShortName(d.data));
  };

  const renderSankey = (g: any, width: number, height: number) => {
    if (!processedData) return;
    const { nodes, links } = processedData;
    const nodesSankey = nodes.map((d, i) => ({ ...d, depth: d.id.split('/').length, x: (d.id.split('/').length - 1) * (width / 5), y: 0 }));
    const depthGroups = d3.group(nodesSankey, d => d.depth);
    depthGroups.forEach((group, depth) => { const step = (height - 200) / (group.length + 1); group.forEach((n, i) => (n.y = (i + 1) * step + 100)); });
    const linksSankey = links.map(d => ({ source: nodesSankey.find(n => n.id === (d.source as any).id), target: nodesSankey.find(n => n.id === (d.target as any).id) })).filter(l => l.source && l.target);
    g.append("g").attr("fill", "none").attr("stroke", "#4f46e5").attr("stroke-opacity", 0.15).selectAll("path").data(linksSankey).join("path")
      .attr("d", (d: any) => { const x0 = d.source.x, y0 = d.source.y, x1 = d.target.x, y1 = d.target.y; return `M${x0},${y0}C${(x0+x1)/2},${y0} ${(x0+x1)/2},${y1} ${x1},${y1}`; }).attr("stroke-width", 2);
    const node = g.selectAll("g.sn").data(nodesSankey).join("g").attr("class", "sn").attr("transform", (d: any) => `translate(${d.x},${d.y})`).on("click", (e, d) => onNodeSelect(d));
    node.append("rect").attr("x", -5).attr("y", -15).attr("width", 10).attr("height", 30).attr("rx", 3).attr("fill", d => getNodeStyle(d).color).attr("stroke", d => d.id === selectedId ? "#fff" : "none");
    node.append("text").attr("x", 12).attr("dy", "0.35em").attr("font-size", "10px").attr("fill", "#f1f5f9").text(d => getShortName(d));
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#020617] cursor-crosshair">
      <svg ref={svgRef} className="w-full h-full absolute inset-0" />
      <div className="absolute bottom-6 right-6 w-32 h-32 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden pointer-events-none opacity-50 border-dashed">
         <div className="w-full h-full flex items-center justify-center">
            <i className="fas fa-map text-slate-800 text-3xl"></i>
         </div>
      </div>
    </div>
  );
};

export default TreeVisualizer;
