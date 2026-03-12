
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FlatGraph, ASTNode } from './types';
import { useAppContext } from './context/AppContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration } from './hooks';
import { CodePanel } from './components/Layout';
import { NarrativeScreen } from './components/NarrativeScreen';
import { LandingScreen } from './components/LandingScreen/LandingScreen';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import AppFooter from './components/AppFooter';
import SettingsModal from './components/SettingsModal';
import GraphContainer from './components/GraphContainer';
import { useSessionStorage } from './hooks/useSessionStorage';

// Ensure Prism is available for highlighting
declare var Prism: any;

const App: React.FC = () => {
  // Global Context
  const context = useAppContext();
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
    isFlowLoading, setIsFlowLoading,
    fileScopedNodes, setFileScopedNodes,
    fileScopedLinks, setFileScopedLinks,
    currentFlowFileRef,
    skipFlowZoom, setSkipFlowZoom,
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
  } = context;

  // Local State
  const [isSubModeSwitching, setIsSubModeSwitching] = useState(false);
  const [isClustered, setIsClustered] = useState(false);

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
  const setFlowMode = useCallback(() => setViewMode('flow'), [setViewMode]);
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
      syncDataFromApi(dataApiBase, projectId);
    }
  }, [availableProjects, dataApiBase, setCurrentProject, setSelectedProjectId, syncDataFromApi]);

  // Prism.js loading
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
    script.onload = () => {
      ['go', 'typescript', 'javascript', 'python', 'json', 'rust', 'cpp', 'css', 'html'].forEach(lang => {
        const langScript = document.createElement('script');
        langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
        langScript.onerror = (e) => console.warn(`Failed to load Prism language: ${lang}`, e);
        document.head.appendChild(langScript);
      });
    };
    script.onerror = (e) => console.warn('Failed to load Prism core', e);
    document.head.appendChild(script);
  }, []);

  // Auto-sync on mount
  useEffect(() => {
    if (dataApiBase && !isDataSyncing && availableProjects.length === 0) {
      console.log('[Auto-Sync] Connecting to API on mount:', dataApiBase);
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
          console.log('Fetched predicates:', predNames);
          setAvailablePredicates(predNames);
        })
        .catch((err: any) => console.warn('Failed to fetch predicates:', err));
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
  const setQueryResultsNull = useCallback(() => setQueryResults(null), [setQueryResults]);
  const setSearchErrorNull = useCallback(() => setSearchError(null), [setSearchError]);
  const setFileScopedNodesEmpty = useCallback(() => setFileScopedNodes([]), [setFileScopedNodes]);
  const setFileScopedLinksEmpty = useCallback(() => setFileScopedLinks([]), [setFileScopedLinks]);
  const setCtxSearchStatus = useCallback((status: string | null) => setSearchStatus(status), [setSearchStatus]);
  const setCtxIsSearching = useCallback((searching: boolean) => setCtxIsSearching(searching), [setCtxIsSearching]);
  const setCtxSearchError = useCallback((error: string | null) => setSearchError(error), [setSearchError]);
  const setNodeInsightNull = useCallback(() => setNodeInsight(null), [setNodeInsight]);

  // Expanded graph data computation
  const expandedGraphData = React.useMemo(() => {
    if (!astData || !('nodes' in astData)) {
      return astData;
    }

    const baseNodes = astData.nodes || [];
    const baseLinks = astData.links || [];
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
      console.log('Expanding file:', fileId);
    }
  }, [expandedFileIds]);

  // Node select handler (simplified - full implementation would move to separate hook)
  const handleNodeSelect = useCallback((node: any, isNavigation: boolean = false) => {
    console.log('Node selected:', node.id);
    setSelectedNode(node);
  }, [setSelectedNode]);

  if (isLandingView) {
    return <LandingScreen />;
  }

  return (
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
        astData={astData}
        sandboxFiles={sandboxFiles}
        onNodeSelect={handleNodeSelect}
        selectedNode={selectedNode}
        onSyncApi={syncApi}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          currentProject={currentProject}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTermWrapper}
          onSearch={handleSmartSearch}
          isSearching={isSearching}
          searchStatus={searchStatus}
          searchError={searchError}
          queryResults={queryResults}
          setSearchError={setSearchError}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isSubModeSwitching={isSubModeSwitching}
          openSettings={openSettings}
          lastExecutedQuery={lastExecutedQuery}
          dataApiBase={dataApiBase}
          selectedProjectId={selectedProjectId}
          setCtxSearchStatus={setCtxSearchStatus}
          setCtxIsSearching={setCtxIsSearching}
          setCtxSearchError={setCtxSearchError}
          setFileScopedNodes={setFileScopedNodes}
          setFileScopedLinks={setFileScopedLinks}
          setIsClustered={setIsClustered}
          setNodeInsight={setNodeInsightNull}
          setSearchTerm={setSearchTermWrapper}
          setQueryResultsNull={setQueryResultsNull}
          setSearchErrorNull={setSearchErrorNull}
          setFileScopedNodesEmpty={setFileScopedNodesEmpty}
          setFileScopedLinksEmpty={setFileScopedLinksEmpty}
        />

        <div className="relative flex-1 flex flex-col min-h-0 view-crossfade-enter" key={viewMode}>
          {viewMode === 'narrative' ? (
            <NarrativeScreen
              onNodeSelect={handleNodeSelect}
              onLinkClick={(href: string) => console.log('Link clicked:', href)}
              onSymbolClick={(symbol: string) => console.log('Symbol clicked:', symbol)}
            />
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
                skipFlowZoom={skipFlowZoom}
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

        <AppFooter
          astData={astData}
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
  );
};

export default App;
