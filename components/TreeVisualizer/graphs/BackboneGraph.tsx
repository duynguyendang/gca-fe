
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { BackboneGraph as BackboneGraphType } from '../../../types';

interface BackboneGraphProps {
    data: BackboneGraphType;
    width: number;
    height: number;
    onNodeSelect: (node: any) => void;
    onFileSelect?: (filePath: string) => void;
    selectedFile?: string | null;
    highlightedPath?: string[] | null;
    svgRef: React.RefObject<SVGSVGElement>;
    zoomObj: d3.ZoomBehavior<SVGSVGElement, unknown> | null;
}

const BackboneGraph: React.FC<BackboneGraphProps> = ({
    data,
    width,
    height,
    onNodeSelect,
    onFileSelect,
    selectedFile,
    highlightedPath,
    svgRef,
    zoomObj
}) => {
    const gRef = useRef<SVGGElement>(null);

    useEffect(() => {
        if (!gRef.current || !svgRef.current || !zoomObj) return;
        const g = d3.select(gRef.current);
        const svg = d3.select(svgRef.current);
        g.selectAll('*').remove();

        if (!data.nodes || data.nodes.length === 0) {
            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#94a3b8')
                .text('No architecture backbone data available');
            return;
        }

        // Define markers
        const defs = svg.select('defs');
        if (defs.empty()) {
            svg.append('defs').append('marker')
                .attr('id', 'arrow-orange')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 8)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', '#f59e0b');

            svg.select('defs').append('marker')
                .attr('id', 'arrow-slate')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 8)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', '#475569');
        }

        // Create Dagre graph
        const gGraph = new dagre.graphlib.Graph({ compound: true });
        gGraph.setGraph({
            rankdir: 'LR',
            ranksep: 120,
            nodesep: 40,
            marginx: 40,
            marginy: 40
        });
        gGraph.setDefaultEdgeLabel(() => ({}));

        // Add File Clusters
        if (data.files) {
            data.files.forEach(file => {
                gGraph.setNode(file.path, {
                    label: file.path.split('/').pop(),
                    width: 0, height: 0,
                    kind: 'file-cluster',
                    id: file.path,
                    style: 'fill: rgba(14, 165, 233, 0.03); stroke: rgba(14, 165, 233, 0.15); stroke-dasharray: 4,4;'
                });
            });
        }

        // Add Nodes
        data.nodes.forEach(node => {
            let w = Math.max(140, (node.name.length) * 8);
            let h = 40;
            gGraph.setNode(node.id, {
                label: node.name,
                width: w,
                height: h,
                ...node
            });
            if (node.file_path) {
                gGraph.setParent(node.id, node.file_path);
            }
        });

        // Add Links
        data.links.forEach(link => {
            // Check if nodes exist
            if (gGraph.hasNode(link.source) && gGraph.hasNode(link.target)) {
                gGraph.setEdge(link.source, link.target, {
                    label: link.relation,
                    isCrossFile: link.isCrossFile
                });
            }
        });

        dagre.layout(gGraph);

        // Render Clusters
        const clusters: any[] = [];
        gGraph.nodes().forEach(v => {
            const node = gGraph.node(v);
            if (node.kind === 'file-cluster') {
                clusters.push({ ...node, id: v });
            }
        });

        const clusterGroup = g.append('g').attr('class', 'clusters');
        clusterGroup.selectAll('rect')
            .data(clusters)
            .join('rect')
            .attr('x', (d: any) => d.x - d.width / 2)
            .attr('y', (d: any) => d.y - d.height / 2)
            .attr('width', (d: any) => d.width)
            .attr('height', (d: any) => d.height)
            .attr('rx', 8)
            .attr('fill', 'rgba(14, 165, 233, 0.03)')
            .attr('stroke', 'rgba(14, 165, 233, 0.15)')
            .attr('stroke-dasharray', '4,4')
            .on('click', (e, d) => {
                if (onFileSelect) onFileSelect(d.id);
            });

        clusterGroup.selectAll('text')
            .data(clusters)
            .join('text')
            .attr('x', (d: any) => d.x - d.width / 2 + 10)
            .attr('y', (d: any) => d.y - d.height / 2 - 8)
            .text((d: any) => d.label)
            .attr('fill', '#0ea5e9')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold');

        // Render Links
        const linkGroup = g.append('g').attr('class', 'backbone-links');
        gGraph.edges().forEach(e => {
            const edge = gGraph.edge(e);
            const source = gGraph.node(e.v);
            const target = gGraph.node(e.w);

            const path = d3.path();
            const startX = source.x + source.width / 2;
            const startY = source.y;
            const endX = target.x - target.width / 2;
            const endY = target.y;

            path.moveTo(startX, startY);
            path.bezierCurveTo(startX + 80, startY, endX - 80, endY, endX, endY);

            linkGroup.append('path')
                .attr('d', path.toString())
                .attr('fill', 'none')
                .attr('stroke', edge.isCrossFile ? '#f59e0b' : 'rgba(71, 85, 105, 0.5)')
                .attr('stroke-width', edge.isCrossFile ? 2 : 1)
                .attr('stroke-opacity', () => {
                    if (!highlightedPath) return 1;
                    const vId = typeof e.v === 'string' ? e.v : (e.v as any).id;
                    const wId = typeof e.w === 'string' ? e.w : (e.w as any).id;
                    const active = highlightedPath.includes(vId) && highlightedPath.includes(wId);
                    return active ? 1 : 0.1;
                })
                .attr('marker-end', edge.isCrossFile ? 'url(#arrow-orange)' : 'url(#arrow-slate)');
        });

        // Render Nodes
        const processedNodes = gGraph.nodes()
            .map(v => ({ ...gGraph.node(v), id: v }))
            .filter((n: any) => n.kind !== 'file-cluster');

        const nodeGroup = g.append('g').attr('class', 'backbone-nodes')
            .selectAll('g')
            .data(processedNodes)
            .join('g')
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
            .attr('cursor', 'pointer')
            .on('click', (e, d) => onNodeSelect(d));

        nodeGroup.append('rect')
            .attr('x', (d: any) => -d.width / 2)
            .attr('y', (d: any) => -d.height / 2)
            .attr('width', (d: any) => d.width)
            .attr('height', (d: any) => d.height)
            .attr('rx', 4)
            .attr('fill', (d: any) => {
                if (d.gatewayType === 'entry') return 'rgba(16, 185, 129, 0.1)';
                if (d.gatewayType === 'exit') return 'rgba(245, 158, 11, 0.1)';
                return '#0f172a';
            })
            .attr('stroke', (d: any) => {
                if (d.gatewayType === 'entry') return '#10b981';
                if (d.gatewayType === 'exit') return '#f59e0b';
                return '#334155';
            })
            .attr('stroke-width', (d: any) => d.gatewayType ? 2 : 1)
            .style('opacity', (d: any) => {
                if (!highlightedPath) return 1;
                return highlightedPath.includes(d.id) ? 1 : 0.1;
            });

        nodeGroup.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .text((d: any) => d.label)
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .attr('font-weight', '500');

        nodeGroup.each(function (d: any) {
            if (d.gatewayType) {
                d3.select(this).append('text')
                    .attr('x', -d.width / 2 + 6)
                    .attr('y', -d.height / 2 - 4)
                    .text(d.gatewayType.toUpperCase())
                    .attr('fill', d.gatewayType === 'entry' ? '#10b981' : '#f59e0b')
                    .attr('font-size', '8px')
                    .attr('font-weight', 'black');
            }
        });

        // Initial Zoom Fit
        if (processedNodes.length > 0) {
            const initialScale = 0.8;
            const xCenter = (gGraph.graph().width || width) / 2;
            const yCenter = (gGraph.graph().height || height) / 2;
            svg.call(zoomObj.translateTo, xCenter, yCenter).call(zoomObj.scaleTo, initialScale);
        }

    }, [data, width, height, highlightedPath]);

    return <g ref={gRef} className="backbone-graph" />;
};

export default BackboneGraph;
