
import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { ASTNode, FlatGraph, BackboneGraph, BackboneNode, BackboneLink } from '../../types';
import { useGraphData } from '../../hooks/useGraphData';
import { PathResult } from '../../utils/pathfinding';

interface TreeVisualizerProps {
  data: ASTNode | FlatGraph;
  onNodeSelect: (node: any) => void;
  onNodeHover: (node: any | null) => void;
  mode: 'flow' | 'map' | 'discovery' | 'backbone';
  layoutStyle?: 'organic' | 'flow';
  selectedId?: string;
  fileScopedData?: { nodes: any[]; links: any[] };
  skipFlowZoom?: boolean;
  tracePathResult?: PathResult | null;
  // Progressive expansion props
  expandedFileIds?: Set<string>;
  onToggleFileExpansion?: (fileId: string) => void;
  expandingFileId?: string | null;
  // Backbone mode props
  backboneData?: BackboneGraph | null;
  selectedFileInBackbone?: string | null;
  highlightedPath?: string[] | null;
  onFileSelectInBackbone?: (filePath: string) => void;
  isBackboneLoading?: boolean;
}

const buildHierarchy = (nodes: any[], useFilePath = true) => {
  const root: any = { name: "root", children: {}, _isFolder: true };
  nodes.forEach(node => {
    if (!node || !node.id) return;
    const idPath = useFilePath && node.metadata?.file_path ? node.metadata.file_path : (node.id.split(':')[0]);
    const parts = idPath.split('/').filter(Boolean);
    if (parts.length === 0) return;
    let current = root;
    parts.forEach((part: string, i: number) => {
      const isFile = i === parts.length - 1;
      if (!current.children) current.children = {};
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          children: {},
          _isFolder: !isFile,
          _isFile: isFile,
          _path: parts.slice(0, i + 1).join('/')
        };
      }
      if (isFile) {
        const existing = current.children[part];
        const lineCount = node.metadata?.line_count || (node.end_line - node.start_line) || node.value || existing?.value || 1;
        current.children[part] = {
          ...existing,
          ...node,
          name: part,
          value: lineCount,
          _isFolder: false,
          _isFile: true,
          _path: parts.join('/')
        };
      }
      current = current.children[part];
    });
  });

  const convert = (node: any): any => {
    const childrenArr = Object.values(node.children || {}).map(convert);
    const hasChildren = childrenArr.length > 0;
    return {
      name: node.name,
      _isFolder: node._isFolder,
      _isFile: node._isFile,
      _path: node._path,
      line_count: node.value,
      ...(hasChildren ? { children: childrenArr } : { value: node.value || 1 })
    };
  };

  return { name: "root", _isFolder: true, children: Object.values(root.children).map(convert) };
};

// Helper to check if a link is virtual
const isVirtualLink = (link: any): boolean => {
  // Check source_type property or if relation starts with 'v:'
  if (link.source_type === 'virtual') return true;
  const relation = link.relation || '';
  return relation.startsWith('v:');
};

// Helper to get link color based on source type
const getLinkColor = (link: any): string => {
  if (isVirtualLink(link)) {
    return '#a855f7'; // Purple for virtual links
  }
  return '#475569'; // Default slate color for AST links
};

// Helper to get link opacity based on weight
const getLinkOpacity = (link: any): number => {
  if (link.weight !== undefined) {
    // Map weight (0-1) to opacity (0.2-1)
    return 0.2 + (link.weight * 0.8);
  }
  return isVirtualLink(link) ? 0.6 : 0.7;
};

// Helper to check if a node is in the traced path
const isInTracePath = (nodeId: string, pathResult: PathResult | null): boolean => {
  if (!pathResult) return false;
  return pathResult.path.includes(nodeId);
};

// Helper to check if a link is in the traced path
const isInTracePathLink = (sourceId: string, targetId: string, pathResult: PathResult | null): boolean => {
  if (!pathResult) return false;
  return pathResult.links.some(link => {
    const s = typeof link.source === 'string' ? link.source : link.source.id;
    const t = typeof link.target === 'string' ? link.target : link.target.id;
    return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
  });
};

// Helper to check if a node needs hydration (doesn't have code)
const needsHydration = (node: any): boolean => {
  return !node.code && node.kind !== 'file' && node.kind !== 'package' && node.kind !== 'folder';
};

// Helper to get node fill color based on hydration state
const getNodeFill = (node: any, accentColor: string, isInPath: boolean): string => {
  if (isInPath) return 'rgba(0, 242, 255, 0.15)';
  if (needsHydration(node)) return 'rgba(168, 85, 247, 0.08)';
  return `rgba(${hexToRgb(accentColor)}, 0.15)`;
};

// Helper to get node stroke color based on hydration state
const getNodeStroke = (node: any, accentColor: string, isInPath: boolean): string => {
  if (isInPath) return '#00f2ff';
  if (needsHydration(node)) return 'rgba(168, 85, 247, 0.4)';
  return accentColor;
};

