
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { buildHierarchy, getAccent } from '../utils/graphUtils';

interface TreeMapGraphProps {
    nodes: any[];
    width: number;
    height: number;
    onNodeSelect: (node: any, isNavigation?: boolean) => void;
}

const TreeMapGraph: React.FC<TreeMapGraphProps> = ({
    nodes,
    width,
    height,
    onNodeSelect
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!gRef.current) return;
        const g = d3.select(gRef.current);
        g.selectAll('*').remove();

        const validNodes = nodes || [];
        if (validNodes.length === 0) return;

        const hierarchy = d3.hierarchy(buildHierarchy(validNodes, true))
            .sum((d: any) => d.line_count || d.value || 1)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.pack().size([width - 40, height - 40]).padding(15)(hierarchy);

        const node = g.selectAll("g")
            .data(hierarchy.descendants())
            .join("g")
            .attr("transform", (d: any) => `translate(${d.x + 20},${d.y + 20})`)
            .attr("cursor", "pointer")
            .on("click", (e, d: any) => {
                const nodeData = d.data;
                if (nodeData._path || nodeData.id) {
                    onNodeSelect({
                        id: nodeData._path || nodeData.id,
                        name: nodeData.name,
                        kind: nodeData.kind || (d.children ? 'package' : 'file'),
                        _isFolder: !!d.children,
                        _isFile: nodeData._isFile
                    });
                }
            });

        node.append("circle")
            .attr("r", (d: any) => d.r)
            .attr("fill", (d: any) => d.children ? "rgba(255,255,255,0.05)" : "#0d171d")
            .attr("stroke", (d: any) => d.children ? "rgba(255,255,255,0.15)" : getAccent(d.data.kind))
            .attr("stroke-width", (d: any) => d.children ? 1 : 2);

        // Group labels
        node.filter((d: any) => d.children && d.r > 30)
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "rgba(255,255,255,0.5)")
            .attr("font-size", (d: any) => Math.min(d.r / 4, 14))
            .attr("font-weight", "700")
            .attr("pointer-events", "none")
            .text((d: any) => d.data.name);

        // File labels
        node.filter((d: any) => !d.children && d.r > 8)
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "white")
            .attr("font-size", (d: any) => Math.max(Math.min(d.r / 2.5, 12), 6))
            .attr("font-weight", "500")
            .attr("pointer-events", "none")
            .style("text-shadow", "0 1px 4px rgba(0,0,0,0.9)")
            .text((d: any) => d.data.name || d.data.id || '');

    }, [nodes, width, height, onNodeSelect]);

    return <g ref={gRef} className="treemap-graph" />;
};

export default TreeMapGraph;
