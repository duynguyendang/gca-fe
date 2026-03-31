
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FlatGraph, ASTNode } from './types';
import { useAppContext, NarrativeMessage } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration, useContextualSuggestions } from './hooks';
import { CodePanel } from './components/Layout';
import { NarrativeScreen } from './components/NarrativeScreen';
import { LandingScreen } from './components/LandingScreen/LandingScreen';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import AppFooter from './components/AppFooter';
import SettingsModal from './components/SettingsModal';
import GraphContainer from './components/GraphContainer';
import UnifiedSearchBar from './components/UnifiedSearchBar';
import { useSessionStorage } from './hooks/useSessionStorage';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { fetchFileCalls } from './services/graphService';
import { logger } from './src/logger';
import './src/prismSetup';

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
    narrativeMessages, setNarrativeMessages,
    isNarrativeLoading, setIsNarrativeLoading,
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

  // Context-aware suggestions
  const { suggestions: contextualSuggestions } = useContextualSuggestions();

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
      toast.info(`Loading project: ${project.name}`);
      syncDataFromApi(dataApiBase, projectId, () => {
        toast.success(`Project ${project.name} loaded`);
      });
    }
  }, [availableProjects, dataApiBase, setCurrentProject, setSelectedProjectId, syncDataFromApi, toast]);

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
        const modes = ['narrative', 'flow', 'map', 'discovery', 'architecture'] as const;
        const idx = parseInt(e.key) - 1;
        if (idx < modes.length) setViewMode(modes[idx]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, setIsCodeCollapsed, setSelectedNode, setSearchTerm]);

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

  // Smart search handler - switches to Narrative mode for questions
  const handleSmartSearchWithNarrativeSwitch = useCallback(async (query: string) => {
    // Switch to Narrative mode for AI-powered explanations
    setViewMode('narrative');

    // Build comprehensive context from current view state
    let contextData: any[] = [];
    let enhancedQuery = query;

    // Always include project information
    if (currentProject) {
      enhancedQuery = `[Analyzing project: ${currentProject}] ${query}`;
    }

    // Add selected node context with full code
    if (selectedNode) {
      let nodeCode = selectedNode.code;

      // If no code, try to fetch it
      if (!nodeCode || nodeCode.trim() === '') {
        if (selectedNode.id && dataApiBase && selectedProjectId) {
          try {
            const { fetchSource } = await import('./services/graphService');
            nodeCode = await fetchSource(dataApiBase, selectedProjectId, selectedNode.id);
            logger.log('[App] Fetched source for selected node:', selectedNode.id, 'Code length:', nodeCode?.length || 0);
          } catch (e) {
            logger.error('[App] Failed to fetch source:', e);
          }
        }
      }

      // Include the selected node with full context
      contextData.push({
        id: selectedNode.id,
        name: selectedNode.name,
        kind: selectedNode.kind || selectedNode.type || 'unknown',
        code: nodeCode || '// No code available',
        filePath: selectedNode._filePath || selectedNode.filePath || selectedNode.id,
        start_line: selectedNode.start_line || 1,
        end_line: selectedNode.end_line || 100,
        language: selectedNode.language || detectLanguage(selectedNode._filePath || selectedNode.id),
      });

      // Add context description for the selected node
      const nodeInfo = `\nSelected element: ${selectedNode.name} (${selectedNode.kind || selectedNode.type})`;
      enhancedQuery += nodeInfo;
    }

    // Add visible graph context - include FULL code for important nodes
    if (fileScopedNodes && fileScopedNodes.length > 0) {
      // Include visible nodes in context (up to 30 most relevant) with FULL code
      const relevantNodes = fileScopedNodes.slice(0, 30);

      for (const node of relevantNodes) {
        // Skip the selected node to avoid duplicates
        if (node.id !== selectedNode?.id && contextData.length < 50) {
          // Try to fetch full code for each important node
          let nodeCode = node.code;

          // If no code but we have an ID, try to fetch the full source
          if ((!nodeCode || nodeCode.trim() === '') && node.id && dataApiBase && selectedProjectId) {
            try {
              const { fetchSource } = await import('./services/graphService');
              nodeCode = await fetchSource(dataApiBase, selectedProjectId, node.id);
              logger.log('[App] Fetched full source for node:', node.id, 'Code length:', nodeCode?.length || 0);
            } catch (e) {
              logger.warn('[App] Failed to fetch source for node:', node.id, e);
            }
          }

          contextData.push({
            id: node.id,
            name: node.name || node.id,
            kind: node.kind || node.type || 'unknown',
            code: nodeCode || '', // Send FULL code, not empty
            filePath: node._filePath || node.filePath || node.id,
            language: node.language || detectLanguage(node._filePath || node.id),
          });
        }
      }

      enhancedQuery += `\n\nCurrently viewing ${fileScopedNodes.length} elements in ${viewMode} mode.`;
    }

    // If no graph context, try to include basic project info with FULL code samples
    if (contextData.length === 0 && astData && 'nodes' in astData) {
      const totalNodes = (astData.nodes as any[]).length;
      enhancedQuery += `\n\nProject contains ${totalNodes} analyzed elements.`;

      // Include a few sample nodes with FULL code from the project
      const sampleNodes = (astData.nodes as any[]).slice(0, 5); // Fewer nodes but with FULL code

      for (const node of sampleNodes) {
        if (contextData.length < 10) {
          let nodeCode = node.code;

          // Try to fetch full code
          if ((!nodeCode || nodeCode.trim() === '') && node.id && dataApiBase && selectedProjectId) {
            try {
              const { fetchSource } = await import('./services/graphService');
              nodeCode = await fetchSource(dataApiBase, selectedProjectId, node.id);
              logger.log('[App] Fetched full source for sample node:', node.id);
            } catch (e) {
              logger.warn('[App] Failed to fetch source for sample node:', node.id);
            }
          }

          contextData.push({
            id: node.id,
            name: node.name || node.id,
            kind: node.kind || node.type || 'unknown',
            code: nodeCode || '',
            filePath: node._filePath || node.filePath || node.id,
          });
        }
      }
    }

    // Add view mode context
    const viewDescriptions = {
      architecture: 'architecture diagram (showing module relationships)',
      discovery: 'discovery view (showing code structure)',
      map: 'code map (showing file relationships)',
      flow: 'flow view (showing execution flow)',
      narrative: 'narrative view',
    };

    const viewDesc = viewDescriptions[viewMode as keyof typeof viewDescriptions] || viewMode;
    enhancedQuery += `\n\nViewing ${viewDesc}.`;

    // Add conversation context if there's an existing conversation
    if (narrativeMessages.length > 0) {
      enhancedQuery += `\n\n[Continuing conversation - ${narrativeMessages.length} messages in history]`;
      // Include project context from the conversation
      const lastAIResponse = [...narrativeMessages].reverse().find(m => m.role === 'ai');
      if (lastAIResponse && lastAIResponse.content) {
        // The AI should remember what was discussed
        enhancedQuery += `\n[Context: We were discussing this codebase]`;
      }
    }

    // For "Explain this code" specifically, add more detailed context
    if (query === 'Explain this code') {
      enhancedQuery = `I'm currently viewing code in ${viewDesc}.\n\n`;

      if (selectedNode) {
        enhancedQuery += `Selected element: "${selectedNode.name}" (${selectedNode.kind || selectedNode.type})\n`;
        enhancedQuery += `File: ${selectedNode._filePath || selectedNode.filePath || 'Unknown'}\n`;
        if (selectedNode.code && selectedNode.code.trim() !== '') {
          // Send FULL code, not just snippets
          enhancedQuery += `\nFull Code:\n${selectedNode.code.trim()}\n`;
        }
      }

      if (fileScopedNodes && fileScopedNodes.length > 0) {
        enhancedQuery += `\n\nCurrently viewing ${fileScopedNodes.length} elements:\n`;
        fileScopedNodes.slice(0, 10).forEach((node: any) => {
          enhancedQuery += `- ${node.name || node.id} (${node.kind || node.type})\n`;
        });
      }

      enhancedQuery += `\n\nPlease analyze the FULL code and provide:\n1. What this code does (complete functionality)\n2. How all components interact\n3. Key patterns and architecture\n4. Any potential improvements`;
    }

    // Set the search term
    setSearchTerm(query);

    // Create user message
    const userMsg: NarrativeMessage = {
      role: 'user',
      content: enhancedQuery,
      timestamp: Date.now(),
    };

    setNarrativeMessages(prev => [...prev, userMsg]);
    setIsNarrativeLoading(true);

    try {
      if (dataApiBase && selectedProjectId) {
        // Try to get project summary for additional context
        try {
          const { fetchSummary } = await import('./services/graphService');
          const freshSummary = await fetchSummary(dataApiBase, selectedProjectId);
          if (freshSummary?.top_symbols) {
            // Add top symbols to context if not already included
            const existingIds = new Set(contextData.map(n => n.id));
            const selectedNodeId = selectedNode?.id;

            freshSummary.top_symbols
              .filter((s: any) => s.id !== selectedNodeId && !existingIds.has(s.id))
              .slice(0, 15)
              .forEach((symbol: any) => {
                contextData.push({
                  id: symbol.id,
                  name: symbol.name,
                  kind: symbol.kind || symbol.type || 'unknown',
                  code: symbol.code || '',
                  filePath: symbol._filePath || symbol.filePath || symbol.id,
                });
              });
          }
        } catch (e) {
          logger.warn('[App] Failed to fetch summary, continuing without it:', e);
        }

        const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
        const { fetchWithTimeout } = await import('./utils/fetchWithTimeout');

        logger.log('[App] Sending query with context:', {
          query: enhancedQuery.substring(0, 100) + '...',
          contextItems: contextData.length,
          project: selectedProjectId
        });

        const response = await fetchWithTimeout(`${cleanBase}/api/v1/ai/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: selectedProjectId,
            query: enhancedQuery,
            context: contextData.length > 0 ? contextData : undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('[App] AI API error:', response.status, errorText);
          throw new Error(`AI service error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.answer || data.response || 'No response received.';

        logger.log('[App] AI response received:', aiResponse.substring(0, 100) + '...');

        const aiMsg: NarrativeMessage = {
          role: 'ai',
          content: aiResponse,
          timestamp: Date.now(),
          sections: data.sections ? data.sections.map((s: any) => ({
            type: s.type || 'info',
            title: s.title || 'Information',
            content: s.content || s.text || '',
            actionLabel: s.action_label,
          })) : undefined,
        };

        setNarrativeMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error('Not connected to API. Please connect to a project first.');
      }
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
  }, [setViewMode, setSearchTerm, selectedNode, dataApiBase, selectedProjectId, setNarrativeMessages, setIsNarrativeLoading, viewMode, fileScopedNodes, astData, currentProject]);

  // Helper function to detect language from file path
  const detectLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'go': 'go',
      'py': 'python',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
    };
    return langMap[ext || ''] || 'unknown';
  };
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
    logger.log('Node selected:', node.id, 'isNavigation:', isNavigation);
    setSelectedNode(node);

    // If it's a file navigation, fetch the file's graph data and switch to Architecture view
    if (isNavigation && node._isFile && dataApiBase && selectedProjectId) {
      try {
        logger.log('[App] Fetching file calls for:', node._filePath || node.id);
        const fileId = node._filePath || node.id;
        const graphData = await fetchFileCalls(dataApiBase, selectedProjectId, fileId, 3);

        if (graphData && graphData.nodes) {
          logger.log('[App] File graph loaded:', graphData.nodes.length, 'nodes');
          setFileScopedNodes(graphData.nodes);
          setFileScopedLinks(graphData.links || []);
          // Automatically switch to Architecture view when a file is selected
          setViewMode('architecture');
        }
      } catch (err) {
        logger.error('[App] Failed to fetch file calls:', err);
      }
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
    if (selectedNode._filePath) {
      hydrateId = selectedNode._filePath;
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isSubModeSwitching={isSubModeSwitching}
          openSettings={openSettings}
          isSearching={isSearching}
        />

          <div className="relative flex-1 flex flex-col min-h-0">
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
    </ErrorBoundary>
  );
};

export default App;