// Helper to group child nodes by their parent file
const groupNodesByParent = (nodes: any[]): Map<string, any[]> => {
  const groups = new Map<string, any[]>();

  nodes.forEach(node => {
    if (node._parentFile) {
      if (!groups.has(node._parentFile)) {
        groups.set(node._parentFile, []);
      }
      groups.get(node._parentFile)!.push(node);
    }
  });

  return groups;
};

// Helper to check if a node has children in the current graph
const hasChildNodes = (nodeId: string, nodes: any[]): boolean => {
  return nodes.some(n => n._parentFile === nodeId);
};

// Helper to get all child nodes for a parent
const getChildNodes = (parentId: string, nodes: any[]): any[] => {
  return nodes.filter(n => n._parentFile === parentId);
};

// Helper to check if a node is expandable (is a file node)
const isExpandableNode = (node: any): boolean => {
  return node.kind === 'file' || node._isFile || node.kind === 'package';
};

// Helper to check if a node is expanded
const isNodeExpanded = (node: any, expandedFileIds: Set<string>): boolean => {
  if (!node.id) return false;
  return expandedFileIds.has(node.id);
};

// Helper to check if a node is currently expanding
const isNodeExpanding = (node: any, expandingFileId: string | null): boolean => {
  if (!expandingFileId || !node.id) return false;
  return expandingFileId === node.id;
};

// Helper to get expansion icon
const getExpansionIcon = (node: any, expandedFileIds: Set<string>): string => {
  return isNodeExpanded(node, expandedFileIds) ? 'fa-minus' : 'fa-plus';
};

// Helper to check if focus mode is active (any file is expanded)
const isFocusModeActive = (expandedFileIds: Set<string>): boolean => {
  return expandedFileIds.size > 0;
};

// Helper to check if a node should be visible in focus mode
// Returns true if: focus mode is not active, OR node is an expanded file, OR node is a child of an expanded file
const shouldShowInFocusMode = (node: any, expandedFileIds: Set<string>): boolean => {
  if (!isFocusModeActive(expandedFileIds)) return true;

  // Show if this node is an expanded file
  if (isNodeExpanded(node, expandedFileIds)) return true;

  // Show if this node is a child of an expanded file
  if (node._parentFile && expandedFileIds.has(node._parentFile)) return true;

  return false;
};

