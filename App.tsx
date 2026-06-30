import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { FlatGraph } from './types';
import { useToast } from './context/ToastContext';
import { useGraphContext } from './context/GraphContext';
import { useSearchContext } from './context/SearchContext';
import { useNarrativeContext, NarrativeMessage } from './context/NarrativeContext';
import { useSettingsContext } from './context/SettingsContext';
import { useUIContext } from './context/UIContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration, useContextualSuggestions, useIntentRouter, useExploreGraph } from './hooks';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import AppFooter from './components/AppFooter';
import UnifiedSearchBar from './components/UnifiedSearchBar';
import { useSessionStorage } from './hooks/useSessionStorage';
import { useQueryContext } from './hooks/useQueryContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { fetchFileCalls, fetchPredicates, fetchSource } from './services/graphService';
import { askAI, askAIStream, ChatMessage } from './services/geminiService';
import { logger } from './logger';
import { requestManager } from './utils/requestManager';
import { CUSTOM_EVENTS, EXPLAIN_CODE_QUERY } from './constants';
import { classifyIntentRoute } from './utils/queryClassifier';
import SuspenseFallback from './components/common/SuspenseFallback';

// ---------------------------------------------------------------------------
// Lazy-loaded views & modals
// ---------------------------------------------------------------------------
// Each `React.lazy` boundary produces its own JS chunk so the user only pays
// the parse / download cost when they actually navigate to it. This is the
// main reason the previous 738 KB main bundle existed: every view, every
// modal, and every heavy 3rd-party dep was loaded up-front.
//
// Why each one is lazy:
//  - LandingScreen       : only shown when no project is connected (first run).
//  - Dashboard           : viewMode === 'dashboard'; pulls in recharts.
//  - NarrativeScreen     : viewMode === 'narrative'; pulls in react-markdown,
//                          dompurify, and geminiService.
//  - TestScreen          : viewMode === 'test'; rarely used.
//  - GraphContainer      : main graph view (default). Lazy-loaded so its d3
//                          subgraph + TreeVisualizer/ClassDiagramCanvas is
//                          fetched in parallel with initial paint.
//  - SettingsModal       : opened on demand.
//  - ShortcutsModal      : opened on demand.
//  - OKFIngestModal      : opened on demand.
//  - ReviewSessionModal  : opened on demand.
//
// Prism syntax highlighting (prismSetup) is *not* imported here — it must be
// loaded by the components that actually render source code (HighlightedCode)
// so the Prism language packs don't bloat the main bundle.
// ---------------------------------------------------------------------------

const LandingScreen = React.lazy(() =>
  import('./components/LandingScreen/LandingScreen').then(m => ({ default: m.LandingScreen })),
);
const Dashboard = React.lazy(() =>
  import('./components/Dashboard').then(m => ({ default: m.Dashboard })),
);
const NarrativeScreen = React.lazy(() =>
  import('./components/NarrativeScreen').then(m => ({ default: m.NarrativeScreen })),
);
const TestScreen = React.lazy(() =>
  import('./components/TestScreen/TestScreen').then(m => ({ default: m.default })),
);
const GraphContainer = React.lazy(() =>
  import('./components/GraphContainer').then(m => ({ default: m.default })),
);
// CodePanel pulls in Prism via HighlightedCode → prismSetup → prismjs.
// Lazy-loading it keeps the syntax-highlighter + ~250KB language packs out
// of the main chunk. It is only rendered alongside GraphContainer, so they
// share a single Suspense boundary below.
const CodePanel = React.lazy(() =>
  import('./components/Layout/CodePanel').then(m => ({ default: m.default })),
);

