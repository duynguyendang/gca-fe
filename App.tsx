
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FlatGraph, ASTNode } from './types';
import { useAppContext, NarrativeMessage } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration, useContextualSuggestions } from './hooks';
import { CodePanel } from './components/Layout';
import { NarrativeScreen } from './components/NarrativeScreen';
import { LandingScreen } from './components/LandingScreen/LandingScreen';
import { Dashboard } from './components/Dashboard';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import AppFooter from './components/AppFooter';
import SettingsModal from './components/SettingsModal';
import GraphContainer from './components/GraphContainer';
import UnifiedSearchBar from './components/UnifiedSearchBar';
import { useSessionStorage } from './hooks/useSessionStorage';
import { useQueryContext } from './hooks/useQueryContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { fetchFileCalls, fetchSource, fetchWhoCalls, fetchWhatCalls } from './services/graphService';
import { askAI } from './services/geminiService';
import { detectLanguage } from './utils/languageUtils';
import { requestManager } from './utils/requestManager';
import { logger } from './src/logger';
import { Routes, Route, useLocation } from 'react-router-dom';
import './src/prismSetup';

// Query mode for intent-based routing
type QueryMode = 'explore' | 'explain' | 'navigate';

// Classify query to determine how to route it
// explore: show graph visualization (callers/callees)
// explain: send to AI for narrative explanation
// navigate: jump to a specific file or symbol
function classifyQueryMode(query: string): QueryMode {
  const q = query.toLowerCase();

  // Explore patterns - user wants to see graph
  const explorePatterns = [
    /show\s+(me\s+)?(callers|callees|dependencies)/i,
    /(who|caller|calling)\s+calls/i,
    /(what|callee|called)\s+calls/i,
    /trace\s+(the\s+)?(call|code|execution)/i,
    /call\s+graph/i,
    /dependencies/i,
    /upstream|downstream/i,
    /impact.*analysis/i,
    /blast.*radius/i,
  ];

  for (const pattern of explorePatterns) {
    if (pattern.test(q)) return 'explore';
  }

  // Navigate patterns - user wants to jump to a file/symbol
  const navigatePatterns = [
    /\.(go|ts|tsx|js|jsx|py)$/,  // ends with code extension
    /\/[a-zA-Z0-9_.-]+$/,  // ends with path segment
    /^src\//m,
    /^pkg\//m,
    /^cmd\//m,
  ];

  for (const pattern of navigatePatterns) {
    if (pattern.test(q)) return 'navigate';
  }

  // Default to explain (send to AI narrative)
  return 'explain';
}

