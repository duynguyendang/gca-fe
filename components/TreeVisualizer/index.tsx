
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ASTNode, FlatGraph } from '../../types';
import { useGraphData } from '../../hooks/useGraphData';
import { SubMode } from '../../context/UIContext';
import { logger } from '../../logger';
import DiscoveryGraph from './graphs/DiscoveryGraph';
import TreeMapGraph from './graphs/TreeMapGraph';
import OKFConceptDetail from './graphs/OKFConceptDetail';


interface TreeVisualizerProps {
  data: ASTNode | FlatGraph;
  onNodeSelect: (node: any, isNavigation?: boolean) => void;
  onNodeHover: (node: any | null) => void;
  mode: 'map' | 'discovery' | 'architecture' | 'narrative';
  selectedId?: string;
  fileScopedData?: { nodes: any[]; links: any[] };

  expandedFileIds?: Set<string>;
  onToggleFileExpansion?: (fileId: string) => void;
  expandingFileId?: string | null;
  isLoading?: boolean;
  focusModeEnabled?: boolean;
  criticalPathNodeIds?: Set<string>;
  activeSubMode?: SubMode;
  highlightedNodeId?: string | null;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  data,
  onNodeSelect,
  onNodeHover,
  mode,
  selectedId,
  fileScopedData,

  expandedFileIds = new Set<string>(),
  onToggleFileExpansion,
  expandingFileId = null,
  isLoading = false,
  focusModeEnabled = false,
  criticalPathNodeIds = new Set(),
  activeSubMode = 'NARRATIVE',
  highlightedNodeId,
}) => {
  logger.log('=== TreeVisualizer Render (Start) ===', {
    mode,
    fileScopedDataInfo: {
      hasData: !!fileScopedData,
      nodes: fileScopedData?.nodes?.length || 0,
      links: fileScopedData?.links?.length || 0,
      isEmpty: !fileScopedData || (fileScopedData.nodes?.length === 0 && fileScopedData.links?.length === 0)
    },
    isLoading
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoomObj, setZoomObj] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [selectedOKFConceptId, setSelectedOKFConceptId] = useState<string | null>(null);
  const processedData = useGraphData(data);

  // Find a node by ID in the fileScopedData (used for OKF bridge navigation)
  const findNodeById = useCallback((id: string): any | null => {
    const allNodes = fileScopedData?.nodes || nodes;
    return allNodes.find((n: any) => n.id === id) || null;
  }, [fileScopedData, nodes]);

  // Intercept node selection — detect OKF concept clicks and show overlay
  const handleNodeSelect = useCallback((node: any, isNavigation?: boolean) => {
    if (node?.role === 'okf_concept') {
      setSelectedOKFConceptId(node.id);
      // Still forward to parent so the node gets highlighted in the graph
      onNodeSelect(node, isNavigation);
    } else if (selectedOKFConceptId) {
      // Clicking a non-OKF node dismisses the OKF overlay
      setSelectedOKFConceptId(null);
      onNodeSelect(node, isNavigation);
    } else {
      onNodeSelect(node, isNavigation);
    }
  }, [onNodeSelect, selectedOKFConceptId]);

  // Navigate to a source symbol from an OKF bridge link
  const handleOKFNavigateToSymbol = useCallback((symbolId: string) => {
    const targetNode = findNodeById(symbolId);
    if (targetNode) {
      setSelectedOKFConceptId(null); // Close OKF overlay
      onNodeSelect(targetNode, true);
    } else {
      // Node not in current graph — still try to select by creating a stub
      onNodeSelect({ id: symbolId, name: symbolId.split('#').pop() || symbolId, _isMissingCode: true }, true);
    }
  }, [findNodeById, onNodeSelect]);

  // Close OKF overlay on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedOKFConceptId) {
        setSelectedOKFConceptId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedOKFConceptId]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Zoom - runs after dimensions are set (which means SVG is rendered)
  useEffect(() => {
    if (!svgRef.current) {
      logger.log('Zoom init: svgRef not ready');
      return;
    }

    if (dimensions.width === 0 || dimensions.height === 0) {
      logger.log('Zoom init: dimensions not ready');
      return;
    }

    logger.log('Zoom init: Creating zoom behavior');
    const svg = d3.select(svgRef.current);

    // Create zoom-layer if it doesn't exist
    const rootG = svg.select('g.zoom-layer');
    if (rootG.empty()) {
      svg.append('g').attr('class', 'zoom-layer');
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 5])
      .on('zoom', (event) => {
        svg.select('g.zoom-layer').attr('transform', event.transform);
      });

    svg.call(zoom);
    setZoomObj(() => zoom);  // Wrap in function so React doesn't treat zoom as state updater
    logger.log('Zoom init: Zoom object set!');

  }, [dimensions]);

  const { nodes, links } = processedData || { nodes: [], links: [] };
  const { width, height } = dimensions;

  if (width === 0 || height === 0) return <div ref={containerRef} className="w-full h-full bg-slate-900" />;

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 backdrop-blur-[1px] transition-all duration-300">
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[#0d171d]/80 border border-[#00f2ff]/20 shadow-[0_0_30px_-5px_#00f2ff30]">
            <div className="w-6 h-6 rounded-full border-2 border-t-[#00f2ff] border-r-transparent border-b-[#00f2ff]/30 border-l-transparent animate-spin"></div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00f2ff] animate-pulse">Loading Graph...</span>
          </div>
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full absolute inset-0" style={{ background: '#0f172a' }} onClick={() => selectedOKFConceptId && setSelectedOKFConceptId(null)}>
        <g className="zoom-layer">
          {mode === 'discovery' && (
            <DiscoveryGraph
              nodes={fileScopedData?.nodes?.length ? fileScopedData.nodes : nodes}
              links={fileScopedData?.nodes?.length ? (fileScopedData.links || []) : links}
              width={width}
              height={height}
              onNodeSelect={handleNodeSelect}
              onNodeHover={onNodeHover}
              selectedId={selectedId}
              expandedFileIds={expandedFileIds}
              onToggleFileExpansion={onToggleFileExpansion}
              expandingFileId={expandingFileId}
              activeSubMode={activeSubMode}
              highlightedNodeId={highlightedNodeId}
            />
          )}
          {mode === 'map' && (
            <TreeMapGraph
              nodes={fileScopedData?.nodes?.length ? fileScopedData.nodes : nodes}
              width={width}
              height={height}
              onNodeSelect={handleNodeSelect}
            />
          )}

        </g>
      </svg>

      {(!processedData || (nodes?.length === 0 && !fileScopedData?.nodes?.length)) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <i className="fas fa-project-diagram text-slate-700 text-4xl mb-4"></i>
            <p className="text-slate-600 text-xs uppercase tracking-widest">No data loaded</p>
          </div>
        </div>
      )}

      {/* OKF Concept Detail Overlay */}
      {selectedOKFConceptId && mode === 'discovery' && (
        <OKFConceptDetail
          conceptId={selectedOKFConceptId}
          onClose={() => setSelectedOKFConceptId(null)}
          onNavigateToSymbol={handleOKFNavigateToSymbol}
        />
      )}
    </div>
  );
};

export default TreeVisualizer;
