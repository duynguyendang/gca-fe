
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

        // Create layers to ensure text is always on top
        const circleGroup = g.append("g").attr("class", "circles");
        const labelGroup = g.append("g").attr("class", "labels");

        const descendants = hierarchy.descendants();

        // 1. Draw Circles (Background Layer)
        const circleSelection = circleGroup.selectAll("g")
            .data(descendants)
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

        // Folder Colors (Cyclic depth based)
        const getFolderColor = (depth: number) => {
            const colors = [
                'rgba(0, 242, 255, 0.05)',   // Cyan
                'rgba(139, 92, 246, 0.05)',  // Violet
                'rgba(236, 72, 153, 0.05)',  // Pink
                'rgba(16, 185, 129, 0.05)',  // Emerald
            ];
            return colors[depth % colors.length] || colors[0];
        };

        const getFolderStroke = (depth: number) => {
            const colors = [
                'rgba(0, 242, 255, 0.3)',
                'rgba(139, 92, 246, 0.3)',
                'rgba(236, 72, 153, 0.3)',
                'rgba(16, 185, 129, 0.3)',
            ];
            return colors[depth % colors.length] || colors[0];
        };

        circleSelection.append("circle")
            .attr("r", (d: any) => d.r)
            .attr("fill", (d: any) => d.children
                ? getFolderColor(d.depth)
                : (getAccent(d.data.kind, d.data.name) + "33"))
            .attr("stroke", (d: any) => d.children
                ? getFolderStroke(d.depth)
                : getAccent(d.data.kind, d.data.name))
            .attr("stroke-width", (d: any) => d.children ? 1.5 : 2);

        // 2. Draw Labels (Foreground Layer - always covers circles)
        // We use a separate data join for labels so they are physically last in DOM
        const labels = labelGroup.selectAll("g")
            .data(descendants)
            .join("g")
            .attr("transform", (d: any) => `translate(${d.x + 20},${d.y + 20})`)
            .style("pointer-events", "none"); // Click-through to circles

        // Group labels (Folders)
        labels.filter((d: any) => d.children && d.r > 30)
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "#ffff00") // Bright Yellow for Folders (High Vis)
            .attr("stroke", "rgba(0,0,0,0.95)") // Heavy black outline
            .attr("stroke-width", "3px")
            .style("paint-order", "stroke")
            .attr("font-size", (d: any) => Math.min(d.r / 4, 16))
            .attr("font-weight", "800")
            .text((d: any) => d.data.name);

        // File labels
        labels.filter((d: any) => !d.children && d.r > 8)
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "#ffffff") // White for Files
            .attr("stroke", "rgba(0,0,0,0.9)")
            .attr("stroke-width", "3px")
            .style("paint-order", "stroke")
            .attr("font-size", (d: any) => Math.max(Math.min(d.r / 2.5, 14), 10))
            .attr("font-weight", "700")
            .text((d: any) => d.data.name || d.data.id || '');

    }, [nodes, width, height, onNodeSelect]);

    return <g ref={gRef} className="treemap-graph" />;
};

export default TreeMapGraph;