// Helper to get node opacity based on focus mode
const getNodeOpacity = (node: any, expandedFileIds: Set<string>, defaultOpacity: number = 1): number => {
  if (!isFocusModeActive(expandedFileIds)) return defaultOpacity;

  // Full opacity for expanded files and their children
  if (shouldShowInFocusMode(node, expandedFileIds)) return 1;

  // Dim other nodes
  return 0.2;
};

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  data,
  onNodeSelect,
  onNodeHover,
  mode,
  selectedId,
  fileScopedData,
  skipFlowZoom = false,
  tracePathResult = null,
  expandedFileIds = new Set<string>(),
  onToggleFileExpansion,
  expandingFileId = null,
  backboneData = null,
  selectedFileInBackbone = null,
  highlightedPath = null,
  onFileSelectInBackbone,
  isBackboneLoading = false
}) => {
  console.log('=== TreeVisualizer MOUNTED/RENDERED ===');
  console.log('Props:', {
    mode,
    'fileScopedData?.nodes?.length': fileScopedData?.nodes?.length,
    'fileScopedData?.links?.length': fileScopedData?.links?.length,
    'expandedFileIds.size': expandedFileIds.size,
    'expandingFileId': expandingFileId
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const processedData = useGraphData(data);
  const prevModeRef = useRef(mode);

  const getSymbol = (kind: string) => {
    switch (kind?.toLowerCase()) {
      case 'func': return 'Σ';
      case 'struct': return '{}';
      case 'interface': return 'I';
      case 'file': return '◫';
      default: return '◈';
    }
  };

  const getAccent = (kind: string) => {
    switch (kind?.toLowerCase()) {
      case 'func': return '#00f2ff';
      case 'struct': return '#10b981';
      case 'interface': return '#f59e0b';
      case 'file': return '#0ea5e9';
      case 'package': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  const calculateNodeRadius = useCallback((node: any, lineCount?: number) => {
    const lineCountVal = lineCount || node.metadata?.line_count || node.value || node.end_line - node.start_line + 1 || 20;
    return Math.sqrt(lineCountVal) * 3 + 8;
  }, []);

  const renderFlow = useCallback((nodes: any[], links: any[], width: number, height: number, svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, zoom: any, skipZoom = false, traceResult: PathResult | null = null) => {
    console.log('=== renderFlow START ===');
    console.log('nodes:', nodes.length, 'links:', links.length, 'skipZoom:', skipZoom);

    if (!gRef.current) {
      console.warn('renderFlow: gRef.current is null');
      return;
    }

    const g = gRef.current;
    g.selectAll('*').remove();

    // Create Dagre graph with LR layout for flow view
    const gGraph = new dagre.graphlib.Graph();
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
    // This must be done before adding edges and running layout
    nodes.forEach(node => {
      if (node._parentFile && node._isExpandedChild) {
        // Check if parent exists in the graph
        if (gGraph.hasNode(node._parentFile)) {
          gGraph.setParent(node.id, node._parentFile);
        }
      }
    });

    // Add edges to Dagre with metadata
    links.forEach(link => {
      if (nodes.find(n => n.id === link.source) && nodes.find(n => n.id === link.target)) {
        gGraph.setEdge(link.source, link.target, {
          source_type: link.source_type,
          weight: link.weight,
          relation: link.relation
        });
      }
    });

    // Run Dagre layout (now with clustering)
    dagre.layout(gGraph);

    // Get node positions
    const nodePositions = new Map<string, any>();
    gGraph.nodes().forEach((n: any) => {
      const data = gGraph.node(n);
      if (data) nodePositions.set(n, { ...data, id: n });
    });

    console.log('Dagre layout complete:', nodePositions.size, 'positions');

    // Debug: check gGraph state
    console.log('gGraph nodes:', gGraph.nodes());
    console.log('gGraph edges:', gGraph.edges());

    // Calculate cluster bounding boxes for expanded files
    const clusterBoxes = new Map<string, { x: number; y: number; width: number; height: number; nodeCount: number }>();
    const parentChildGroups = groupNodesByParent(nodes);

    parentChildGroups.forEach((children, parentId) => {
      if (children.length === 0) return;

      const parentPos = nodePositions.get(parentId);
      if (!parentPos) return;

      // Calculate bounding box from child positions
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

      // If no child positions found, use parent position
      if (minX === Infinity) {
        minX = parentPos.x - parentPos.width / 2;
        maxX = parentPos.x + parentPos.width / 2;
        minY = parentPos.y - parentPos.height / 2;
        maxY = parentPos.y + parentPos.height / 2;
      }

      // Add padding for the bounding box
      const padding = 15;
      const box = {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
        nodeCount: children.length
      };

      clusterBoxes.set(parentId, box);
      console.log(`Cluster for ${parentId}:`, box);
    });

    // Render cluster bounding boxes
    const clusterGroup = g.append('g').attr('class', 'clusters');
    clusterBoxes.forEach((box, parentId) => {
      const parentNode = nodes.find(n => n.id === parentId);

      clusterGroup.append('rect')
        .attr('class', 'cluster-bounding-box')
        .attr('x', box.x)
        .attr('y', box.y)
        .attr('width', box.width)
        .attr('height', box.height)
        .attr('rx', 8)
        .attr('fill', parentNode && isNodeExpanded(parentNode, expandedFileIds) ? 'rgba(16, 185, 129, 0.05)' : 'rgba(148, 163, 184, 0.03)')
        .attr('stroke', parentNode && isNodeExpanded(parentNode, expandedFileIds) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .style('opacity', 0)
        .transition()
        .duration(400)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      // Add cluster label
      const labelNode = nodes.find(n => n.id === parentId);
      if (labelNode) {
        clusterGroup.append('text')
          .attr('x', box.x)
          .attr('y', box.y - 8)
          .attr('fill', '#64748b')
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .attr('font-style', 'italic')
          .text(`${labelNode.name} (${box.nodeCount} items)`)
          .style('opacity', 0)
          .transition()
          .duration(400)
          .delay(100)
          .ease(d3.easeCubicOut)
          .style('opacity', 0.6);
      }
    });

    // Draw curved edges (smooth bezier connections)
    const linkGroup = g.append('g').attr('class', 'links');
    const edges = gGraph.edges();
    console.log('Edges array:', edges);
    console.log('Edges count:', edges.length);

    if (edges.length === 0) {
      console.log('No edges found - checking links parameter');
      console.log('Links passed to renderFlow:', links?.length);
    }

    edges.forEach((edge: any) => {
      const source = nodePositions.get(edge.v);
      const target = nodePositions.get(edge.w);
      if (!source || !target) return;

      const edgeData = gGraph.edge(edge);
      const isInPath = isInTracePathLink(edge.v, edge.w, traceResult);

      // Smooth bezier curve from right side of source to left side of target
      const sourceX = source.x + source.width / 2;
      const sourceY = source.y + source.height / 2;
      const targetX = target.x - target.width / 2;
      const targetY = target.y + target.height / 2;

      // Calculate control points for smooth curve
      const controlOffset = Math.abs(targetX - sourceX) * 0.5;

      const path = d3.path();
      path.moveTo(sourceX, sourceY);
      path.bezierCurveTo(
        sourceX + controlOffset, sourceY,  // control point 1
        targetX - controlOffset, targetY,  // control point 2
        targetX, targetY
      );

      const pathData = path.toString();
      console.log('Bezier path:', pathData.substring(0, 50) + '...');

      // Determine styling based on edge type
      const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
      const linkColor = isInPath ? '#00f2ff' : (isVirtual ? '#a855f7' : '#475569');
      const linkOpacity = edgeData?.weight !== undefined ? (0.2 + (edgeData.weight * 0.8)) : (isVirtual ? 0.6 : 0.7);

      const pathElement = linkGroup.append('path')
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', linkColor)
        .attr('stroke-width', isInPath ? 3 : (isVirtual ? 2 : 1.5))
        .attr('stroke-opacity', isInPath ? 1 : linkOpacity)
        .style('filter', isInPath ? 'drop-shadow(0 0 6px #00f2ff)' : 'none')
        .style('animation', isInPath ? 'path-pulse 1.5s ease-in-out infinite' : null);

      // Add dashed line for virtual edges
      if (isVirtual && !isInPath) {
        pathElement.attr('stroke-dasharray', '5,5');
      }
    });

    // Draw nodes
    const nodeGroup = g.selectAll('g.node').data(nodes).join('g')
      .attr('class', (d: any) => {
        const baseClass = 'node';
        if (d._isExpandedChild) return `${baseClass} node-expanding`;
        return baseClass;
      })
      .attr('transform', (d: any) => {
        const pos = nodePositions.get(d.id);
        if (pos) {
          return `translate(${pos.x - pos.width / 2},${pos.y - pos.height / 2})`;
        }
        return `translate(100, 100)`;
      })
      .style('opacity', (d: any) => getNodeOpacity(d, expandedFileIds))
      .attr('cursor', 'pointer')
      .on('click', (e, d) => {
        console.log('Clicked node:', d);
        onNodeSelect(d);
      });

    nodeGroup.append('rect')
      .attr('width', (d: any) => {
        const pos = nodePositions.get(d.id);
        return pos?.width || 120;
      })
      .attr('height', 40)
      .attr('rx', 6)
      .attr('fill', (d: any) => getNodeFill(d, getAccent(d.kind || 'func'), isInTracePath(d.id, traceResult)))
      .attr('stroke', (d: any) => getNodeStroke(d, getAccent(d.kind || 'func'), isInTracePath(d.id, traceResult)))
      .attr('stroke-width', (d: any) => isInTracePath(d.id, traceResult) ? 3 : 2)
      .style('filter', (d: any) => {
        if (isInTracePath(d.id, traceResult)) {
          return 'drop-shadow(0 0 8px #00f2ff) drop-shadow(0 0 15px #00f2ff)';
        }
        return 'none';
      })
      .style('animation', (d: any) => isInTracePath(d.id, traceResult) ? 'pulse-glow 2s ease-in-out infinite' : null)
      .attr('stroke-dasharray', (d: any) => needsHydration(d) ? '4,2' : null);

    // Add expand/collapse button for file nodes
    nodeGroup.each((d: any, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      const pos = nodePositions.get(d.id);
      const width = pos?.width || 120;

      if (isExpandableNode(d) && onToggleFileExpansion) {
        // Add expand/collapse icon button
        const buttonGroup = node.append('g')
          .attr('class', 'expand-button')
          .attr('transform', `translate(${width - 20}, 12)`)
          .attr('cursor', 'pointer')
          .style('opacity', isNodeExpanding(d, expandingFileId) ? 0.5 : 1)
          .style('animation', !isNodeExpanded(d, expandedFileIds) && !isNodeExpanding(d, expandingFileId) ? 'button-pulse 2s ease-in-out infinite' : null)
          .on('click', (e: any) => {
            e.stopPropagation(); // Prevent node selection
            console.log('[Expand] Toggle file:', d.id);
            onToggleFileExpansion(d.id);
          });

        buttonGroup.append('circle')
          .attr('r', 8)
          .attr('fill', isNodeExpanded(d, expandedFileIds) ? '#10b981' : '#64748b')
          .attr('stroke', 'white')
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 0 4px rgba(0,0,0,0.3))')
          .style('transition', 'all 0.3s ease');

        buttonGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(isNodeExpanding(d, expandingFileId) ? '...' : (isNodeExpanded(d, expandedFileIds) ? '−' : '+'));
      }

      // Add node name (with offset for expand button)
      node.append('text')
        .attr('class', 'node-label')
        .attr('x', isExpandableNode(d) && onToggleFileExpansion ? (width / 2) - 10 : width / 2)
        .attr('y', 24)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f1f5f9')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text((d: any) => d.name);
    });

    // Center view on content (only if not skipping zoom for same-file clicks)
    if (nodePositions.size > 0 && !skipZoom) {
      const allX = Array.from(nodePositions.values()).map(p => p.x);
      const allY = Array.from(nodePositions.values()).map(p => p.y);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      const contentWidth = maxX - minX + 200;
      const contentHeight = maxY - minY + 100;
      const scale = Math.min(width / contentWidth, height / contentHeight, 1.2);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-centerX, -centerY);
      svg.call(zoom.transform, initialTransform);
    }

    console.log('=== renderFlow END ===');
  }, [onNodeSelect, needsHydration, getNodeFill, getNodeStroke, expandedFileIds, onToggleFileExpansion, expandingFileId, isExpandableNode, isNodeExpanded, isNodeExpanding, getNodeOpacity, groupNodesByParent]);

  const renderForceMode = useCallback((nodes: any[], links: any[], width: number, height: number) => {
    if (!gRef.current) return;
    const g = gRef.current;

    const validLinks = links || [];
    const validNodes = nodes || [];
    if (validNodes.length === 0) return;

    const nodeRadii = new Map<string, number>();
    validNodes.forEach(n => nodeRadii.set(n.id, calculateNodeRadius(n)));

    const simulation = d3.forceSimulation(validNodes as any)
      .force("link", d3.forceLink(validLinks).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => (nodeRadii.get(d.id) || 30) + 20));

    const link = g.append("g").selectAll("line").data(validLinks).join("line")
      .attr("stroke", (d: any) => getLinkColor(d))
      .attr("stroke-width", (d: any) => isVirtualLink(d) ? 2 : 1)
      .attr("stroke-opacity", (d: any) => getLinkOpacity(d))
      .attr("stroke-dasharray", (d: any) => isVirtualLink(d) ? "5,5" : null);

    const nodeGroup = g.append("g").selectAll("g").data(validNodes).join("g")
      .attr("class", (d: any) => {
        const baseClass = 'node';
        if (d._isExpandedChild) return `${baseClass} node-expanding`;
        return baseClass;
      })
      .style("opacity", (d: any) => getNodeOpacity(d, expandedFileIds))
      .attr("cursor", "pointer")
      .on("click", (e, d) => onNodeSelect(d))
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

    // Add expand/collapse button for file nodes
    nodeGroup.each((d: any, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      const radius = nodeRadii.get(d.id) || 15;

      if (isExpandableNode(d) && onToggleFileExpansion) {
        // Add expand/collapse icon button (positioned at top-right of node)
        const buttonGroup = node.append('g')
          .attr('class', 'expand-button')
          .attr('transform', `translate(${radius * 0.7}, ${-radius * 0.7})`)
          .attr('cursor', 'pointer')
          .style('opacity', isNodeExpanding(d, expandingFileId) ? 0.5 : 1)
          .style('animation', !isNodeExpanded(d, expandedFileIds) && !isNodeExpanding(d, expandingFileId) ? 'button-pulse 2s ease-in-out infinite' : null)
          .on('click', (e: any) => {
            e.stopPropagation(); // Prevent node selection
            console.log('[Expand] Toggle file:', d.id);
            onToggleFileExpansion(d.id);
          });

        buttonGroup.append('circle')
          .attr('r', 6)
          .attr('fill', isNodeExpanded(d, expandedFileIds) ? '#10b981' : '#64748b')
          .attr('stroke', 'white')
          .attr('stroke-width', 0.5)
          .style('filter', 'drop-shadow(0 0 3px rgba(0,0,0,0.5))')
          .style('transition', 'all 0.3s ease');

        buttonGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', 'white')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(isNodeExpanding(d, expandingFileId) ? '...' : (isNodeExpanded(d, expandedFileIds) ? '−' : '+'));
      }
    });

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [onNodeSelect, onNodeHover, calculateNodeRadius, selectedId, needsHydration, getNodeStroke, expandedFileIds, onToggleFileExpansion, expandingFileId, isExpandableNode, isNodeExpanded, isNodeExpanding, getNodeOpacity]);

  const renderDagreMode = useCallback((nodes: any[], links: any[], width: number, height: number) => {
    const g = gRef.current!;

    const gGraph = new dagre.graphlib.Graph();
    gGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 });
    gGraph.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(n => {
      gGraph.setNode(n.id, {
        label: n.name,
        width: Math.max(100, (n.name?.length || 10) * 9),
        height: 35
      });
    });

    // Store link data with edge metadata
    const linkDataMap = new Map<string, any>();
    links.forEach(l => {
      if (nodes.find(n => n.id === l.source) && nodes.find(n => n.id === l.target)) {
        const edgeKey = `${l.source}->${l.target}`;
        linkDataMap.set(edgeKey, {
          source_type: l.source_type,
          weight: l.weight,
          relation: l.relation
        });
        gGraph.setEdge(l.source, l.target);
      }
    });

    try {
      dagre.layout(gGraph);
    } catch (e) {
      console.warn('Dagre layout failed:', e);
    }

    const nodePositions = new Map<string, any>();
    gGraph.nodes().forEach((n: any) => {
      const data = gGraph.node(n);
      if (data) nodePositions.set(n, { ...data, id: n });
    });

    g.append("g").selectAll("path").data(links).join("path")
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
        const edgeKey = `${d.source}->${d.target}`;
        const edgeData = linkDataMap.get(edgeKey);
        const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
        return isVirtual ? '#a855f7' : 'rgba(255,255,255,0.05)';
      })
      .attr("stroke-width", (d: any) => {
        const edgeKey = `${d.source}->${d.target}`;
        const edgeData = linkDataMap.get(edgeKey);
        const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
        return isVirtual ? 2 : 1;
      })
      .attr("stroke-opacity", (d: any) => {
        const edgeKey = `${d.source}->${d.target}`;
        const edgeData = linkDataMap.get(edgeKey);
        if (edgeData?.weight !== undefined) {
          return 0.2 + (edgeData.weight * 0.8);
        }
        const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
        return isVirtual ? 0.6 : 0.05;
      })
      .attr("stroke-dasharray", (d: any) => {
        const edgeKey = `${d.source}->${d.target}`;
        const edgeData = linkDataMap.get(edgeKey);
        const isVirtual = edgeData?.source_type === 'virtual' || (edgeData?.relation && edgeData.relation.startsWith('v:'));
        return isVirtual ? '5,5' : null;
      })
      .attr("d", (d: any) => {
        const source = nodePositions.get(d.source);
        const target = nodePositions.get(d.target);
        if (!source || !target) return '';
        const midY = (source.y + target.y) / 2;
        return `M${source.x},${source.y + 17}C${source.x},${midY} ${target.x},${midY} ${target.x},${target.y - 17}`;
      });

    const nodeGroup = g.selectAll("g.node").data(nodes).join("g")
      .attr("class", (d: any) => {
        const baseClass = 'node';
        if (d._isExpandedChild) return `${baseClass} node-expanding`;
        return baseClass;
      })
      .attr("transform", (d: any) => {
        const pos = nodePositions.get(d.id);
        if (pos) return `translate(${pos.x - pos.width / 2},${pos.y - pos.height / 2})`;
        return `translate(${(nodes.indexOf(d) % 4) * 150 + 100},${Math.floor(nodes.indexOf(d) / 4) * 80 + 100})`;
      })
      .style("opacity", (d: any) => getNodeOpacity(d, expandedFileIds))
      .attr("cursor", "pointer")
      .on("click", (e, d) => onNodeSelect(d));

    nodeGroup.append("rect")
      .attr("width", (d: any) => {
        const pos = nodePositions.get(d.id);
        return pos?.width || Math.max(100, (d.name?.length || 10) * 9);
      })
      .attr("height", 35)
      .attr("rx", 6)
      .attr("fill", (d: any) => getNodeFill(d, getAccent(d.kind), false))
      .attr("stroke", (d: any) => getNodeStroke(d, getAccent(d.kind), false))
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d: any) => needsHydration(d) ? "4,2" : null);

    nodeGroup.append("text")
      .attr("x", (d: any) => {
        const pos = nodePositions.get(d.id);
        return (pos?.width || Math.max(100, (d.name?.length || 10) * 9)) / 2;
      })
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .attr("fill", "#f1f5f9")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text((d: any) => d.name);

    // Add expand/collapse button for file nodes
    nodeGroup.each((d: any, i: number, nodes: any) => {
      const node = d3.select(nodes[i]);
      const pos = nodePositions.get(d.id);
      const width = pos?.width || Math.max(100, (d.name?.length || 10) * 9);

      if (isExpandableNode(d) && onToggleFileExpansion) {
        // Add expand/collapse icon button
        const buttonGroup = node.append('g')
          .attr('class', 'expand-button')
          .attr('transform', `translate(${width - 18}, 8)`)
          .attr('cursor', 'pointer')
          .style('opacity', isNodeExpanding(d, expandingFileId) ? 0.5 : 1)
          .style('animation', !isNodeExpanded(d, expandedFileIds) && !isNodeExpanding(d, expandingFileId) ? 'button-pulse 2s ease-in-out infinite' : null)
          .on('click', (e: any) => {
            e.stopPropagation(); // Prevent node selection
            console.log('[Expand] Toggle file:', d.id);
            onToggleFileExpansion(d.id);
          });

        buttonGroup.append('circle')
          .attr('r', 7)
          .attr('fill', isNodeExpanded(d, expandedFileIds) ? '#10b981' : '#64748b')
          .attr('stroke', 'white')
          .attr('stroke-width', 0.5)
          .style('filter', 'drop-shadow(0 0 3px rgba(0,0,0,0.5))')
          .style('transition', 'all 0.3s ease');

        buttonGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', 'white')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(isNodeExpanding(d, expandingFileId) ? '...' : (isNodeExpanded(d, expandedFileIds) ? '−' : '+'));
      }
    });
  }, [onNodeSelect, needsHydration, getNodeFill, getNodeStroke, expandedFileIds, onToggleFileExpansion, expandingFileId, isExpandableNode, isNodeExpanded, isNodeExpanding, getNodeOpacity, groupNodesByParent]);

  const renderBackbone = useCallback((graphData: BackboneGraph, width: number, height: number, svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, zoom: any) => {
    if (!gRef.current) return;
    const g = gRef.current;
    g.selectAll('*').remove();

    console.log('=== renderBackbone START ===', graphData);

    // Create Dagre graph for backbone layout
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
    if (graphData.files) {
      graphData.files.forEach(file => {
        gGraph.setNode(file.path, {
          label: file.path.split('/').pop(),
          width: 0, height: 0, // Let Dagre calculate based on children
          kind: 'file-cluster',
          id: file.path,
          style: 'fill: rgba(14, 165, 233, 0.03); stroke: rgba(14, 165, 233, 0.15); stroke-dasharray: 4,4;'
        });
      });
    }

    // Add Nodes
    graphData.nodes.forEach(node => {
      let width = Math.max(140, (node.name.length) * 8);
      let height = 40;

      gGraph.setNode(node.id, {
        label: node.name,
        width,
        height,
        ...node
      });

      // Group by file if applicable
      if (node.file_path) {
        gGraph.setParent(node.id, node.file_path);
      }
    });

    // Add Links
    graphData.links.forEach(link => {
      gGraph.setEdge(link.source, link.target, {
        label: link.relation,
        isCrossFile: link.isCrossFile,
        style: link.isCrossFile ? 'stroke: #f59e0b; stroke-width: 2.5px;' : 'stroke: #475569; stroke-width: 1px;'
      });
    });

    dagre.layout(gGraph);

    // Render Clusters (Files)
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
        if (onFileSelectInBackbone) onFileSelectInBackbone(d.id);
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

    // Render Links with smooth curves
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
      path.bezierCurveTo(
        startX + 80, startY,
        endX - 80, endY,
        endX, endY
      );

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

    // Define markers
    const defs = svg.append('defs');
    defs.append('marker')
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

    // Gateway labels
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

    // Zoom to fit
    if (processedNodes.length > 0) {
      const initialScale = 0.8;
      const xCenter = (gGraph.graph().width || width) / 2;
      const yCenter = (gGraph.graph().height || height) / 2;
      svg.call(zoom.translateTo, xCenter, yCenter).call(zoom.scaleTo, initialScale);
    }
  }, [onNodeSelect, onFileSelectInBackbone, selectedFileInBackbone, highlightedPath]);

  const renderCirclePacking = useCallback((nodes: any[], width: number, height: number) => {
    if (!gRef.current) return;
    const g = gRef.current;

    const validNodes = nodes || [];
    if (validNodes.length === 0) return;

    // Build hierarchy with folder/package grouping
    const hierarchy = d3.hierarchy(buildHierarchy(validNodes, true))
      .sum(d => d.line_count || d.value || 1)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.pack().size([width - 40, height - 40]).padding(15)(hierarchy);

    // Draw circles
    const node = g.selectAll("g").data(hierarchy.descendants()).join("g")
      .attr("transform", d => `translate(${d.x + 20},${d.y + 20})`)
      .attr("cursor", "pointer")
      .on("click", (e, d) => {
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
      .attr("r", d => d.r)
      .attr("fill", d => d.children ? "rgba(255,255,255,0.05)" : "#0d171d")
      .attr("stroke", d => d.children ? "rgba(255,255,255,0.15)" : getAccent((d.data as any).kind))
      .attr("stroke-width", d => d.children ? 1 : 2);

    // Group labels for folders/packages
    const groupLabels = node.filter(d => d.children && d.r > 30);

    groupLabels.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", d => Math.min(d.r / 4, 14))
      .attr("font-weight", "700")
      .attr("pointer-events", "none")
      .text(d => d.data.name);

    // File/node labels
    const fileLabels = node.filter(d => !d.children && d.r > 8);

    fileLabels.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", d => Math.max(Math.min(d.r / 2.5, 12), 6))
      .attr("font-weight", "500")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 4px rgba(0,0,0,0.9)")
      .text(d => d.data.name || d.data.id || '');
  }, [onNodeSelect]);

  const renderRadial = useCallback((nodes: any[], width: number, height: number) => {
    const g = gRef.current!;
    const hierarchy = d3.hierarchy(buildHierarchy(nodes, true));
    const tree = d3.tree().size([2 * Math.PI, Math.min(width, height) / 2 - 100]);
    tree(hierarchy);

    g.attr("transform", `translate(${width / 2},${height / 2})`);

    g.append("g").selectAll("path").data(hierarchy.links()).join("path")
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.04)")
      .attr("d", d3.linkRadial<any, any>().angle((d: any) => d.x).radius((d: any) => d.y) as any);

    const nodeGroup = g.append("g").selectAll("g").data(hierarchy.descendants()).join("g")
      .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
      .attr("cursor", "pointer")
      .on("click", (e, d) => onNodeSelect(d.data));

    nodeGroup.append("circle")
      .attr("r", d => d.children ? 5 : Math.max(3, Math.sqrt((d.data.line_count || d.value || 1)) * 2))
      .attr("fill", (d: any) => d.children ? "rgba(255,255,255,0.3)" : getAccent((d.data as any).kind))
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-width", 1);

    const label = nodeGroup.filter(d => d.y > 50).append("text")
      .attr("dy", "0.31em")
      .attr("x", (d: any) => d.x < Math.PI ? 8 : -8)
      .attr("text-anchor", (d: any) => d.x < Math.PI ? "start" : "end")
      .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("font-size", "9px")
      .style("text-shadow", "0 1px 4px rgba(0,0,0,0.9)")
      .text((d: any) => (d.data as any).name);
  }, [onNodeSelect]);

  useEffect(() => {
    console.log('=== TreeVisualizer useEffect triggered ===');
    console.log('processedData:', !!processedData);
    console.log('containerRef.current:', !!containerRef.current);
    console.log('svgRef.current:', !!svgRef.current);
    console.log('mode:', mode);
    console.log('fileScopedData:', fileScopedData);

    if (!processedData || !containerRef.current || !svgRef.current) {
      console.log('Early return: missing deps');
      return;
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    console.log('Container dimensions:', width, 'x', height);
    if (width === 0 || height === 0) {
      console.log('Early return: zero dimensions');
      return;
    }

    const svg = d3.select(svgRef.current);
    console.log('SVG selected:', svg.size);

    if (gRef.current) {
      gRef.current.remove();
      console.log('Removed existing g');
    }

    gRef.current = svg.append("g");
    const g = gRef.current;
    console.log('Created new g');

    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 5])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);
    console.log('Zoom attached');

    console.log('==== TREEVISUALIZER EFFECT RUNNING ====');
    console.log('mode:', mode);
    console.log('processedData exists:', !!processedData);
    console.log('fileScopedData exists:', !!fileScopedData);

    const { nodes, links } = processedData || { nodes: [], links: [] };

    console.log('Mode:', mode, '| nodes count:', nodes?.length, '| links count:', links?.length);

    if (mode === 'flow') {
      console.log('Flow mode check - fileScopedData:', fileScopedData ? 'exists' : 'null');
      if (fileScopedData?.nodes?.length > 0) {
        console.log('✓ Calling renderFlow with', fileScopedData.nodes.length, 'nodes');
        renderFlow(fileScopedData.nodes, fileScopedData.links, width, height, svg, zoom, skipFlowZoom, tracePathResult);
      } else {
        console.log('✗ No fileScopedData.nodes - not rendering flow');
      }
    } else if (mode === 'discovery') {
      // Use fileScopedData links if available, otherwise use processedData
      const discoveryNodes = fileScopedData?.nodes?.length > 0 ? fileScopedData.nodes : nodes;
      const discoveryLinks = fileScopedData?.links?.length > 0 ? fileScopedData.links : links;
      console.log('Discovery mode - using nodes:', discoveryNodes?.length, 'links:', discoveryLinks?.length);
      if (discoveryNodes?.length > 0) {
        return renderForceMode(discoveryNodes, discoveryLinks || [], width, height);
      }
    } else if (mode === 'map') {
      const mapNodes = fileScopedData?.nodes?.length > 0 ? fileScopedData.nodes : nodes;
      if (mapNodes?.length > 0) {
        renderCirclePacking(mapNodes, width, height);
      }
    } else if (mode === 'backbone') {
      console.log('Backbone mode - rendering:', backboneData);
      if (backboneData && backboneData.nodes && backboneData.nodes.length > 0) {
        renderBackbone(backboneData, width, height, svg, zoom);
      } else if (!isBackboneLoading) {
        // Show specific empty state for backbone
        const g = gRef.current!;
        g.selectAll('*').remove();
        g.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .text('No architecture backbone data available');
      }
    }
  }, [processedData, mode, onNodeSelect, onNodeHover, fileScopedData, renderFlow, backboneData, renderBackbone, isBackboneLoading]);

  // Separate effect for handling selection highlight without rebuilding graph
  useEffect(() => {
    if (mode === 'flow' && selectedId && gRef.current) {
      // Update selection highlight without rebuilding
      const g = gRef.current;
      g.selectAll('g.node').each(function (d: any) {
        const nodeGroup = d3.select(this);
        const rect = nodeGroup.select('rect');
        if (d.id === selectedId) {
          rect.attr('stroke-width', 3)
            .attr('stroke', '#00f2ff');
        } else {
          rect.attr('stroke-width', 2)
            .attr('stroke', (nd: any) => getAccent(nd.kind));
        }
      });
    }
  }, [selectedId, mode]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900">
      <svg ref={svgRef} className="w-full h-full absolute inset-0" style={{ background: '#0f172a' }} />
      {(!processedData || (processedData?.nodes?.length === 0 && !fileScopedData?.nodes?.length)) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-project-diagram text-slate-700 text-4xl mb-4"></i>
            <p className="text-slate-600 text-xs uppercase tracking-widest">No data loaded</p>
            <p className="text-slate-700 text-[10px] mt-2">Select a file to view its architecture</p>
          </div>
        </div>
      )}
    </div>
  );
};

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '148,163,184';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export default TreeVisualizer;
