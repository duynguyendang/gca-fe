import React, { useEffect } from 'react';
import * as d3 from 'd3';
import { usePaginatedGraph, useInfiniteScroll } from '../hooks/usePaginatedGraph';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

interface PaginatedGraphVisualizationProps {
  apiBase: string;
  projectId: string;
  query: string;
  width: number;
  height: number;
  pageSize?: number;
  onNodeClick?: (node: any) => void;
  onNodeHover?: (node: any | null) => void;
}

/**
 * PaginatedGraphVisualization - A React component that displays large graphs
 * with cursor-based lazy loading and infinite scroll support.
 *
 * Features:
 * - Cursor-based pagination for efficient memory usage
 * - Infinite scroll to automatically load more data
 * - Loading indicators and error handling
 * - Progress indicator showing loaded vs total nodes
 */
export const PaginatedGraphVisualization: React.FC<PaginatedGraphVisualizationProps> = ({
  apiBase,
  projectId,
  query,
  width,
  height,
  pageSize = 100,
  onNodeClick,
  onNodeHover
}) => {
  const {
    nodes,
    links,
    loading,
    error,
    hasMore,
    totalNodes,
    totalLinks,
    loadMore,
    reset
  } = usePaginatedGraph(apiBase, projectId, query, pageSize);

  // Load initial data on mount
  useEffect(() => {
    reset();
    loadMore();
  }, [query, projectId]);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const loadMoreTriggerRef = useInfiniteScroll(loadMore, hasMore, loading);

  // Render D3 graph
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(50))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Create container
    const g = svg.append('g');

    // Add links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight || 1));

    // Add nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d: any) => d.kind === 'file' ? '#ff7f0e' : '#1f77b4')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Add labels
    const text = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d: any) => d.name || d.id)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4);

    // Add hover and click handlers
    node
      .on('mouseover', (event, d) => {
        onNodeHover?.(d);
        d3.select(event.currentTarget)
          .attr('stroke', '#ff0')
          .attr('stroke-width', 3);
      })
      .on('mouseout', (event) => {
        onNodeHover?.(null);
        d3.select(event.currentTarget)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
      })
      .on('click', (event, d) => {
        onNodeClick?.(d);
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      text
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height, onNodeClick, onNodeHover]);

  return (
    <div className="paginated-graph-container" style={{ position: 'relative' }}>
      {/* Progress indicator */}
      <div className="graph-progress" style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        <div>Loaded: {nodes.length} / {totalNodes} nodes</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {Math.round((nodes.length / totalNodes) * 100)}%
        </div>
      </div>

      {/* D3 Graph */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      />

      {/* Error message */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={() => {
            reset();
            loadMore();
          }}
        />
      )}

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          <LoadingSpinner />
        </div>
      )}

      {/* Load more trigger for infinite scroll */}
      {hasMore && (
        <div
          ref={loadMoreTriggerRef as any}
          style={{ height: 20 }}
        />
      )}

      {/* Manual load more button (shown if not loading) */}
      {hasMore && !loading && (
        <button
          onClick={() => loadMore()}
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            background: '#1f77b4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Load More ({nodes.length} / {totalNodes})
        </button>
      )}

      {/* End of data indicator */}
      {!hasMore && nodes.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: 'rgba(0, 200, 0, 0.1)',
          color: '#008000',
          borderRadius: '4px'
        }}>
          Loaded all {nodes.length} nodes
        </div>
      )}
    </div>
  );
};

export default PaginatedGraphVisualization;
