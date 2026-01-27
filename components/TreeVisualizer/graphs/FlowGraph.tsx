
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { PathResult } from '../../../utils/pathfinding';
import {
    getAccent,
    getNodeFill,
    getNodeStroke,
    getNodeOpacity,
    isExpandableNode,
    isNodeExpanded,
    isNodeExpanding,
    isInTracePath,
    isInTracePathLink,
    needsHydration,
    groupNodesByParent
} from '../utils/graphUtils';

interface FlowGraphProps {
    nodes: any[];
    links: any[];
    width: number;
    height: number;
    onNodeSelect: (node: any) => void;
    skipZoom?: boolean;
    traceResult?: PathResult | null;
    expandedFileIds: Set<string>;
    onToggleFileExpansion?: (fileId: string) => void;
    expandingFileId?: string | null;
    svgRef: React.RefObject<SVGSVGElement>;
    zoomObj: d3.ZoomBehavior<SVGSVGElement, unknown> | null;
    focusModeEnabled?: boolean;
    criticalPathNodeIds?: Set<string>;
}

const FlowGraph: React.FC<FlowGraphProps> = ({
    nodes,
    links,
    width,
    height,
    onNodeSelect,
    skipZoom = false,
    traceResult = null,
    expandedFileIds,
    onToggleFileExpansion,
    expandingFileId,
    svgRef,
    zoomObj,
    focusModeEnabled = false,
    criticalPathNodeIds = new Set()
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!gRef.current || !svgRef.current || !zoomObj) return;

        const g = d3.select(gRef.current);
        const svg = d3.select(svgRef.current);
        const transitionDuration = 750;
        const t = svg.transition().duration(transitionDuration).ease(d3.easeCubicInOut);

        // 1. Initialize Dagre
        const gGraph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
        gGraph.setGraph({
            rankdir: 'LR',
            ranksep: 100,
            nodesep: 50,
            marginx: 20,
            marginy: 20
        });
        gGraph.setDefaultEdgeLabel(() => ({}));

        // 2. First Pass: Add all "Parent" nodes (Files)
        nodes.forEach(node => {
            if (node.kind === 'file' || node.kind === 'package') {
                const nodeId = String(node.id);
                gGraph.setNode(nodeId, {
                    label: node.name,
                    width: 200,
                    height: 100,
                    kind: node.kind,
                    id: nodeId
                });
            }
        });

        // 3. Second Pass: Add all "Child" nodes (Symbols)
        nodes.forEach(node => {
            if (node.kind !== 'file' && node.kind !== 'package') {
                const nodeId = String(node.id);
                gGraph.setNode(nodeId, {
                    label: node.name,
                    width: 180,
                    height: 40,
                    kind: node.kind,
                    id: nodeId
                });

                if (node._parentFile && node._isExpandedChild) {
                    const parentId = String(node._parentFile);
                    if (nodeId !== parentId && gGraph.hasNode(parentId)) {
                        gGraph.setParent(nodeId, parentId);
                    }
                }
            }
        });

        // 4. Third Pass: Add edges
        links.forEach(link => {
            const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
            const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);

            if (!gGraph.hasNode(sourceId) || !gGraph.hasNode(targetId)) {
                console.warn('FlowGraph: Link dropped due to missing node:', {
                    source: sourceId,
                    target: targetId,
                    hasSource: gGraph.hasNode(sourceId),
                    hasTarget: gGraph.hasNode(targetId)
                });
                return;
            }
            if (sourceId === targetId) return;

            // Avoid edges between parent and its own child (visual clutter) for structural relations
            const parentOfSource = gGraph.parent(sourceId);
            const parentOfTarget = gGraph.parent(targetId);

            if ((parentOfSource === targetId || parentOfTarget === sourceId)) {
                // Only skip if relationship is structural, otherwise show the edge (e.g. imports, calls)
                const rel = link.relation || 'related';
                if (rel === 'defines' || rel === 'contains' || rel === 'member') {
                    return;
                }
            }

            try {
                gGraph.setEdge(sourceId, targetId, {
                    source_type: link.source_type || 'default',
                    weight: link.weight || 1,
                    relation: link.relation || 'related'
                });
            } catch (e) {
                console.warn('Failed to add edge:', sourceId, '->', targetId, e);
            }
        });

        // 5. Run Layout (with fallback)
        try {
            dagre.layout(gGraph);
        } catch (layoutError) {
            console.error('Dagre layout failed, attempting fallback:', layoutError);
            // Fallback: disable compound mode and retry
            try {
                const fallbackGraph = new dagre.graphlib.Graph();
                fallbackGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 });
                fallbackGraph.setDefaultEdgeLabel(() => ({}));
                gGraph.nodes().forEach(n => fallbackGraph.setNode(n, gGraph.node(n)));
                gGraph.edges().forEach(e => fallbackGraph.setEdge(e.v, e.w, gGraph.edge(e)));
                dagre.layout(fallbackGraph);
                // Copy positions back
                fallbackGraph.nodes().forEach(n => {
                    const pos = fallbackGraph.node(n);
                    if (gGraph.hasNode(n) && pos) {
                        const existing = gGraph.node(n);
                        existing.x = pos.x;
                        existing.y = pos.y;
                    }
                });
                console.warn('Fallback layout succeeded');
            } catch (fallbackError) {
                console.error('Fallback layout also failed:', fallbackError);
                return; // Abort rendering
            }
        }

        // Extract layout data
        const layoutNodes = gGraph.nodes().map(v => {
            const node = gGraph.node(v);
            return { ...node, id: v };
        });

        const layoutEdges = gGraph.edges().map(e => {
            const edge = gGraph.edge(e);
            const points = edge.points;
            return { ...edge, v: e.v, w: e.w, points };
        });

        // --- RENDER: CLUSTERS (Files) ---
        // Render clusters specifically for nodes that have children or are files
        const clusters = layoutNodes.filter(n => n.kind === 'file' || n.kind === 'package');

        const clusterGroup = g.select<SVGGElement>('.clusters').empty()
            ? g.append('g').attr('class', 'clusters')
            : g.select<SVGGElement>('.clusters');

        const clusterSelection = clusterGroup.selectAll<SVGGElement, any>('g.cluster')
            .data(clusters, (d: any) => d.id);

        // Exit
        clusterSelection.exit()
            .transition(t as any)
            .style('opacity', 0)
            .remove();

        // Enter
        const clusterEnter = clusterSelection.enter()
            .append('g')
            .attr('class', 'cluster')
            .attr('id', d => `cluster-${d.id}`)
            .style('opacity', 0);

        clusterEnter.append('rect')
            .attr('rx', 8)
            .attr('fill', 'rgba(148, 163, 184, 0.03)')
            .attr('stroke', 'rgba(148, 163, 184, 0.1)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');

        clusterEnter.append('text')
            .attr('fill', '#64748b')
            .attr('font-size', '9px')
            .attr('font-weight', '600')
            .attr('font-style', 'italic');

        // Update (Merge Enter + Existing)
        const clusterUpdate = clusterEnter.merge(clusterSelection);

        clusterUpdate.transition(t as any)
            .style('opacity', 1)
            .attr('transform', d => `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`);

        clusterUpdate.select('rect')
            .transition(t as any)
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('fill', (d: any) => isNodeExpanded({ id: d.id } as any, expandedFileIds) ? 'rgba(16, 185, 129, 0.05)' : 'rgba(148, 163, 184, 0.03)')
            .attr('stroke', (d: any) => isNodeExpanded({ id: d.id } as any, expandedFileIds) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)')
            .style('opacity', (d: any) => {
                if (!focusModeEnabled) return 1;
                // If any child is critical, keep cluster visible? Or just fade everything not critical?
                // Simple logic: fade clusters if focus mode is on, unless we define "critical clusters".
                // For now, let clusters fade slightly less than nodes to maintain structure.
                return 0.5;
            });

        clusterUpdate.select('text')
            .transition(t as any)
            .attr('x', 10) // Padding from left
            .attr('y', -5) // Slightly above top border
            .text((d: any) => d.label);


        // --- RENDER: LINKS ---
        const linkGroup = g.select<SVGGElement>('.links').empty()
            ? g.append('g').attr('class', 'links')
            : g.select<SVGGElement>('.links');

        const linkSelection = linkGroup.selectAll<SVGPathElement, any>('path')
            .data(layoutEdges, (d: any) => `${d.v}-${d.w}`);

        linkSelection.exit()
            .transition(t as any)
            .style('opacity', 0)
            .remove();

        const linkEnter = linkSelection.enter()
            .append('path')
            .attr('fill', 'none')
            .attr('stroke-opacity', 0);

        const linkUpdate = linkEnter.merge(linkSelection);

        linkUpdate.transition(t as any)
            .attr('d', (d: any) => {
                const points = d.points;
                const path = d3.path();
                path.moveTo(points[0].x, points[0].y);
                points.slice(1).forEach((p: any) => path.lineTo(p.x, p.y));
                return path.toString();
            })
            .attr('stroke', (d: any) => {
                // Focus Mode logic for Links
                if (focusModeEnabled) {
                    // If both source and target are critical, color it critical.
                    if (criticalPathNodeIds.has(d.v) && criticalPathNodeIds.has(d.w)) return '#00f2ff'; // Cyan
                    return '#334155'; // Dimmed
                }
                const isInPath = isInTracePathLink(d.v, d.w, traceResult);
                const isVirtual = d.source_type === 'virtual' || (d.relation && d.relation.startsWith('v:'));
                return isInPath ? '#00f2ff' : (isVirtual ? '#a855f7' : '#475569');
            })
            .attr('stroke-width', (d: any) => {
                if (focusModeEnabled) {
                    if (criticalPathNodeIds.has(d.v) && criticalPathNodeIds.has(d.w)) return 2.5;
                    return 1;
                }
                const isInPath = isInTracePathLink(d.v, d.w, traceResult);
                return isInPath ? 3 : (d.source_type === 'virtual' || (d.relation && d.relation.startsWith('v:')) ? 2 : 1.5);
            })
            .style('opacity', (d: any) => {
                if (focusModeEnabled) {
                    if (criticalPathNodeIds.has(d.v) && criticalPathNodeIds.has(d.w)) return 1;
                    return 0.1; // Very dim
                }
                return 1;
            })
            .attr('stroke-dasharray', (d: any) => {
                const isVirtual = d.source_type === 'virtual' || (d.relation && d.relation.startsWith('v:'));
                return (isVirtual) ? '5,5' : null;
            });


        // --- RENDER: NODES ---
        // For nodes, we want to distinguish between cluster containers (files when expanded) and leaf nodes.
        // Dagre's `nodes()` includes both.
        // We only want to draw specific "node cards" for things that are NOT acting purely as containers,
        // OR we draw them for everything but allow the 'rect' inside to be styled differently.
        // Requirements say: "File: width 200, height 100".

        const nodeSelection = g.selectAll<SVGGElement, any>('g.node')
            .data(layoutNodes, (d: any) => d.id);

        nodeSelection.exit()
            .transition(t as any)
            .style('opacity', 0)
            .remove();

        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'node')
            .style('opacity', 0)
            .attr('cursor', 'pointer')
            .on('click', (e, d) => {
                e.stopPropagation();
                // Find original node object to pass back
                const originalNode = nodes.find(n => n.id === d.id);
                if (originalNode) onNodeSelect(originalNode);
            });

        nodeEnter.append('rect')
            .attr('rx', 6);

        nodeEnter.append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('fill', '#f1f5f9')
            .attr('font-size', '11px')
            .attr('font-weight', '600');

        // Expand Button Group
        const expandBtn = nodeEnter.append('g').attr('class', 'expand-btn').style('display', 'none');
        expandBtn.append('circle').attr('r', 8).attr('fill', '#64748b').attr('stroke', 'white').attr('stroke-width', 1);
        expandBtn.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', 'white').attr('font-size', '10px').attr('font-weight', 'bold');

        const nodeUpdate = nodeEnter.merge(nodeSelection);

        // Apply Focus Mode transition to Group
        nodeUpdate.transition(t as any)
            .style('opacity', (d: any) => {
                if (focusModeEnabled) {
                    return criticalPathNodeIds.has(d.id) ? 1 : 0.2;
                }
                return 1;
            })
            .attr('transform', d => `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`);

        nodeUpdate.select('rect')
            .transition(t as any)
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('fill', (d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                if (!originalNode) return '#000';
                // If expanded file, maybe make it transparent since the cluster rect handles the BG?
                // Or keep it as the "header".
                // Based on requirements, files have valid nodes.
                if (originalNode.kind === 'file' && isNodeExpanded(originalNode, expandedFileIds)) {
                    return 'rgba(0,0,0,0)'; // Invisible, let cluster rect show
                }
                return getNodeFill(originalNode, getAccent(originalNode.kind || 'func'), isInTracePath(d.id, traceResult));
            })
            .attr('stroke', (d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                if (!originalNode) return 'none';

                // Focus Mode Glow
                if (focusModeEnabled && criticalPathNodeIds.has(d.id)) {
                    return '#00f2ff'; // Cyan glow color
                }

                if (originalNode.kind === 'file' && isNodeExpanded(originalNode, expandedFileIds)) return 'none';
                return getNodeStroke(originalNode, getAccent(originalNode.kind || 'func'), isInTracePath(d.id, traceResult));
            })
            .attr('stroke-width', (d: any) => {
                if (focusModeEnabled && criticalPathNodeIds.has(d.id)) return 3;
                return isInTracePath(d.id, traceResult) ? 3 : 2;
            })
            // Add Glow Filter effect if critical? (Optional enhancement)
            .style('filter', (d: any) => {
                if (focusModeEnabled && criticalPathNodeIds.has(d.id)) {
                    // return 'drop-shadow(0 0 5px #00f2ff)'; // Can be expensive
                    return null;
                }
                return null;
            });

        nodeUpdate.select('text.label')
            .transition(t as any)
            .attr('x', d => d.width / 2)
            .attr('y', 24)
            .text(d => d.label)
            .style('opacity', (d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                // If expanded file, the cluster label handles it? The prompt says "Ensure the file name stays at the top of the cluster".
                // We added a cluster label earlier. So maybe hide this one if expanded.
                if (originalNode && originalNode.kind === 'file' && isNodeExpanded(originalNode, expandedFileIds)) return 0;
                return 1;
            });

        // Update Expand Button
        nodeUpdate.select('.expand-btn')
            .style('display', (d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                return (originalNode && isExpandableNode(originalNode) && onToggleFileExpansion) ? 'block' : 'none';
            })
            .attr('transform', d => `translate(${d.width - 20}, 12)`)
            .on('click', (e, d: any) => {
                e.stopPropagation();
                onToggleFileExpansion?.(d.id);
            });

        nodeUpdate.select('.expand-btn circle')
            .attr('fill', (d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                if (!originalNode) return '#64748b';
                return isNodeExpanded(originalNode, expandedFileIds) ? '#10b981' : '#64748b';
            });

        nodeUpdate.select('.expand-btn text')
            .text((d: any) => {
                const originalNode = nodes.find(n => n.id === d.id);
                if (!originalNode) return '+';
                return isNodeExpanding(originalNode, expandingFileId) ? '...' : (isNodeExpanded(originalNode, expandedFileIds) ? '−' : '+');
            });


        // Zoom to fit (only on initial load or if explicitly requested)
        if (!skipZoom && nodes.length > 0) {
            // We can check if it's the very first render by checking a ref or similar,
            // but here we just rely on skipZoom prop passed from parent which is usually true after first interaction.
            // Actually, parent passes skipZoom=true usually.
        }

    }, [nodes, links, width, height, expandedFileIds, expandingFileId, traceResult, skipZoom, zoomObj, svgRef, focusModeEnabled, criticalPathNodeIds]);

    return <g ref={gRef} className="flow-graph" />;
};

export default FlowGraph;
