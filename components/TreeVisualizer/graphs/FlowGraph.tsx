
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
    zoomObj
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        console.log('=== FlowGraph useEffect Triggered ===', {
            hasGRef: !!gRef.current,
            hasSvgRef: !!svgRef.current,
            hasZoomObj: !!zoomObj,
            nodeCount: nodes.length,
            linkCount: links.length
        });

        if (!gRef.current || !svgRef.current || !zoomObj) {
            console.warn('FlowGraph: Early return - missing refs', {
                gRef: !!gRef.current,
                svgRef: !!svgRef.current,
                zoomObj: !!zoomObj
            });
            return;
        }

        const g = d3.select(gRef.current);
        const svg = d3.select(svgRef.current);
        g.selectAll('*').remove();

        console.log('=== FlowGraph Rendering ===');
        console.log('Nodes:', nodes.length, 'Links:', links.length);
        console.log('Dimensions:', width, 'x', height);
        console.log('Refs:', { g: !!gRef.current, svg: !!svgRef.current, zoom: !!zoomObj });

        if (nodes.length === 0) {
            console.warn('FlowGraph: No nodes to render');
            return;
        }

        // Create Dagre graph with LR layout for flow view
        const gGraph = new dagre.graphlib.Graph({ compound: true });
        gGraph.setGraph({
            rankdir: 'LR',          // Left-to-Right for flow
            ranksep: 80,            // Space between ranks
            nodesep: 40,            // Space between nodes
            marginx: 20,
            marginy: 20
        });
        gGraph.setDefaultEdgeLabel(() => ({}));

        // Add nodes to Dagre
        nodes.forEach(node => {
            gGraph.setNode(node.id, {
                label: node.name,
                width: Math.max(120, (node.name?.length || 5) * 9),
                height: node.kind === 'file' || node.kind === 'package' ? 60 : 40,
                kind: node.kind
            });
        });

        // Establish parent-child relationships for clustering
        nodes.forEach(node => {
            if (node._parentFile && node._isExpandedChild) {
                if (gGraph.hasNode(node._parentFile)) {
                    gGraph.setParent(node.id, node._parentFile);
                }
            }
        });

        // Add edges to Dagre
        links.forEach(link => {
            if (nodes.find(n => n.id === link.source) && nodes.find(n => n.id === link.target)) {
                gGraph.setEdge(link.source, link.target, {
                    source_type: link.source_type,
                    weight: link.weight,
                    relation: link.relation
                });
            }
        });

        // Run Dagre layout
        dagre.layout(gGraph);

        // Get node positions
        const nodePositions = new Map<string, any>();
        gGraph.nodes().forEach((n: any) => {
            const data = gGraph.node(n);
            if (data) nodePositions.set(n, { ...data, id: n });
        });

        console.log('FlowGraph: Layout complete. Positions:', nodePositions.size);
        if (nodePositions.size > 0) {
            const firstPos = nodePositions.values().next().value;
            console.log('FlowGraph: Sample position:', firstPos);
        }

        // Calculate cluster bounding boxes
        const clusterBoxes = new Map<string, any>();
        const parentChildGroups = groupNodesByParent(nodes);

        parentChildGroups.forEach((children, parentId) => {
            if (children.length === 0) return;
            const parentPos = nodePositions.get(parentId);
            if (!parentPos) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            children.forEach(child => {
                const childPos = nodePositions.get(child.id);
                if (childPos) {
                    minX = Math.min(minX, childPos.x - childPos.width / 2);
                    maxX = Math.max(maxX, childPos.x + childPos.width / 2);
                    minY = Math.min(minY, childPos.y - childPos.height / 2);
                    maxY = Math.max(maxY, childPos.y + childPos.height / 2);
                }
            });

            if (minX === Infinity) {
                minX = parentPos.x - parentPos.width / 2;
                maxX = parentPos.x + parentPos.width / 2;
                minY = parentPos.y - parentPos.height / 2;
                maxY = parentPos.y + parentPos.height / 2;
            }

            const padding = 15;
            clusterBoxes.set(parentId, {
                x: minX - padding,
                y: minY - padding,
                width: (maxX - minX) + padding * 2,
                height: (maxY - minY) + padding * 2,
                nodeCount: children.length
            });
        });

        // Render Clusters
        const clusterGroup = g.append('g').attr('class', 'clusters');
        clusterBoxes.forEach((box, parentId) => {
            const parentNode = nodes.find(n => n.id === parentId);
            clusterGroup.append('rect')
                .attr('x', box.x).attr('y', box.y)
                .attr('width', box.width).attr('height', box.height)
                .attr('rx', 8)
                .attr('fill', parentNode && isNodeExpanded(parentNode, expandedFileIds) ? 'rgba(16, 185, 129, 0.05)' : 'rgba(148, 163, 184, 0.03)')
                .attr('stroke', parentNode && isNodeExpanded(parentNode, expandedFileIds) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)')
                .attr('stroke-width', 1).attr('stroke-dasharray', '3,3');

            const labelNode = nodes.find(n => n.id === parentId);
            if (labelNode) {
                clusterGroup.append('text')
                    .attr('x', box.x).attr('y', box.y - 8)
                    .attr('fill', '#64748b').attr('font-size', '9px').attr('font-weight', '600').attr('font-style', 'italic')
                    .text(`${labelNode.name} (${box.nodeCount} items)`);
            }
        });

        // Render Edges
        const linkGroup = g.append('g').attr('class', 'links');
        gGraph.edges().forEach((edge: any) => {
            const source = nodePositions.get(edge.v);
            const target = nodePositions.get(edge.w);
            if (!source || !target) return;

            const edgeData = gGraph.edge(edge);
            const isInPath = isInTracePathLink(edge.v, edge.w, traceResult);

            const sourceX = source.x + source.width / 2;
            const sourceY = source.y + source.height / 2;
            const targetX = target.x - target.width / 2;
            const targetY = target.y + target.height / 2;
            const controlOffset = Math.abs(targetX - sourceX) * 0.5;

            const path = d3.path();
            path.moveTo(sourceX, sourceY);
            path.bezierCurveTo(sourceX + controlOffset, sourceY, targetX - controlOffset, targetY, targetX, targetY);

            const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
            const linkColor = isInPath ? '#00f2ff' : (isVirtual ? '#a855f7' : '#475569');
            const linkOpacity = edgeData?.weight !== undefined ? (0.2 + (edgeData.weight * 0.8)) : (isVirtual ? 0.6 : 0.7);

            linkGroup.append('path')
                .attr('d', path.toString())
                .attr('fill', 'none')
                .attr('stroke', linkColor)
                .attr('stroke-width', isInPath ? 3 : (isVirtual ? 2 : 1.5))
                .attr('stroke-opacity', isInPath ? 1 : linkOpacity)
                .style('filter', isInPath ? 'drop-shadow(0 0 6px #00f2ff)' : 'none')
                .style('animation', isInPath ? 'path-pulse 1.5s ease-in-out infinite' : null)
                .attr('stroke-dasharray', (isVirtual && !isInPath) ? '5,5' : null);
        });

        // Render Nodes
        const nodeGroup = g.selectAll('g.node').data(nodes).join('g')
            .attr('class', (d: any) => d._isExpandedChild ? 'node node-expanding' : 'node')
            .attr('transform', (d: any) => {
                const pos = nodePositions.get(d.id);
                return pos ? `translate(${pos.x - pos.width / 2},${pos.y - pos.height / 2})` : `translate(0,0)`;
            })
            .style('opacity', (d: any) => getNodeOpacity(d, expandedFileIds))
            .attr('cursor', 'pointer')
            .on('click', (e, d) => {
                e.stopPropagation();
                onNodeSelect(d);
            });

        nodeGroup.append('rect')
            .attr('width', (d: any) => nodePositions.get(d.id)?.width || 120)
            .attr('height', 40).attr('rx', 6)
            .attr('fill', (d: any) => getNodeFill(d, getAccent(d.kind || 'func'), isInTracePath(d.id, traceResult)))
            .attr('stroke', (d: any) => getNodeStroke(d, getAccent(d.kind || 'func'), isInTracePath(d.id, traceResult)))
            .attr('stroke-width', (d: any) => isInTracePath(d.id, traceResult) ? 3 : 2)
            .style('filter', (d: any) => isInTracePath(d.id, traceResult) ? 'drop-shadow(0 0 8px #00f2ff)' : 'none')
            .style('animation', (d: any) => isInTracePath(d.id, traceResult) ? 'pulse-glow 2s ease-in-out infinite' : null)
            .attr('stroke-dasharray', (d: any) => needsHydration(d) ? '4,2' : null);

        // Expand Buttons
        nodeGroup.each((d: any, i: number, nodes: any) => {
            const node = d3.select(nodes[i]);
            const pos = nodePositions.get(d.id);
            const width = pos?.width || 120;

            if (isExpandableNode(d) && onToggleFileExpansion) {
                const buttonGroup = node.append('g')
                    .attr('transform', `translate(${width - 20}, 12)`)
                    .style('opacity', isNodeExpanding(d, expandingFileId) ? 0.5 : 1)
                    .on('click', (e: any) => {
                        e.stopPropagation();
                        onToggleFileExpansion(d.id);
                    });

                buttonGroup.append('circle').attr('r', 8)
                    .attr('fill', isNodeExpanded(d, expandedFileIds) ? '#10b981' : '#64748b')
                    .attr('stroke', 'white').attr('stroke-width', 1);

                buttonGroup.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
                    .attr('fill', 'white').attr('font-size', '10px').attr('font-weight', 'bold')
                    .text(isNodeExpanding(d, expandingFileId) ? '...' : (isNodeExpanded(d, expandedFileIds) ? '−' : '+'));
            }

            node.append('text')
                .attr('x', isExpandableNode(d) && onToggleFileExpansion ? (width / 2) - 10 : width / 2)
                .attr('y', 24).attr('text-anchor', 'middle').attr('fill', '#f1f5f9')
                .attr('font-size', '11px').attr('font-weight', '600')
                .text((d: any) => d.name);
        });

        // Zoom to fit
        if (nodePositions.size > 0 && !skipZoom) {
            const allX = Array.from(nodePositions.values()).map(p => p.x);
            const allY = Array.from(nodePositions.values()).map(p => p.y);
            const minX = Math.min(...allX), maxX = Math.max(...allX);
            const minY = Math.min(...allY), maxY = Math.max(...allY);
            const contentWidth = maxX - minX + 200;
            const contentHeight = maxY - minY + 100;
            const scale = Math.min(width / contentWidth, height / contentHeight, 1.2);
            const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
            svg.call(zoomObj.transform, initialTransform);
        }

    }, [nodes, links, width, height, expandedFileIds, expandingFileId, traceResult, skipZoom, zoomObj, svgRef]);

    return <g ref={gRef} className="flow-graph" />;
};

export default FlowGraph;