const App: React.FC = () => {
  // Global Context
  const context = useAppContext();
  const toast = useToast();
  const {
    astData, setAstData,
    sandboxFiles, setSandboxFiles,
    dataApiBase, setDataApiBase,
    currentProject, setCurrentProject,
    availableProjects, setAvailableProjects,
    selectedProjectId, setSelectedProjectId,
    isDataSyncing, setIsDataSyncing,
    syncError, setSyncError,
    selectedNode, setSelectedNode,
    hydratingNodeId, setHydratingNodeId,
    symbolCache, setSymbolCache,
    nodeInsight, setNodeInsight,
    isInsightLoading, setIsInsightLoading,
    searchTerm, setSearchTerm,
    lastExecutedQuery, setLastExecutedQuery,
    queryResults, setQueryResults,
    isSearching: ctxIsSearching, setIsSearching: setCtxIsSearching,
    searchError: ctxSearchError, setSearchError: setCtxSearchError,
    searchStatus: ctxSearchStatus, setSearchStatus: setCtxSearchStatus,
    viewMode, setViewMode,
    fileScopedNodes, setFileScopedNodes,
    fileScopedLinks, setFileScopedLinks,
    expandedFileIds, setExpandedFileIds,
    fileDetailsCache, setFileDetailsCache,
    expandingFileId, setExpandingFileId,
    isSettingsOpen, setIsSettingsOpen,
    availablePredicates, setAvailablePredicates,
    enableAutoClustering, setEnableAutoClustering,
    activeSubMode, setActiveSubMode,
    highlightedNodeId, setHighlightedNodeId,
    isCodeCollapsed, setIsCodeCollapsed,
    isSynthesisCollapsed, setIsSynthesisCollapsed,
    isLandingView,
    narrativeMessages, setNarrativeMessages,
    isNarrativeLoading, setIsNarrativeLoading,
  } = context;

  // Local State
  const [isSubModeSwitching, setIsSubModeSwitching] = useState(false);
  const [isClustered, setIsClustered] = useState(false);

  // Request cancellation for race condition prevention
  const nodeSelectRequestRef = useRef<string | null>(null);

  // Hooks initialization
  const { manifest } = useManifest(dataApiBase, selectedProjectId);
  const { syncDataFromApi } = useApiSync();
  const { hydrateNode } = useNodeHydration();

  const {
    startResizeSidebar,
    startResizeCode,
    sidebarWidth,
    codePanelWidth,
    isCodeCollapsed: isCodeCollapsedLocal,
    setIsCodeCollapsed: setIsCodeCollapsedLocal
  } = useResizePanels({
    isCodeCollapsed,
    setIsCodeCollapsed
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use session storage hook
  useSessionStorage(astData, sandboxFiles, dataApiBase);

  // Sub-mode switching animation
  useEffect(() => {
    setIsSubModeSwitching(true);
    const timer = setTimeout(() => setIsSubModeSwitching(false), 800);
    return () => clearTimeout(timer);
  }, [activeSubMode]);

  // View mode setters
  const setMapMode = useCallback(() => setViewMode('map'), [setViewMode]);
  const setDiscoveryMode = useCallback(() => setViewMode('discovery'), [setViewMode]);
  const setArchitectureMode = useCallback(() => setViewMode('architecture'), [setViewMode]);
  const setNarrativeMode = useCallback(() => setViewMode('narrative'), [setViewMode]);

  // Search Hook
  const {
    handleSmartSearch,
    searchStatus,
    isSearching,
    searchError,
    setSearchError
  } = useSmartSearch({
    ...context,
    manifest,
    onViewModeChange: setViewMode,
  });

  // Context-aware suggestions
  const { suggestions: contextualSuggestions } = useContextualSuggestions();

  // Shared query context builder
  const { buildContext } = useQueryContext();

  // Insights Hook
  const { generateInsights, clearInsight } = useInsights();

  // Callbacks
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const syncApi = useCallback(() => syncDataFromApi(dataApiBase), [dataApiBase, syncDataFromApi]);

  // Project change handler
  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    const project = availableProjects.find((p: { id: string; name: string; description?: string }) => p.id === projectId);
    if (project) {
      setCurrentProject(project.name);
      setNarrativeMessages([]);
      toast.info(`Loading project: ${project.name}`);
      // Always show dashboard when project changes
      setViewMode('dashboard');
      syncDataFromApi(dataApiBase, projectId, () => {
        toast.success(`Project ${project.name} loaded`);
      });
    }
  }, [availableProjects, dataApiBase, setCurrentProject, setSelectedProjectId, syncDataFromApi, toast, setNarrativeMessages, setViewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (mod && e.key === 'k') {
        e.preventDefault();
        // Focus search - trigger via custom event
        window.dispatchEvent(new CustomEvent('gca:focus-search'));
      } else if (mod && e.key === 'b') {
        e.preventDefault();
        setIsCodeCollapsed(prev => !prev);
      } else if (e.key === 'Escape') {
        setSelectedNode(null);
        setSearchTerm('');
      } else if (mod && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const modes = ['narrative', 'map', 'discovery', 'architecture'] as const;
        const idx = parseInt(e.key) - 1;
        if (idx < modes.length) setViewMode(modes[idx]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, setIsCodeCollapsed, setSelectedNode, setSearchTerm]);

  // Listen for open-settings event from sidebar
  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener('gca:open-settings', handleOpenSettings);
    return () => window.removeEventListener('gca:open-settings', handleOpenSettings);
  }, []);

  // Auto-sync on mount
  useEffect(() => {
    if (dataApiBase && !isDataSyncing && availableProjects.length === 0) {
      logger.log('[Auto-Sync] Connecting to API on mount:', dataApiBase);
      syncDataFromApi(dataApiBase);
    }
  }, []);

  // Fetch predicates when project changes
  useEffect(() => {
    if (!dataApiBase || !selectedProjectId) return;

    import('./services/graphService').then(({ fetchPredicates }) => {
      fetchPredicates(dataApiBase, selectedProjectId)
        .then((preds: any[]) => {
          const predNames = preds.map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
          logger.log('Fetched predicates:', predNames);
          setAvailablePredicates(predNames);
        })
        .catch((err: any) => logger.warn('Failed to fetch predicates:', err));
    });
  }, [dataApiBase, selectedProjectId]);

  // Settings helpers
  const handleDataApiBaseChange = useCallback((url: string) => {
    setDataApiBase(url);
    setAvailableProjects([]);
    setSelectedProjectId('');
  }, [setDataApiBase, setAvailableProjects, setSelectedProjectId]);

  const handleConnect = useCallback(() => {
    syncDataFromApi(dataApiBase);
  }, [dataApiBase, syncDataFromApi]);

  // Clear search helpers
  const setSearchTermWrapper = useCallback((term: string) => setSearchTerm(term), [setSearchTerm]);

  // Smart search handler - routes based on query intent
  const handleSmartSearchWithNarrativeSwitch = useCallback(async (query: string) => {
    const mode = classifyQueryMode(query);

    setSearchTerm(query);

    // EXPLORE mode: show callers/callees graph
    if (mode === 'explore') {
      setViewMode('architecture');

      try {
        if (!dataApiBase || !selectedProjectId) {
          throw new Error('Not connected to API. Please connect to a project first.');
        }

        // Determine direction: callers (who-calls) vs callees (what-calls)
        const q = query.toLowerCase();
        const isWhoCalls = /callers|caller|calling|who calls/.test(q);
        const isWhatCalls = /callees|callee|called|what calls/.test(q);

        // Extract potential symbol from query
        const symbolMatch = query.match(/"([^"]+)"|([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)|([a-zA-Z_][a-zA-Z0-9_]*)/g);
        const symbol = symbolMatch ? symbolMatch[0].replace(/"/g, '') : query;

        // If no specific symbol, use selected node
        const targetSymbol = selectedNode ? `${selectedNode._filePath || selectedNode.id}:${selectedNode.name}` : symbol;

        logger.log('[App] Explore mode:', { symbol: targetSymbol, isWhoCalls, isWhatCalls });

        let graphData;
        if (isWhoCalls) {
          graphData = await fetchWhoCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
        } else if (isWhatCalls) {
          graphData = await fetchWhatCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
        } else {
          // Default: show callers
          graphData = await fetchWhoCalls(dataApiBase, selectedProjectId, targetSymbol, 1, true);
        }

        if (graphData && graphData.nodes) {
          logger.log('[App] Explore graph loaded:', graphData.nodes.length, 'nodes');
          setFileScopedNodes(graphData.nodes);
          setFileScopedLinks(graphData.links || []);
        }
      } catch (error: any) {
        logger.error('[App] Explore error:', error);
        toast.error(`Failed to load graph: ${error.message}`);
      }
      return;
    }

    // NAVIGATE mode: jump to file
    if (mode === 'navigate') {
      setViewMode('architecture');
      toast.info('Navigate to: ' + query);
      return;
    }

    // EXPLAIN mode (default): send to AI narrative
    setViewMode('narrative');

    const { enhancedQuery, contextData } = await buildContext(query);

    let fullQuery = query;
    if (currentProject) {
      fullQuery = `[Analyzing project: ${currentProject}] ${query}`;
    }
    fullQuery += `\n${enhancedQuery}`;

    if (query === 'Explain this code' && selectedNode) {
      fullQuery = `Explain the following code:\n\n`;
      fullQuery += `Selected: "${selectedNode.name}" (${selectedNode.kind || selectedNode.type})\n`;
      fullQuery += `File: ${selectedNode._filePath || selectedNode.filePath || 'Unknown'}\n`;
      if (selectedNode.code && selectedNode.code.trim() !== '') {
        fullQuery += `\nFull Code:\n${selectedNode.code.trim()}\n`;
      }
      fullQuery += `\nPlease analyze the code and provide:\n1. What this code does\n2. How components interact\n3. Key patterns\n4. Potential improvements`;
    }

    setSearchTerm(query);

    const userMsg: NarrativeMessage = {
      role: 'user',
      content: fullQuery,
      displayContent: query,
      timestamp: Date.now(),
    };

    setNarrativeMessages(prev => [...prev, userMsg]);
    setIsNarrativeLoading(true);

    try {
      if (!dataApiBase || !selectedProjectId) {
        throw new Error('Not connected to API. Please connect to a project first.');
      }

      logger.log('[App] Sending query with context:', {
        query: fullQuery.substring(0, 100) + '...',
        contextItems: contextData.length,
        project: selectedProjectId
      });

      const aiResponse = await askAI(dataApiBase, selectedProjectId, {
        task: 'chat',
        query: fullQuery,
        data: contextData.length > 0 ? contextData : undefined,
      });

      logger.log('[App] AI response received:', aiResponse.substring(0, 100) + '...');

      const aiMsg: NarrativeMessage = {
        role: 'ai',
        content: aiResponse,
        timestamp: Date.now(),
      };

      setNarrativeMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      logger.error('[App] Error:', error);
      const errorMsg: NarrativeMessage = {
        role: 'ai',
        content: `I apologize, but I encountered an error: ${error.message || 'Unknown error'}\n\nMake sure you're connected to a project with indexed code.`,
        timestamp: Date.now(),
      };
      setNarrativeMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsNarrativeLoading(false);
    }
  }, [setViewMode, setSearchTerm, selectedNode, dataApiBase, selectedProjectId, setNarrativeMessages, setIsNarrativeLoading, currentProject, buildContext, setFileScopedNodes, setFileScopedLinks, toast]);

  const setQueryResultsNull = useCallback(() => setQueryResults(null), [setQueryResults]);
  const setFileScopedNodesEmpty = useCallback(() => setFileScopedNodes([]), [setFileScopedNodes]);
  const setFileScopedLinksEmpty = useCallback(() => setFileScopedLinks([]), [setFileScopedLinks]);
  const setNodeInsightNull = useCallback(() => setNodeInsight(null), [setNodeInsight]);

  // Expanded graph data computation
  const expandedGraphData = React.useMemo(() => {
    if (!astData || !('nodes' in astData)) {
      return astData;
    }

    const baseNodes = Array.isArray(astData.nodes) ? astData.nodes : [];
    const baseLinks = Array.isArray(astData.links) ? astData.links : [];
    const expandedNodes: any[] = [...baseNodes];
    const expandedLinks: any[] = [...baseLinks];

    for (const fileId of expandedFileIds) {
      const details = fileDetailsCache.get(fileId);
      if (details) {
        details.nodes.forEach((node: any) => {
          expandedNodes.push({
            ...node,
            _parentFile: fileId,
            _isExpandedChild: true
          });
        });

        details.links.forEach((link: any) => {
          expandedLinks.push({
            ...link,
            _parentFile: fileId
          });
        });
      }
    }

    return {
      nodes: expandedNodes,
      links: expandedLinks
    };
  }, [astData, expandedFileIds, fileDetailsCache]);

  // Toggle file expansion
  const toggleFileExpansion = useCallback(async (fileId: string) => {
    if (expandedFileIds.has(fileId)) {
      // Collapse
      setExpandedFileIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    } else {
      // Expand - would call expandFile logic here
      logger.log('Expanding file:', fileId);
    }
  }, [expandedFileIds]);

  // Node select handler - fetches file graph data when file is selected
  const handleNodeSelect = useCallback(async (node: any, isNavigation: boolean = false) => {
    logger.log('Node selected:', node.id, 'isNavigation:', isNavigation, '_isFile:', node._isFile);
    setSelectedNode(node);

    // If it's a file navigation, fetch the file's graph data and switch to Architecture view
    if (isNavigation && node._isFile && dataApiBase && selectedProjectId) {
      // Cancel any in-flight request for node selection
      if (nodeSelectRequestRef.current) {
        requestManager.cancelRequest(nodeSelectRequestRef.current);
      }

      const requestId = `nodeSelect-${node.id}-${Date.now()}`;
      nodeSelectRequestRef.current = requestId;

      try {
        logger.log('[App] Fetching file calls for:', node._filePath || node.id);
        const fileId = node._filePath || node.id;
        const controller = requestManager.startRequest(requestId);
        const graphData = await fetchFileCalls(dataApiBase, selectedProjectId, fileId, 1, controller.signal);

        // Check if this request is still valid (not stale)
        if (nodeSelectRequestRef.current !== requestId) {
          logger.log('[App] Stale response discarded for:', node.id);
          return;
        }

        if (graphData && graphData.nodes) {
          logger.log('[App] File graph loaded:', graphData.nodes.length, 'nodes');
          setFileScopedNodes(graphData.nodes);
          setFileScopedLinks(graphData.links || []);
          // Automatically switch to Architecture view when a file is selected
          setViewMode('architecture');
        }
      } catch (err: any) {
        // Ignore AbortError - it's expected when request is cancelled
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          logger.log('[App] Request was cancelled:', node.id);
        } else {
          logger.error('[App] Failed to fetch file calls:', err);
        }
      } finally {
        if (nodeSelectRequestRef.current === requestId) {
          nodeSelectRequestRef.current = null;
        }
      }
    } else {
      logger.log('[App] Skipping file calls fetch: _isFile=', node._isFile, 'dataApiBase=', !!dataApiBase, 'selectedProjectId=', !!selectedProjectId);
    }
  }, [setSelectedNode, dataApiBase, selectedProjectId, setFileScopedNodes, setFileScopedLinks, setViewMode]);

  // Hydrate selected node when it doesn't have code
  const selectedNodeRef = React.useRef(selectedNode);
  selectedNodeRef.current = selectedNode;
  
  React.useEffect(() => {
    if (!selectedNode || !hydrateNode) return;
    
    const nodeId = selectedNode.id;
    logger.log('[App] selectedNode changed:', nodeId, 'code:', !!selectedNode.code, '_isMissingCode:', selectedNode._isMissingCode);
    
    // Skip if already has code or marked as missing
    if (selectedNode.code || selectedNode._isMissingCode) return;
    
    // Determine the best ID to hydrate
    let hydrateId = nodeId;
    const filePath = (selectedNode as any)._filePath;
    if (filePath && typeof filePath === 'string') {
      hydrateId = filePath;
    }
    
    logger.log('[App] Calling hydrateNode with:', hydrateId);
    
    hydrateNode(hydrateId).then(hydrated => {
      logger.log('[App] Hydration result:', hydrated);
      if (hydrated && hydrated.code) {
        logger.log('[App] Node hydrated successfully, updating UI');
        setSelectedNode(prev => prev ? { ...prev, ...hydrated } : null);
      } else {
        logger.log('[App] Hydration returned no code, marking as missing');
        setSelectedNode(prev => prev ? { ...prev, _isMissingCode: true } : null);
      }
    }).catch(err => {
      logger.error('[App] Hydration error:', err);
      setSelectedNode(prev => prev ? { ...prev, _isMissingCode: true } : null);
    });
  }, [selectedNode?.id, hydrateNode, setSelectedNode]);

  return (
    <ErrorBoundary>
      {isLandingView ? (
        <LandingScreen />
      ) : (
      <div className="flex h-screen w-screen bg-[var(--bg-main)] text-slate-400 overflow-hidden font-sans">
        <AppSidebar
        width={sidebarWidth}
        onResizeStart={startResizeSidebar}
        currentProject={currentProject}
        availableProjects={availableProjects}
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
        dataApiBase={dataApiBase}
        isDataSyncing={isDataSyncing}
        syncError={syncError}
        astData={astData as FlatGraph}
        sandboxFiles={sandboxFiles}
        onNodeSelect={handleNodeSelect}
        selectedNode={selectedNode}
        onSyncApi={syncApi}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          currentProject={currentProject}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isSubModeSwitching={isSubModeSwitching}
          openSettings={openSettings}
          isSearching={isSearching}
          isConnected={!!dataApiBase && availableProjects.length > 0}
          isDataSyncing={isDataSyncing}
        />

          <div className="relative flex-1 flex flex-col min-h-0">
            {/* Loading overlay during initial data sync */}
            {isDataSyncing && !('nodes' in astData && Array.isArray(astData.nodes) && astData.nodes.length > 0) && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg-main)]/90 backdrop-blur-sm">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/20 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-spinner fa-spin text-2xl text-[var(--accent-teal)]"></i>
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Loading Project</p>
                  <p className="text-[10px] text-slate-500">Fetching graph data from backend...</p>
                </div>
              </div>
            )}

            {/* Search Bar - moved outside keyed div to prevent remounting on view change */}
            {viewMode !== 'narrative' && (
              <UnifiedSearchBar
                accentColor="teal"
                suggestions={contextualSuggestions}
                onSubmit={handleSmartSearchWithNarrativeSwitch}
              />
            )}

            <div className="flex-1 flex flex-col min-h-0 view-crossfade-enter" key={viewMode}>
              {viewMode === 'narrative' ? (
                <NarrativeScreen
                  onNodeSelect={handleNodeSelect}
                  onLinkClick={(href: string) => logger.log('Link clicked:', href)}
                  onSymbolClick={(symbol: string) => logger.log('Symbol clicked:', symbol)}
                />
              ) : viewMode === 'dashboard' ? (
                <Dashboard refreshKey={'dashboard-' + selectedProjectId} />
              ) : (
                <div className={`flex-1 flex min-h-0 ${isSubModeSwitching ? 'animate-pulse opacity-80' : 'transition-opacity duration-500'}`}>
                  <GraphContainer
                    viewMode={viewMode}
                    astData={astData}
                    expandedGraphData={expandedGraphData}
                    fileScopedNodes={fileScopedNodes}
                    fileScopedLinks={fileScopedLinks}
                    sidebarWidth={sidebarWidth}
                    codePanelWidth={codePanelWidth}
                    selectedNode={selectedNode}
                    onNodeSelect={handleNodeSelect}
                    expandedFileIds={expandedFileIds}
                    onToggleFileExpansion={toggleFileExpansion}
                    expandingFileId={expandingFileId}
                    activeSubMode={activeSubMode}
                    highlightedNodeId={highlightedNodeId}
                  />
                  <CodePanel
                    width={codePanelWidth}
                    isCollapsed={isCodeCollapsed}
                    onToggleCollapse={() => setIsCodeCollapsed(!isCodeCollapsed)}
                    onStartResize={startResizeCode}
                  />
                </div>
              )}
            </div>
          </div>

        <AppFooter
          astData={astData as FlatGraph}
          dataApiBase={dataApiBase}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        dataApiBase={dataApiBase}
        onDataApiBaseChange={handleDataApiBaseChange}
        enableAutoClustering={enableAutoClustering}
        onAutoClusteringToggle={() => setEnableAutoClustering(!enableAutoClustering)}
        syncError={syncError}
        isDataSyncing={isDataSyncing}
        availableProjects={availableProjects}
        onConnect={handleConnect}
      />
      </div>
      )}
    </ErrorBoundary>
  );
};

export default App;
