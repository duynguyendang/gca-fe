import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ASTNode, FlatGraph } from '../types';
import { SubMode } from '../context/UIContext';
import TreeVisualizer from './TreeVisualizer/index';
import ClassDiagramCanvas from './ClassDiagramCanvas';

type ViewMode = 'map' | 'discovery' | 'architecture' | 'narrative';

interface GraphContainerProps {
  viewMode: ViewMode;
  astData: ASTNode | FlatGraph | null;
  expandedGraphData: ASTNode | FlatGraph | null;
  fileScopedNodes: any[];
  fileScopedLinks: any[];
  sidebarWidth: number;
  codePanelWidth: number;
  selectedNode: any;
  onNodeSelect: (node: any, isNavigation?: boolean) => void;
  expandedFileIds: Set<string>;
  onToggleFileExpansion: (fileId: string) => void;
  expandingFileId: string | null;
  activeSubMode: SubMode;
  highlightedNodeId: string | null;
}

const GraphContainer: React.FC<GraphContainerProps> = ({
  viewMode,
  astData,
  expandedGraphData,
  fileScopedNodes,
  fileScopedLinks,
  sidebarWidth,
  codePanelWidth,
  selectedNode,
  onNodeSelect,
  expandedFileIds,
  onToggleFileExpansion,
  expandingFileId,
  activeSubMode,
  highlightedNodeId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const filteredAstData = expandedGraphData || astData;
  const filteredFileScopedData = React.useMemo(() => ({
    nodes: fileScopedNodes,
    links: fileScopedLinks
  }), [fileScopedNodes, fileScopedLinks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleClassDiagramNodeClick = useCallback((node: any) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  const visualizationNodeCount = fileScopedNodes.length;
  const isFlatGraph = astData && 'nodes' in astData && Array.isArray(astData.nodes);
  const nodeCount = isFlatGraph ? (astData as FlatGraph).nodes?.length || 0 : 0;
  const linkCount = isFlatGraph ? (astData as FlatGraph).links?.length || 0 : 0;
  const tooManyNodes = visualizationNodeCount > 1000;

  if (tooManyNodes) {
    return (
      <div ref={containerRef} className="flex-1 relative dot-grid overflow-hidden bg-[var(--bg-main)]">
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-exclamation-triangle text-3xl text-red-400"></i>
            </div>
            <h2 className="text-lg font-bold text-white mb-3">Graph Too Large</h2>
            <p className="text-sm text-slate-400 mb-4">
              The visualization contains <span className="text-[#f59e0b] font-bold">{nodeCount.toLocaleString()} nodes</span> and <span className="text-[#f59e0b] font-bold">{linkCount.toLocaleString()} links</span>.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Rendering graphs with more than 1,000 nodes can cause significant performance issues and browser slowdowns.
              <br /><br />
              Use clustering to group related nodes into communities, or refine your query to reduce the result size.
            </p>
            <div className="flex flex-col gap-3">
              <button
                disabled
                title="Clustering is not yet available"
                className="px-6 py-3 bg-gradient-to-r from-[#f59e0b]/50 to-[#d97706]/50 text-white/50 font-medium rounded-lg cursor-not-allowed"
              >
                <i className="fas fa-project-diagram mr-2"></i>
                Use Clustering ({Math.ceil(nodeCount / 50)}-{Math.ceil(nodeCount / 20)} clusters)
              </button>
              <div className="px-4 py-2 bg-[#16222a] border border-white/10 rounded text-slate-400 text-xs text-center">
                <i className="fas fa-lightbulb text-[#f59e0b] mr-2"></i>
                Or try filtering with specific predicates or entity names
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative dot-grid overflow-hidden bg-[var(--bg-main)]">
      {viewMode === 'architecture' ? (
        <div className="w-full h-full bg-[var(--bg-surface)] relative z-0">
          {fileScopedNodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-diagram-project text-2xl text-[var(--accent-purple)]"></i>
                </div>
                <h3 className="text-sm font-bold text-white mb-2">No File Selected</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Select a file from the Source Navigator to view its architecture diagram and dependencies.
                </p>
              </div>
            </div>
          ) : (
            <ClassDiagramCanvas
              nodes={fileScopedNodes}
              links={fileScopedLinks}
              onNodeClick={handleClassDiagramNodeClick}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>
      ) : (
        <TreeVisualizer
          data={filteredAstData ?? { nodes: [], links: [] }}
          onNodeSelect={onNodeSelect}
          onNodeHover={() => {}}
          mode={viewMode}
          selectedId={selectedNode?.id}
          fileScopedData={filteredFileScopedData}
          expandedFileIds={expandedFileIds}
          onToggleFileExpansion={onToggleFileExpansion}
          expandingFileId={expandingFileId}
          activeSubMode={activeSubMode}
          highlightedNodeId={highlightedNodeId}
        />
      )}
    </div>
  );
};

export default GraphContainer;
