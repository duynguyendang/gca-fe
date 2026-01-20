
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { ASTNode, FlatGraph } from '../../types';
import { useGraphData } from '../../hooks/useGraphData';
import { getShortName, getNodeStyle } from './utils/nodeStylers';

interface TreeVisualizerProps {
  data: ASTNode | FlatGraph;
  onNodeSelect: (node: any) => void;
  onNodeHover: (node: any | null) => void;
  mode: 'force' | 'radial' | 'circlePacking' | 'sankey';
  layoutStyle: 'organic' | 'flow';
  selectedId?: string;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, onNodeSelect, onNodeHover, mode, layoutStyle, selectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const processedData = useGraphData(data);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!processedData || !containerRef.current) return;
    
    // Set rendering state to true before heavy computation
    setIsRendering(true);

    // 1. Cleanup previous resources
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current.nodes([]);
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    
    // Explicitly clear listeners and content
    svg.on(".zoom", null);
    svg.selectAll("*").remove();
    
    const g = svg.append("g");

    // 2. Setup static elements
    svg.append("defs").selectAll("marker").data(["end"]).join("marker")
      .attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 25).attr("refY", 0)
      .attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
      .append("path").attr("fill", "#334155").attr("d", "M0,-5L10,0L0,5");

    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.1, 8])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    // 3. Mode-specific rendering
    let simulation: d3.Simulation<any, any> | undefined;
    if (mode === 'force') {
      const result = renderNetwork(g, width, height, zoom);
      simulation = result.simulation;
      simulationRef.current = simulation;
    }

    // Set rendering false after initial sync render is done
    // D3 transitions/simulations happen asynchronously but the setup is sync
    const timer = setTimeout(() => setIsRendering(false), 300);

    // Cleanup function for unmount or re-render
    return () => {
      clearTimeout(timer);
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current.nodes([]);
      }
    };
  }, [processedData, mode, layoutStyle, selectedId]);

  const renderNetwork = (g: any, width: number, height: number, zoom: any) => {
    if (!processedData) throw new Error("No data");
    const { nodes, links, degrees } = processedData;

    if (layoutStyle === 'organic') {
      nodes.forEach((n: any) => { n.fx = null; n.fy = null; });
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
      nodes.forEach((n: any) => calculateRank(n.id));
      const maxRank = Math.max(...Array.from(ranks.values()), 1);
      const rankGroups = d3.group(nodes, (n: any) => ranks.get(n.id) || 0);
      rankGroups.forEach((group, rank) => {
        const xStep = width / (group.length + 1);
        group.forEach((n: any, i) => {
          n.fx = (i + 1) * xStep;
          n.fy = (rank / maxRank) * (height - 200) + 100;
        });
      });
    }

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => Math.sqrt(degrees.get(d.id) || 1) * 10 + 45));

    if (layoutStyle === 'flow') simulation.stop();

    const link = g.append("g").selectAll("path").data(links).join("path")
      .attr("fill", "none").attr("stroke", "#1e293b").attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5).attr("marker-end", "url(#arrow)");

    const nodeGroup = g.append("g").selectAll("g").data(nodes).join("g")
      .attr("cursor", "pointer").on("click", (e: any, d: any) => onNodeSelect(d))
      .on("mouseenter", (e: any, d: any) => {
        onNodeHover(d);
        const related = new Set([d.id]);
        links.forEach(l => {
          const sId = (l.source as any).id; const tId = (l.target as any).id;
          if (sId === d.id) related.add(tId); if (tId === d.id) related.add(sId);
        });
        nodeGroup.transition().duration(200).style("opacity", (n: any) => related.has(n.id) ? 1 : 0.05);
        link.transition().duration(200).style("opacity", (l: any) => (l.source as any).id === d.id || (l.target as any).id === d.id ? 1 : 0.05);
      })
      .on("mouseleave", () => {
        onNodeHover(null);
        nodeGroup.transition().duration(200).style("opacity", 1);
        link.transition().duration(200).style("opacity", 0.6);
      });

    nodeGroup.append("circle").attr("r", (d: any) => Math.sqrt(degrees.get(d.id) || 1) * 8 + 4)
      .attr("fill", (d: any) => getNodeStyle(d).color).attr("stroke", (d: any) => d.id === selectedId ? "#fff" : "#020617")
      .attr("stroke-width", (d: any) => d.id === selectedId ? 3 : 1.5)
      .style("filter", (d: any) => `drop-shadow(0 0 10px ${getNodeStyle(d).glow})`);

    nodeGroup.append("text").attr("dy", "2.2em").attr("text-anchor", "middle").attr("font-size", "10px").attr("font-weight", "700").attr("fill", "#f1f5f9").text((d: any) => getShortName(d));
    nodeGroup.append("text").attr("dy", "3.6em").attr("text-anchor", "middle").attr("font-size", "7px").attr("fill", "#64748b").style("pointer-events", "none").text((d: any) => d.id.length > 30 ? '...' + d.id.slice(-27) : d.id);

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
          return (t) => { d.x = ix(t); d.y = iy(t); updatePositions(); return `translate(${d.x},${d.y})`; };
        });
    }

    if (selectedId) {
      const selected = nodes.find((n: any) => n.id === selectedId);
      if (selected) {
        d3.select(svgRef.current).transition().duration(750).call(zoom.transform,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-(selected as any).x || -width/2, -(selected as any).y || -height/2)
        );
      }
    }

    return { simulation };
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#020617] cursor-crosshair">
      {isRendering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/60 backdrop-blur-sm z-50 animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <i className="fas fa-project-diagram text-indigo-500 animate-pulse"></i>
          </div>
          <span className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Projecting Layout</span>
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full absolute inset-0" />
    </div>
  );
};

export default TreeVisualizer;
