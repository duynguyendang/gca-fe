
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
    calculateNodeRadius,
    getEntropyColor
} from '../utils/graphUtils';
import { SubMode } from '../../../context/AppContext';

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
    activeSubMode?: SubMode;
    highlightedNodeId?: string | null;
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
    expandingFileId,
    activeSubMode = 'NARRATIVE',
    highlightedNodeId
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!gRef.current) return;
        const g = d3.select(gRef.current);
        g.selectAll('*').remove(); // Clear previous

        const validNodes = nodes || [];
        const nodeSet = new Set(validNodes.map(n => n.id));

        // Filter links to ensure both ends exist in the current nodes set
        // This prevents "node not found" errors in D3 force simulations
        const validLinks = (links || []).filter(l => nodeSet.has(l.source) && nodeSet.has(l.target));

        // Clone links to avoid mutation issues with d3 force
        const simulationLinks = validLinks.map((l: any) => ({ ...l }));

        if (validNodes.length === 0) return;

        // --- Render Containers for Architecture Mode ---
        const containerGroup = g.append("g").attr("class", "containers");
        const updateContainers = () => {
            if (activeSubMode !== 'ARCHITECTURE') {
                containerGroup.selectAll('*').remove();
                return;
            }

            const groups = d3.group(validNodes, (d: any) => d._parentFile || d.id.split(':')[0] || 'root');
            const data: any[] = [];
            groups.forEach((nodes, key) => {
                if (nodes.length < 1) return;
                const x0 = d3.min(nodes, (d: any) => d.x - (nodeRadii.get(d.id) || 15) - 20) || 0;
                const x1 = d3.max(nodes, (d: any) => d.x + (nodeRadii.get(d.id) || 15) + 20) || 0;
                const y0 = d3.min(nodes, (d: any) => d.y - (nodeRadii.get(d.id) || 15) - 20) || 0;
                const y1 = d3.max(nodes, (d: any) => d.y + (nodeRadii.get(d.id) || 15) + 40) || 0;
                data.push({
                    id: key,
                    x: x0,
                    y: y0,
                    width: x1 - x0,
                    height: y1 - y0,
                    label: key.split('/').pop()?.toUpperCase() || 'MODULE'
                });
            });

            containerGroup.selectAll("g.container")
                .data(data, (d: any) => d.id)
                .join(
                    enter => {
                        const sel = enter.append("g").attr("class", "container");
                        sel.append("rect")
                            .attr("rx", 8)
                            .attr("fill", "rgba(45, 212, 191, 0.03)")
                            .attr("stroke", "rgba(45, 212, 191, 0.2)")
                            .attr("stroke-width", 1)
                            .attr("stroke-dasharray", "4,4");
                        sel.append("text")
                            .attr("font-size", "8px")
                            .attr("font-weight", "900")
                            .attr("fill", "rgba(45, 212, 191, 0.4)")
                            .attr("letter-spacing", "0.2em");
                        return sel;
                    },
                    update => update,
                    exit => exit.remove()
                )
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .each(function (d: any) {
                    const el = d3.select(this);
                    el.select("rect").attr("width", d.width).attr("height", d.height);
                    el.select("text").attr("x", 10).attr("y", -8).text(d.label);
                });
        };

        const nodeRadii = new Map<string, number>();
        validNodes.forEach(n => nodeRadii.set(n.id, calculateNodeRadius(n, undefined, activeSubMode)));

        // Define arrowhead for NARRATIVE mode
        g.append("defs").selectAll("marker")
            .data(["end"])
            .join("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 20)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("fill", activeSubMode === 'NARRATIVE' ? "#3b82f6" : "#475569")
            .attr("d", "M0,-5L10,0L0,5");

        const simulation = d3.forceSimulation(validNodes)
            .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(activeSubMode === 'ARCHITECTURE' ? 150 : 100))
            .force("charge", d3.forceManyBody().strength(activeSubMode === 'ARCHITECTURE' ? -600 : -400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius((d: any) => (nodeRadii.get(d.id) || 30) + 20));

        const link = g.append("g").selectAll("line").data(simulationLinks).join("line")
            .attr("stroke", (d: any) => activeSubMode === 'NARRATIVE' && d._isPath ? "#3b82f6" : getLinkColor(d))
            .attr("stroke-width", (d: any) => (activeSubMode === 'NARRATIVE' && d._isPath) ? 2.5 : (isVirtualLink(d) ? 2 : 1))
            .attr("stroke-opacity", (d: any) => getLinkOpacity(d))
            .attr("stroke-dasharray", (d: any) => isVirtualLink(d) ? "5,5" : null)
            .attr("class", (d: any) => activeSubMode === 'NARRATIVE' && d._isPath ? "marching-ants" : "")
            .attr("marker-end", activeSubMode === 'NARRATIVE' ? "url(#arrowhead)" : null);

        const nodeGroup = g.append("g").selectAll("g").data(validNodes).join("g")
            .attr("class", (d: any) => {
                let cls = 'node';
                if (d._isExpandedChild) cls += ' node-expanding';
                if (d._isPath) cls += ' path-active';
                if (d.id === highlightedNodeId) cls += ' node-highlighted';
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
                const nodeBaseOpacity = getNodeOpacity(d, expandedFileIds);
                nodeGroup.style("opacity", (n: any) => n.id === d.id ? 1 : getNodeOpacity(n, expandedFileIds) * 0.15);
                link.style("opacity", (l: any) => (l.source as any).id === d.id || (l.target as any).id === d.id ? 1 : 0.05);
            })
            .on("mouseleave", () => {
                onNodeHover(null);
                nodeGroup.style("opacity", (d: any) => activeSubMode === 'NARRATIVE' ? (d._isPath ? 1 : 0.1) : getNodeOpacity(d, expandedFileIds));
                link.style("opacity", (d: any) => activeSubMode === 'NARRATIVE' ? (d._isPath ? 1 : 0.2) : 1);
            })
            .style("opacity", (d: any) => activeSubMode === 'NARRATIVE' ? (d._isPath ? 1 : 0.1) : getNodeOpacity(d, expandedFileIds));

        nodeGroup.append("circle")
            .attr("r", (d: any) => (nodeRadii.get(d.id) || 15) + 6)
            .attr("fill", "transparent")
            .attr("stroke", (d: any) => activeSubMode === 'ENTROPY' ? getEntropyColor(d) : getNodeStroke(d, getAccent(d.kind), false))
            .attr("stroke-width", (d: any) => (activeSubMode === 'ENTROPY' && (d.metadata?.complexity > 70)) ? 4 : 2)
            .attr("stroke-opacity", (d: any) => d.id === selectedId ? 1 : 0.2)
            .attr("stroke-dasharray", (d: any) => needsHydration(d) ? "4,2" : null)
            .style("filter", (d: any) => {
                if (activeSubMode === 'ENTROPY') return `drop-shadow(0 0 12px ${getEntropyColor(d)})`;
                return needsHydration(d) ? "drop-shadow(0 0 4px rgba(168, 85, 247, 0.3))" : `drop-shadow(0 0 8px ${getAccent(d.kind)})`;
            });

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
            updateContainers();
        });

        return () => {
            simulation.stop();
        };
    }, [nodes, links, width, height, expandedFileIds, expandingFileId, selectedId, activeSubMode, highlightedNodeId]);

    return <g ref={gRef} className="discovery-graph" />;
};

export default DiscoveryGraph;
