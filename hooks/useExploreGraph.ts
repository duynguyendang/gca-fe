import { useCallback } from 'react';
import { logger } from '../logger';
import { fetchWhoCalls, fetchWhatCalls } from '../services/graphService';

interface UseExploreGraphProps {
  dataApiBase: string;
  selectedProjectId: string;
  selectedNode: any;
  setViewMode: (mode: 'narrative' | 'map' | 'discovery' | 'architecture' | 'dashboard') => void;
  setFileScopedNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setFileScopedLinks: React.Dispatch<React.SetStateAction<any[]>>;
  addConversationTurn: (turn: any) => void;
  toast: any;
}

export function useExploreGraph({
  dataApiBase,
  selectedProjectId,
  selectedNode,
  setViewMode,
  setFileScopedNodes,
  setFileScopedLinks,
  addConversationTurn,
  toast,
}: UseExploreGraphProps) {

  const handleExploreIntent = useCallback(async (query: string): Promise<boolean> => {
    setViewMode('architecture');

    let resultCount = 0;
    try {
      if (!dataApiBase || !selectedProjectId) {
        throw new Error('Not connected to API. Please connect to a project first.');
      }

      const q = query.toLowerCase();
      const isWhoCalls = /callers|caller|calling|who calls/.test(q);
      const isWhatCalls = /callees|callee|called|what calls/.test(q);

      const symbolMatch = query.match(/"([^"]+)"|([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)|([a-zA-Z_][a-zA-Z0-9_]*)/g);
      const symbol = symbolMatch ? symbolMatch[0].replace(/"/g, '') : query;
      const targetSymbol = selectedNode ? `${selectedNode._filePath || selectedNode.id}:${selectedNode.name}` : symbol;

      logger.log('[useExploreGraph] Explore mode:', { symbol: targetSymbol, isWhoCalls, isWhatCalls });

      let graphData;
      if (isWhoCalls) {
        graphData = await fetchWhoCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
      } else if (isWhatCalls) {
        graphData = await fetchWhatCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
      } else {
        graphData = await fetchWhoCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
      }

      if (graphData && graphData.nodes) {
        logger.log('[useExploreGraph] Explore graph loaded:', graphData.nodes.length, 'nodes');
        setFileScopedNodes(graphData.nodes);
        setFileScopedLinks(graphData.links || []);
        resultCount = graphData.nodes.length;
      }
    } catch (error: any) {
      logger.error('[useExploreGraph] Explore error:', error);
      toast.error(`Failed to load graph: ${error.message}`);
    }

    addConversationTurn({ user_input: query, intent: 'explore', datalog_query: '', result_count: resultCount, summary: `Explored ${resultCount} nodes`, timestamp: Date.now() });
    return true;
  }, [dataApiBase, selectedProjectId, selectedNode, setViewMode, setFileScopedNodes, setFileScopedLinks, toast, addConversationTurn]);

  const handleNavigateIntent = useCallback(async (query: string): Promise<boolean> => {
    setViewMode('architecture');
    toast.info('Navigate to: ' + query);
    addConversationTurn({ user_input: query, intent: 'navigate', datalog_query: '', result_count: 0, summary: 'Navigation', timestamp: Date.now() });
    return true;
  }, [setViewMode, toast, addConversationTurn]);

  return { handleExploreIntent, handleNavigateIntent };
}