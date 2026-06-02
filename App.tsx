import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FlatGraph } from './types';
import { useToast } from './context/ToastContext';
import { useGraphContext } from './context/GraphContext';
import { useSearchContext } from './context/SearchContext';
import { useNarrativeContext, NarrativeMessage } from './context/NarrativeContext';
import { useSettingsContext } from './context/SettingsContext';
import { useUIContext } from './context/UIContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration, useContextualSuggestions, useIntentRouter, useExploreGraph } from './hooks';
import { CodePanel } from './components/Layout';
import TestScreen from './components/TestScreen/TestScreen';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { fetchFileCalls, fetchPredicates, fetchSource } from './services/graphService';
import { askAI, askAIStream } from './services/geminiService';
import { logger } from './logger';
import { requestManager } from './utils/requestManager';
import { CUSTOM_EVENTS } from './constants';
import { classifyIntentRoute } from './utils/queryClassifier';
import './prismSetup';

const App: React.FC = () => {
  const toast = useToast();

  const {
    astData,
    selectedNode, setSelectedNode,
    fileScopedNodes, setFileScopedNodes,
    fileScopedLinks, setFileScopedLinks,
    expandedFileIds, setExpandedFileIds,
    fileDetailsCache,
    expandingFileId,
    highlightedNodeId,
  } = useGraphContext();

  const {
    searchTerm, setSearchTerm,
    setLastExecutedQuery,
    conversationHistory,
    addConversationTurn,
  } = useSearchContext();

  const {
    setNarrativeMessages,
    setIsNarrativeLoading,
    setNodeInsight,
  } = useNarrativeContext();

  const {
    dataApiBase, setDataApiBase,
    currentProject, setCurrentProject,
    availableProjects, setAvailableProjects,
    selectedProjectId, setSelectedProjectId,
    isDataSyncing,
    syncError,
    availablePredicates, setAvailablePredicates,
    enableAutoClustering, setEnableAutoClustering,
    sandboxFiles,
  } = useSettingsContext();

  const {
    viewMode, setViewMode,
    activeSubMode,
    isSettingsOpen, setIsSettingsOpen,
    isCodeCollapsed, setIsCodeCollapsed,
    isLandingView,
  } = useUIContext();

  const [isSubModeSwitching, setIsSubModeSwitching] = useState(false);
  const nodeSelectRequestRef = useRef<string | null>(null);

  const { manifest } = useManifest(dataApiBase, selectedProjectId);
  const { syncDataFromApi } = useApiSync();
  const { hydrateNode } = useNodeHydration();

  const { handleSmartSearch, isSearching } = useSmartSearch({
    dataApiBase,
    selectedProjectId,
    availablePredicates,
    manifest,
    onViewModeChange: setViewMode,
    setFileScopedNodes,
    setFileScopedLinks,
    setSelectedNode,
    setNodeInsight,
    setLastExecutedQuery,
    activeSubMode,
    conversationHistory,
    addConversationTurn,
  });

  const { suggestions: contextualSuggestions } = useContextualSuggestions();
  const { buildContext } = useQueryContext();

  const { startResizeSidebar, startResizeCode, sidebarWidth, codePanelWidth } = useResizePanels({
    isCodeCollapsed,
    setIsCodeCollapsed
  });

  const { handleIntent } = useIntentRouter({
    dataApiBase,
    selectedProjectId,
    setViewMode,
    setNarrativeMessages,
    setIsNarrativeLoading,
    addConversationTurn,
    toast,
  });

  const { handleExploreIntent, handleNavigateIntent } = useExploreGraph({
    dataApiBase,
    selectedProjectId,
    selectedNode,
    setViewMode,
    setFileScopedNodes,
    setFileScopedLinks,
    addConversationTurn,
    toast,
  });

  useSessionStorage(astData, sandboxFiles, dataApiBase);

  useEffect(() => {
    setIsSubModeSwitching(true);
    const timer = setTimeout(() => setIsSubModeSwitching(false), 800);
    return () => clearTimeout(timer);
  }, [activeSubMode]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const syncApi = useCallback(() => syncDataFromApi(dataApiBase), [dataApiBase, syncDataFromApi]);

  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    const project = availableProjects.find((p: { id: string; name: string; description?: string }) => p.id === projectId);
    if (project) {
      setCurrentProject(project.name);
      setNarrativeMessages([]);
      toast.info(`Loading project: ${project.name}`);
      setViewMode('dashboard');
      syncDataFromApi(dataApiBase, projectId, () => {
        toast.success(`Project ${project.name} loaded`);
      });
    }
  }, [availableProjects, dataApiBase, setCurrentProject, setSelectedProjectId, syncDataFromApi, toast, setNarrativeMessages, setViewMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (mod && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.FOCUS_SEARCH));
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
        if (idx < modes.length) setViewMode(modes[idx]!);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, setIsCodeCollapsed, setSelectedNode, setSearchTerm]);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener(CUSTOM_EVENTS.OPEN_SETTINGS, handleOpenSettings);
    return () => window.removeEventListener(CUSTOM_EVENTS.OPEN_SETTINGS, handleOpenSettings);
  }, []);

  useEffect(() => {
    if (dataApiBase && !isDataSyncing && availableProjects.length === 0) {
      logger.log('[Auto-Sync] Connecting to API on mount:', dataApiBase);
      syncDataFromApi(dataApiBase);
    }
  }, [dataApiBase, isDataSyncing, availableProjects.length, syncDataFromApi]);

  useEffect(() => {
    if (!dataApiBase || !selectedProjectId) return;

    fetchPredicates(dataApiBase, selectedProjectId)
      .then((preds: any[]) => {
        const predNames = preds.map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
        logger.log('Fetched predicates:', predNames);
        setAvailablePredicates(predNames);
      })
      .catch((err: any) => logger.warn('Failed to fetch predicates:', err));
  }, [dataApiBase, selectedProjectId]);

  const handleDataApiBaseChange = useCallback((url: string) => {
    setDataApiBase(url);
    setAvailableProjects([]);
    setSelectedProjectId('');
  }, [setDataApiBase, setAvailableProjects, setSelectedProjectId]);

  const handleConnect = useCallback(() => {
    syncDataFromApi(dataApiBase);
  }, [dataApiBase, syncDataFromApi]);

  const handleSmartSearchWithNarrativeSwitch = useCallback(async (query: string) => {
    const intentRoute = classifyIntentRoute(query);
    setSearchTerm(query);

    if (intentRoute === 'explore') {
      const handled = await handleExploreIntent(query);
      if (handled) return;
    }

    if (intentRoute === 'navigate') {
      const handled = await handleNavigateIntent(query);
      if (handled) return;
    }

    if (intentRoute === 'test' || intentRoute === 'security' || intentRoute === 'refactor' || intentRoute === 'performance') {
      const handled = await handleIntent(intentRoute, query);
      if (handled) return;
    }

    setViewMode('narrative');

    const { enhancedQuery, contextData } = await buildContext(query);

    let fullQuery = query;
    if (currentProject) {
      fullQuery = `[Analyzing project: ${currentProject}] ${query}`;
    }
    fullQuery += `\n${enhancedQuery}`;

    if (query === 'Explain this code' && selectedNode) {
      // Code is already in contextData — don't duplicate it in the query.
      // The backend's BuildChatPrompt will include code from the data array.
      fullQuery = `Explain the selected code: "${selectedNode.name}" (${selectedNode.kind || selectedNode.type})\n\nPlease analyze and provide:\n1. What this code does\n2. How components interact\n3. Key patterns\n4. Potential improvements`;
    }

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

      const aiMsg: NarrativeMessage = {
        role: 'ai',
        content: '',
        timestamp: Date.now(),
      };
      const aiMsgIdxRef = { current: -1 };
      setNarrativeMessages(prev => {
        aiMsgIdxRef.current = prev.length;
        return [...prev, aiMsg];
      });

      await askAIStream(dataApiBase, selectedProjectId, {
        task: 'chat',
        query: fullQuery,
        data: contextData.length > 0 ? contextData : undefined,
      }, (delta) => {
        const idx = aiMsgIdxRef.current;
        setNarrativeMessages(prev => prev.map((m, i) =>
          i === idx ? { ...m, content: m.content + delta } : m
        ));
      });
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
      addConversationTurn({ user_input: query, intent: 'explain', datalog_query: '', result_count: 0, summary: 'Explain query', timestamp: Date.now() });
    }
  }, [setViewMode, setSearchTerm, selectedNode, dataApiBase, selectedProjectId, setNarrativeMessages, setIsNarrativeLoading, currentProject, buildContext, toast, addConversationTurn, handleIntent, handleExploreIntent, handleNavigateIntent]);

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
          expandedNodes.push({ ...node, _parentFile: fileId, _isExpandedChild: true });
        });
        details.links.forEach((link: any) => {
          expandedLinks.push({ ...link, _parentFile: fileId });
        });
      }
    }

    return { nodes: expandedNodes, links: expandedLinks };
  }, [astData, expandedFileIds, fileDetailsCache]);

  const toggleFileExpansion = useCallback(async (fileId: string) => {
    if (expandedFileIds.has(fileId)) {
      setExpandedFileIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    } else {
      logger.log('Expanding file:', fileId);
    }
  }, [expandedFileIds, setExpandedFileIds]);

  const handleNodeSelect = useCallback(async (node: any, isNavigation: boolean = false) => {
    logger.log('Node selected:', node.id, 'isNavigation:', isNavigation, '_isFile:', node._isFile);
    setSelectedNode(node);

    if (isNavigation && node._isFile && dataApiBase && selectedProjectId) {
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

        if (nodeSelectRequestRef.current !== requestId) {
          logger.log('[App] Stale response discarded for:', node.id);
          return;
        }

        if (graphData && graphData.nodes) {
          logger.log('[App] File graph loaded:', graphData.nodes.length, 'nodes');
          setFileScopedNodes(graphData.nodes);
          setFileScopedLinks(graphData.links || []);
          setViewMode('architecture');
        }
      } catch (err: any) {
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

  React.useEffect(() => {
    if (!selectedNode || !hydrateNode) return;

    const nodeId = selectedNode.id;
    logger.log('[App] selectedNode changed:', nodeId, 'code:', !!selectedNode.code, '_isMissingCode:', selectedNode._isMissingCode);

    if (selectedNode.code || selectedNode._isMissingCode) return;

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
              ) : viewMode === 'test' ? (
                <TestScreen preSelectedNodeId={selectedNode?.id} />
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