const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal').then(m => ({ default: m.default })),
);
const ShortcutsModal = React.lazy(() =>
  import('./components/ShortcutsModal').then(m => ({ default: m.default })),
);
const OKFIngestModal = React.lazy(() =>
  import('./components/OKFIngestModal').then(m => ({ default: m.default })),
);
const ReviewSessionModal = React.lazy(() =>
  import('./components/ReviewSession/ReviewSessionModal').then(m => ({ default: m.default })),
);

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
    narrativeMessages,
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
    isShortcutsOpen, setIsShortcutsOpen,
  } = useUIContext();

  const [isSubModeSwitching, setIsSubModeSwitching] = useState(false);
  const nodeSelectRequestRef = useRef<string | null>(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isReviewSessionOpen, setIsReviewSessionOpen] = useState(false);

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
  const openShortcuts = useCallback(() => setIsShortcutsOpen(true), []);
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
        setIsShortcutsOpen(false);
      } else if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (mod && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const modes = ['narrative', 'discovery', 'architecture', 'map', 'test', 'dashboard'] as const;
        const idx = parseInt(e.key) - 1;
        if (idx < modes.length) setViewMode(modes[idx]!);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, setIsCodeCollapsed, setSelectedNode, setSearchTerm, setIsShortcutsOpen]);

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

    const { contextData, symbolId } = await buildContext(query);

    // Build conversation history from current narrative messages
    const chatMessages: ChatMessage[] = narrativeMessages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .map(m => ({
            role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
            content: m.content,
        }));

    let fullQuery = query;
    if (currentProject) {
      fullQuery = `[Analyzing project: ${currentProject}] ${query}`;
    }

    if (query === EXPLAIN_CODE_QUERY && selectedNode) {
      fullQuery = `Explain the selected code: "${selectedNode.name}" (${selectedNode.kind || selectedNode.type})`;

      if (fileScopedNodes && fileScopedNodes.length > 0) {
        const fileSet = new Set<string>();
        for (const node of fileScopedNodes) {
          const fp = (node as any)._filePath || (node as any).filePath || (node as any).file_path;
          if (fp) fileSet.add(fp);
        }
        if (fileSet.size > 0) {
          fullQuery += `\n\nFiles in this graph:\n${Array.from(fileSet).sort().map(f => `- ${f}`).join('\n')}`;
        }
      }

      fullQuery += `\n\nPlease analyze and provide:\n1. What this code does\n2. How components interact\n3. Key patterns\n4. Potential improvements`;
    }

    const userQueryForHistory = query === EXPLAIN_CODE_QUERY && selectedNode
      ? `Explain the selected code: "${selectedNode.name}" (${selectedNode.kind || selectedNode.type})`
      : query;

    const userMsg: NarrativeMessage = {
      role: 'user',
      content: userQueryForHistory,
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
        symbol_id: symbolId,
        data: contextData.length > 0 ? contextData : undefined,
        messages: chatMessages,
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
  }, [setViewMode, setSearchTerm, selectedNode, dataApiBase, selectedProjectId, setNarrativeMessages, setIsNarrativeLoading, currentProject, buildContext, toast, addConversationTurn, handleIntent, handleExploreIntent, handleNavigateIntent, narrativeMessages]);

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
        <Suspense fallback={<SuspenseFallback label="Loading…" />}>
          <LandingScreen />
        </Suspense>
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
            openShortcuts={openShortcuts}
            isSearching={isSearching}
            isConnected={!!dataApiBase && availableProjects.length > 0}
            isDataSyncing={isDataSyncing}
            onOpenIngestModal={() => setIsIngestModalOpen(true)}
            onOpenReviewSession={() => setIsReviewSessionOpen(true)}
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
                <Suspense fallback={<SuspenseFallback label="Loading Narrative…" />}>
                  <NarrativeScreen
                    onNodeSelect={handleNodeSelect}
                    onLinkClick={(href: string) => logger.log('Link clicked:', href)}
                    onSymbolClick={(symbol: string) => logger.log('Symbol clicked:', symbol)}
                  />
                </Suspense>
              ) : viewMode === 'dashboard' ? (
                <Suspense fallback={<SuspenseFallback label="Loading Dashboard…" />}>
                  <Dashboard refreshKey={'dashboard-' + selectedProjectId} />
                </Suspense>
              ) : viewMode === 'test' ? (
                <Suspense fallback={<SuspenseFallback label="Loading Tests…" />}>
                  <TestScreen preSelectedNodeId={selectedNode?.id} />
                </Suspense>
              ) : (
                <div className={`flex-1 flex min-h-0 ${isSubModeSwitching ? 'animate-pulse opacity-80' : 'transition-opacity duration-500'}`}>
                  <Suspense fallback={<SuspenseFallback label="Loading Graph…" />}>
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
                      onNavigateToSymbol={(symbolId: string) => {
                        const targetNode = (fileScopedNodes || []).find((n: any) => n.id === symbolId)
                          || (astData && 'nodes' in astData ? (astData as any).nodes.find((n: any) => n.id === symbolId) : null);
                        if (targetNode) {
                          handleNodeSelect(targetNode, true);
                        } else {
                          handleNodeSelect({ id: symbolId, name: symbolId.split('#').pop() || symbolId, _isMissingCode: true }, true);
                        }
                      }}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>

        <AppFooter
          astData={astData as FlatGraph}
          dataApiBase={dataApiBase}
        />
      </div>

      {/* Modals — gated by `isOpen` so the lazy chunk is only fetched when
          the user actually opens the modal. Each modal is wrapped in its own
          <Suspense> boundary because we want a tight fallback (overlay) rather
          than collapsing the whole view. */}
      {isSettingsOpen && (
        <Suspense fallback={<SuspenseFallback variant="inline" label="Opening Settings…" />}>
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
        </Suspense>
      )}
      {isShortcutsOpen && (
        <Suspense fallback={<SuspenseFallback variant="inline" label="Opening Shortcuts…" />}>
          <ShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        </Suspense>
      )}
      {isIngestModalOpen && (
        <Suspense fallback={<SuspenseFallback variant="inline" label="Opening Ingest…" />}>
          <OKFIngestModal
            isOpen={isIngestModalOpen}
            onClose={() => setIsIngestModalOpen(false)}
            dataApiBase={dataApiBase}
            selectedProjectId={selectedProjectId}
            availableProjects={availableProjects}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.REFRESH_DASHBOARD));
            }}
          />
        </Suspense>
      )}
      {isReviewSessionOpen && (
        <Suspense fallback={<SuspenseFallback variant="inline" label="Opening Review Session…" />}>
          <ReviewSessionModal
            isOpen={isReviewSessionOpen}
            onClose={() => setIsReviewSessionOpen(false)}
            dataApiBase={dataApiBase}
            selectedProjectId={selectedProjectId}
          />
        </Suspense>
      )}
      </div>
      )}
    </ErrorBoundary>
  );
};

export default App;