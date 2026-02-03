
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
    getAccent,
    getSymbol,
    getNodeStroke,
    getNodeOpacity,
    getLinkColor,
    getLinkOpacity,
    isVirtualLink,
    isExpandableNode,
    isNodeExpanded,
    isNodeExpanding,
    needsHydration,
    calculateNodeRadius
} from '../utils/graphUtils';

interface DiscoveryGraphProps {
    nodes: any[];
    links: any[];
    width: number;
    height: number;
    onNodeSelect: (node: any, isNavigation?: boolean) => void;
    onNodeHover: (node: any | null) => void;
    selectedId?: string;
    expandedFileIds: Set<string>;
    onToggleFileExpansion?: (fileId: string) => void;
    expandingFileId?: string | null;
}

const DiscoveryGraph: React.FC<DiscoveryGraphProps> = ({
    nodes,
    links,
    width,
    height,
    onNodeSelect,
    onNodeHover,
    selectedId,
    expandedFileIds,
    onToggleFileExpansion,
    expandingFileId
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!gRef.current) return;
        const g = d3.select(gRef.current);
        g.selectAll('*').remove(); // Clear previous

        const validNodes = nodes || [];
        const validLinks = links || [];
        // Clone links to avoid mutation issues with d3 force
        const simulationLinks = validLinks.map((l: any) => ({ ...l }));

        if (validNodes.length === 0) return;

        const nodeRadii = new Map<string, number>();
        validNodes.forEach(n => nodeRadii.set(n.id, calculateNodeRadius(n)));

        const simulation = d3.forceSimulation(validNodes)
            .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius((d: any) => (nodeRadii.get(d.id) || 30) + 20));

        const link = g.append("g").selectAll("line").data(simulationLinks).join("line")
            .attr("stroke", (d: any) => getLinkColor(d))
            .attr("stroke-width", (d: any) => isVirtualLink(d) ? 2 : 1)
            .attr("stroke-opacity", (d: any) => getLinkOpacity(d))
            .attr("stroke-dasharray", (d: any) => isVirtualLink(d) ? "5,5" : null);

        const nodeGroup = g.append("g").selectAll("g").data(validNodes).join("g")
            .attr("class", (d: any) => {
                let cls = 'node';
                if (d._isExpandedChild) cls += ' node-expanding';
                if (d._isPath) cls += ' path-active';
                return cls;
            })
            .style("opacity", (d: any) => getNodeOpacity(d, expandedFileIds))
            .attr("cursor", "pointer")
            .on("click", (e, d) => {
                e.stopPropagation();
                onNodeSelect(d);
            })
            .on("mouseenter", (e, d) => {
                onNodeHover(d);
                nodeGroup.style("opacity", (n: any) => n.id === d.id ? 1 : getNodeOpacity(n, expandedFileIds) * 0.15);
                link.style("opacity", (l: any) => (l.source as any).id === d.id || (l.target as any).id === d.id ? 1 : 0.05);
            })
            .on("mouseleave", () => {
                onNodeHover(null);
                nodeGroup.style("opacity", (d: any) => getNodeOpacity(d, expandedFileIds));
                link.style("opacity", 1);
            });

        nodeGroup.append("circle")
            .attr("r", (d: any) => (nodeRadii.get(d.id) || 15) + 6)
            .attr("fill", "transparent")
            .attr("stroke", (d: any) => getNodeStroke(d, getAccent(d.kind), false))
            .attr("stroke-width", 2)
            .attr("stroke-opacity", (d: any) => d.id === selectedId ? 1 : 0.2)
            .attr("stroke-dasharray", (d: any) => needsHydration(d) ? "4,2" : null)
            .style("filter", (d: any) => needsHydration(d) ? "drop-shadow(0 0 4px rgba(168, 85, 247, 0.3))" : `drop-shadow(0 0 8px ${getAccent(d.kind)})`);

        nodeGroup.append("circle")
            .attr("r", (d: any) => nodeRadii.get(d.id) || 15)
            .attr("fill", (d: any) => needsHydration(d) ? "rgba(168, 85, 247, 0.08)" : "#0a1118")
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

        // Expand Buttons
        nodeGroup.each((d: any, i: number, nodes: any) => {
            const node = d3.select(nodes[i]);
            const radius = nodeRadii.get(d.id) || 15;

            if (isExpandableNode(d) && onToggleFileExpansion) {
                const buttonGroup = node.append('g')
                    .attr('transform', `translate(${radius * 0.7}, ${-radius * 0.7})`)
                    .style('opacity', isNodeExpanding(d, expandingFileId) ? 0.5 : 1)
                    .on('click', (e: any) => {
                        e.stopPropagation();
                        onToggleFileExpansion(d.id);
                    });

                buttonGroup.append('circle').attr('r', 6)
                    .attr('fill', isNodeExpanded(d, expandedFileIds) ? '#10b981' : '#64748b')
                    .attr('stroke', 'white').attr('stroke-width', 0.5);

                buttonGroup.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
                    .attr('fill', 'white').attr('font-size', '8px').attr('font-weight', 'bold')
                    .text(isNodeExpanding(d, expandingFileId) ? '...' : (isNodeExpanded(d, expandedFileIds) ? '−' : '+'));
            }
        });

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);
            nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        return () => {
            simulation.stop();
        };
    }, [nodes, links, width, height, expandedFileIds, expandingFileId, selectedId]);

    return <g ref={gRef} className="discovery-graph" />;
};

export default DiscoveryGraph;
