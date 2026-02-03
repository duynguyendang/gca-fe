
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import TreeVisualizer from './components/TreeVisualizer/index';
import ClassDiagramCanvas from './components/ClassDiagramCanvas';
import FileTreeItem from './components/FileTreeItem'; // Keep for now
import { ASTNode, FlatGraph, BackboneGraph, BackboneNode, BackboneLink } from './types';
import { findShortestPath, PathResult } from './utils/pathfinding';
import { useAppContext } from './context/AppContext';
import { useApiSync, useResizePanels, useSmartSearch, useInsights, useManifest, useNodeHydration } from './hooks';
import { CodePanel, SynthesisPanel } from './components/Layout';
import { stratifyPaths } from './utils/graphUtils';
import {
  fetchGraphMap,
  fetchFileDetails,
  fetchBackbone,
  fetchProjects,
  fetchFiles,
  fetchHydrate,
  executeQuery,
  fetchFileGraph,
  fetchFileImports,
  fetchFileCalls,
  fetchSource,
  fetchSymbols,
  fetchFlowPath,
  fetchFileBackbone,
  fetchPredicates,
  fetchSubgraph,

  GraphMapResponse,
  FileDetailsResponse
} from './services/graphService';

// Ensure Prism is available for highlighting
declare var Prism: any;



const App: React.FC = () => {
  // 1. Global Context
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
    // vars below shadowed by useSmartSearch hook
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
  } = context;

  // 2. Local State
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchitecturePanel, setShowArchitecturePanel] = useState(false);
  const [isClustered, setIsClustered] = useState(false);

  // 3. Hooks initialization
  const { manifest } = useManifest(dataApiBase, selectedProjectId);
  const { syncDataFromApi } = useApiSync();
  const { hydrateNode } = useNodeHydration();

  const {
    startResizeSidebar,
    startResizeCodePanel,
    startResizeSynthesis,
    sidebarWidth,
    codePanelWidth,
    synthesisHeight,
    setSynthesisHeight,
    isCodeCollapsed,
    setIsCodeCollapsed,
    isSynthesisCollapsed,
    setIsSynthesisCollapsed
  } = useResizePanels();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug wrapper
  const debugSetViewMode = useCallback((newMode: typeof viewMode) => {
    // console.log('setViewMode called:', { from: viewMode, to: newMode });
    setViewMode(newMode);
  }, [viewMode, setViewMode]);

  // Search Hook
  const {
    handleSmartSearch,
    searchStatus,     // Use hook state for UI
    isSearching,      // Use hook state for UI 
    searchError,      // Use hook state for UI
    setSearchError    // Expose setter for UI clearing
  } = useSmartSearch({
    ...context,
    manifest,
    onViewModeChange: debugSetViewMode,
  });
  const searchSymbols = handleSmartSearch; // Alias

  // Insights Hook
  const { generateInsights, clearInsight } = useInsights();

  // History Logic
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queryHistory');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch (e) { }
  }, []);

  const addToHistory = useCallback((query: string) => {
    if (!query || !query.trim()) return;
    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('queryHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('queryHistory');
  }, []);

  // Callbacks
  const openSettings = useCallback(() => setIsSettingsOpen(true), [setIsSettingsOpen]);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), [setIsSettingsOpen]);
  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);
  const syncApi = useCallback(() => syncDataFromApi(dataApiBase), [dataApiBase, syncDataFromApi]);

  const setFlowMode = useCallback(() => debugSetViewMode('flow'), [debugSetViewMode]);
  const setMapMode = useCallback(() => debugSetViewMode('map'), [debugSetViewMode]);
  const setDiscoveryMode = useCallback(() => debugSetViewMode('discovery'), [debugSetViewMode]);
  const setArchitectureMode = useCallback(() => debugSetViewMode('architecture'), [debugSetViewMode]);

  // Auto-resize Synthesis Panel when Insight is loaded
  useEffect(() => {
    if (nodeInsight) {
      // Expand to ~80% of screen height and expand panel if collapsed
      setSynthesisHeight(window.innerHeight * 0.8);
      setIsSynthesisCollapsed(false);
      setIsCodeCollapsed(true); // Auto-collapse code when synthesis expands
    } else {
      // Reset to default
      setSynthesisHeight(256);
      setIsCodeCollapsed(false);
    }
  }, [nodeInsight]);

  useEffect(() => {
    try {
      sessionStorage.setItem('gca_ast_data', JSON.stringify(astData));
    } catch (e) {
      // Ignore quota errors for large graphs
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.debug('Session storage quota exceeded, persistence disabled for this session.');
      } else {
        console.warn('Failed to save AST data to session storage:', e);
      }
    }
  }, [astData]);

  useEffect(() => {
    try {
      sessionStorage.setItem('gca_sandbox_files', JSON.stringify(sandboxFiles));
    } catch (e) {
      console.warn('Failed to save sandbox files to session storage:', e);
    }
  }, [sandboxFiles]);

  // Initialize from session storage if available
  useEffect(() => {
    if (dataApiBase) {
      sessionStorage.setItem('gca_api_base', dataApiBase);
    }
  }, [dataApiBase]);

  // Auto-sync on mount if API base URL is configured
  useEffect(() => {
    if (dataApiBase && !isDataSyncing && availableProjects.length === 0) {
      console.log('[Auto-Sync] Connecting to API on mount:', dataApiBase);
      syncDataFromApi(dataApiBase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount



  // Fetch predicates when project changes
  useEffect(() => {
    if (!dataApiBase || !selectedProjectId) return;

    fetchPredicates(dataApiBase, selectedProjectId)
      .then((preds: any[]) => {
        // Extract predicate names (backend returns { name: "calls" })
        const predNames = preds.map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
        console.log('Fetched predicates:', predNames);
        setAvailablePredicates(predNames);
      })
      .catch((err: any) => console.warn('Failed to fetch predicates:', err));
  }, [dataApiBase, selectedProjectId]);

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

    // Resize handlers are now managed by useResizePanels hook
  }, []);





  // Wrapper for UI


  // Additional memoized callbacks
  const runSearch = useCallback(() => {
    if (searchTerm) {
      searchSymbols(searchTerm);
    }
  }, [searchTerm, searchSymbols]);





  // Expand a file to show its internal symbols
  const expandFile = useCallback(async (fileId: string) => {
    // Check if already expanded
    if (expandedFileIds.has(fileId)) {
      console.log('[Expand] File already expanded:', fileId);
      return;
    }

    // Check cache first
    if (fileDetailsCache.has(fileId)) {
      console.log('[Expand] Using cached details for:', fileId);
      setExpandedFileIds(prev => new Set(prev).add(fileId));
      return;
    }

    if (!dataApiBase || !selectedProjectId) {
      console.warn('[Expand] Missing dataApiBase or selectedProjectId');
      return;
    }

    console.log('[Expand] Fetching file details:', fileId);
    setExpandingFileId(fileId);

    try {
      const details = await fetchFileDetails(dataApiBase, fileId, selectedProjectId);
      console.log('[Expand] Successfully fetched file details:', {
        fileId,
        nodeCount: details.nodes?.length,
        linkCount: details.links?.length,
        sampleNodes: details.nodes?.slice(0, 3)
      });

      // Get Architecture Summary from AI (non-blocking, show all nodes immediately)
      // DISABLED: User request to manual trigger only

      //   console.warn('[Expand] Architecture Summary failed:', err);
      // });

      // Cache the result
      setFileDetailsCache(prev => new Map(prev).set(fileId, details));

      // Add to expanded set
      setExpandedFileIds(prev => new Set(prev).add(fileId));

      // If we are currently viewing this file in Flow mode, update the view to include internals
      if (currentFlowFileRef.current === fileId && viewMode === 'flow') {
        const newNodes = [...fileScopedNodes];
        const newLinks = [...fileScopedLinks];

        // Add ALL nodes (no pruning by default)
        details.nodes.forEach((n: any) => {
          if (!newNodes.find(en => en.id === n.id)) {
            newNodes.push({ ...n, _parentFile: fileId, _isExpandedChild: true });
          }
        });

        // Add ALL internal links
        details.links.forEach((l: any) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;

          const exists = newLinks.find(el =>
            (typeof el.source === 'object' ? el.source.id : el.source) === s &&
            (typeof el.target === 'object' ? el.target.id : el.target) === t
          );
          if (!exists) {
            newLinks.push({ ...l, _parentFile: fileId });
          }
        });

        setFileScopedNodes(newNodes);
        setFileScopedLinks(newLinks);
      }

    } catch (error) {
      console.error('[Expand] Error fetching file details:', error);
    } finally {
      setExpandingFileId(null);
    }
  }, [dataApiBase, selectedProjectId, expandedFileIds, fileDetailsCache, fileScopedNodes, fileScopedLinks, viewMode]);

  // Markdown Interaction Handlers (Moved here to access expandFile)
  const handleMarkdownLinkClick = useCallback((href: string) => {
    console.log('[Markdown] Link clicked:', href);
    // Remove leading slash if any
    const cleanPath = href.replace(/^\//, '');

    // Check if it's a file by extension
    if (cleanPath.match(/\.[a-z]+$/i)) {
      // Find file ID (simple match for now, ideally use manifest)
      // We accept cleanPath as ID if it looks like a file path
      expandFile(cleanPath);

      // Auto-focus logic?
      // const fileNode = (astData as FlatGraph).nodes.find(n => n.id === cleanPath);
      // if (fileNode) setSelectedNode(fileNode);
    }
  }, [expandFile]);

  const handleMarkdownSymbolClick = useCallback((symbol: string) => {
    console.log('[Markdown] Symbol clicked:', symbol);
    // Clean symbol
    const cleanSymbol = symbol.trim();
    if (!cleanSymbol) return;

    // Trigger search or find node
    // Let's try to find it in the current graph first
    const existingNode = (astData as FlatGraph).nodes?.find((n: any) => n.name === cleanSymbol || n.id.endsWith(`:${cleanSymbol}`));

    if (existingNode) {
      setSelectedNode(existingNode);
      debugSetViewMode('discovery'); // Switch to see it?
    } else {
      // Fallback to search
      setSearchTerm(cleanSymbol);
      handleSmartSearch(cleanSymbol);
    }
  }, [astData, handleSmartSearch, debugSetViewMode]);

  // Collapse a file to hide its internal symbols
  const collapseFile = useCallback((fileId: string) => {
    console.log('[Collapse] Collapsing file:', fileId);
    setExpandedFileIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });

    // If viewing this file, remove internals from view
    if (currentFlowFileRef.current === fileId && viewMode === 'flow') {
      // Filter out nodes/links that belong to this file's expansion (internal symbols)
      // Keep the File Node itself and External Imports
      // Internal symbols usually have `kind` != 'file' AND `filePath` == fileId OR `_parentFile` == fileId
      // But the File Node itself has `id` == fileId.

      setFileScopedNodes(prev => prev.filter(n => {
        // Keep the file node itself
        if (n.id === fileId) return true;
        // Keep nodes that are NOT internal children of this file
        // "Internal child" logic: 
        // 1. _parentFile === fileId
        // 2. OR id starts with fileId + ":" (simplistic)
        // But we must keep IMPORT TARGETS. Import targets usually have different filePath.

        if (n._parentFile === fileId) return false;

        // If it's an internal symbol (same file path) but not the file node, remove it
        const nodeFilePath = n.filePath || (n.id.includes(':') ? n.id.split(':')[0] : n.id);
        if (nodeFilePath === fileId && n.id !== fileId) return false;

        return true;
      }));

      setFileScopedLinks(prev => prev.filter(l => {
        // Remove links where source OR target is removed?
        // Actually just remove internal links (_parentFile === fileId)
        // or links between internal nodes.
        if (l._parentFile === fileId) return false;
        return true;
      }));
    }
  }, [fileScopedNodes, viewMode]);

  // Toggle Focus Mode

  // Toggle file expansion state
  const toggleFileExpansion = useCallback((fileId: string) => {
    if (expandedFileIds.has(fileId)) {
      collapseFile(fileId);
    } else {
      expandFile(fileId);
    }
  }, [expandedFileIds, expandFile, collapseFile]);

  // Build expanded graph data (combines base graph + expanded file details)
  const expandedGraphData = useMemo(() => {
    if (!astData || !('nodes' in astData)) {
      return astData;
    }

    const baseNodes = astData.nodes || [];
    const baseLinks = astData.links || [];

    // Collect all expanded nodes and links
    const expandedNodes: any[] = [...baseNodes];
    const expandedLinks: any[] = [...baseLinks];

    // Add nodes/links from expanded files
    for (const fileId of expandedFileIds) {
      const details = fileDetailsCache.get(fileId);
      if (details) {
        // Add symbol nodes
        details.nodes.forEach(node => {
          // Mark node with parent file reference
          expandedNodes.push({
            ...node,
            _parentFile: fileId,
            _isExpandedChild: true
          });
        });

        // Add internal links
        details.links.forEach(link => {
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

  const loadFileBackbone = useCallback(async (fileId: string) => {
    if (!dataApiBase || !selectedProjectId) return;

    setIsFlowLoading(true);
    // Silent load - no auto insight
    // setNodeInsight("Generating Backbone Insight...");

    try {
      // 1. Fetch Backbone (File-to-File depth 1)
      const backbone = await fetchFileBackbone(dataApiBase, selectedProjectId, fileId);

      if (backbone && backbone.nodes) {
        // Update Main Graph (Discovery View)
        setAstData({
          nodes: backbone.nodes.map(n => ({ ...n, _project: selectedProjectId })),
          links: backbone.links || []
        });

        // Update Architecture Panel (Dagre View)
        setFileScopedNodes(backbone.nodes);
        setFileScopedLinks(backbone.links || []);
        // Removed auto-switch: setShowArchitecturePanel(true);

        currentFlowFileRef.current = fileId;
        // Removed auto-switch: debugSetViewMode('backbone');


        // 2. Fetch Source Code for the file immediately
        const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
        fetchSource(cleanBase, selectedProjectId, fileId).then(src => {
          // Update the selected node (the file itself) with code
          setSelectedNode(prev => {
            // Try to find the file node in backbone
            const fileNode = backbone.nodes.find(n => n.id === fileId);
            return { ...(fileNode || {}), id: fileId, code: src, _isFile: true, _project: selectedProjectId };
          });
        });

        // 3. AI Insight - DISABLED for Reactive Mode
        // getFileRoleSummary(fileId, backbone.nodes, geminiApiKey).then(summary => {
        //   setNodeInsight(summary);
        // });

      } else {
        // Silent failure
        // setNodeInsight("No dependencies found.");
        setFileScopedNodes([]);
        setFileScopedLinks([]);
      }
    } catch (e) {
      console.error("Backbone Load Failed", e);
      setNodeInsight("Failed to load file backbone.");
    } finally {
      setIsFlowLoading(false);
    }
  }, [dataApiBase, selectedProjectId, debugSetViewMode]);

  const expandCluster = useCallback(async (clusterNode: any) => {
    if (!clusterNode.metadata || !clusterNode.metadata.members) return;
    const memberIds = clusterNode.metadata.members.split(',').filter(Boolean);
    if (memberIds.length === 0) return;

    try {
      setCtxSearchStatus(`Expanding ${clusterNode.name}...`);
      const subgraph = await fetchSubgraph(dataApiBase, selectedProjectId, memberIds);
      setCtxSearchStatus(null);

      if (!subgraph || !subgraph.nodes || subgraph.nodes.length === 0) return;

      console.log("Expanding Cluster - New Nodes:", subgraph.nodes.length);

      // 1. Update Links First (Requires OLD nodes + New Subgraph)
      setFileScopedLinks(prev => {
        const nodeToCluster = new Map<string, string>();
        // Using fileScopedNodes from closure (current state before update)
        fileScopedNodes.forEach(n => {
          if (n.kind === 'cluster' && n.metadata?.members) {
            const members = n.metadata.members.split(',');
            members.forEach((m: string) => nodeToCluster.set(m, n.id));
          }
        });

        // Filter output links from removed cluster
        const keptLinks = prev.filter(l => l.source !== clusterNode.id && l.target !== clusterNode.id);

        const newSubgraphLinks = (subgraph.links || []).map(l => {
          let source = l.source;
          let target = l.target;
          const newIds = new Set(subgraph.nodes.map(n => n.id));

          if (!newIds.has(source)) {
            const cid = nodeToCluster.get(source);
            if (cid && cid !== clusterNode.id) source = cid;
          }
          if (!newIds.has(target)) {
            const cid = nodeToCluster.get(target);
            if (cid && cid !== clusterNode.id) target = cid;
          }
          return { ...l, source, target };
        });

        return [...keptLinks, ...newSubgraphLinks];
      });

      // 2. Update Nodes
      setFileScopedNodes(prev => {
        const newNodes = prev.filter(n => n.id !== clusterNode.id);
        const added = subgraph.nodes.map(n => ({ ...n, _project: selectedProjectId }));
        return [...newNodes, ...added];
      });

    } catch (e) {
      console.error("Expand failed", e);
      setCtxSearchStatus("Expansion failed");
      setTimeout(() => setCtxSearchStatus(null), 2000);
    }
  }, [dataApiBase, selectedProjectId, fileScopedNodes, setFileScopedNodes, setFileScopedLinks, setCtxSearchStatus]);

  const handleNodeSelect = useCallback(async (node: any) => {
    // Check for Cluster
    if (node.kind === 'cluster') {
      expandCluster(node);
      return;
    }

    console.log('=== SYNC TRINITY: Node Clicked ===');
    console.log('1. Graph: Highlighting node:', node.id);

    // Extract file path early for external node detection
    const projectId = node._project || selectedProjectId;
    const filePath = node._isFile ? (node._filePath || node.id) : (node.id ? node.id.split(':')[0] : null);

    console.log('handleNodeSelect:', {
      id: node.id,
      kind: node.kind,
      type: node.type,
      _isFile: node._isFile,
      _filePath: node._filePath,
      filePath,
      hasCode: !!node.code,
      is_internal: node.is_internal,
      metadata: node.metadata
    });

    // UNIVERSAL DETECTION: Use backend-provided metadata
    // The backend knows the actual project structure and marks nodes appropriately
    // This works for all languages: Go, Python, TypeScript, Rust, etc.

    // Check if node is external based on backend metadata
    const isExternalByMetadata = node.is_internal === false || node.metadata?.is_external_lib === true;

    // Graceful fallback: if backend doesn't provide is_internal yet, assume internal
    // This allows the system to work during transition period
    const hasExternalMetadata = node.is_internal !== undefined || node.metadata?.is_external_lib !== undefined;

    console.log('Universal detection:', {
      filePath,
      is_internal: node.is_internal,
      is_external_lib: node.metadata?.is_external_lib,
      hasExternalMetadata,
      isExternalByMetadata,
      willBlockNode: isExternalByMetadata
    });

    if (isExternalByMetadata) {
      console.log('External node (per backend metadata), skipping graph reload:', node.id);
      // Only update the selected node for display purposes
      setSelectedNode(node);
      setNodeInsight(null);
      return;
    }

    // Architecture Mode Navigation
    // Check if node is a file (either by kind, type, _isFile flag or extension pattern)
    // Be more specific about file extensions to avoid matching github.com, go.uber.org, etc.
    const fileExtensions = /\.(go|ts|tsx|js|jsx|py|rs|java|cpp|c|h|md|json|yaml|yml|toml)$/i;
    const isFileNode = node.kind === 'file' || node.type === 'file' || node._isFile || (node.id && fileExtensions.test(node.id) && !node.id.includes(':'));

    // Check if this is a package node (Go import path without file extension)
    // Examples: "github.com/google/mangle/ast", "analysis", "engine"
    const isPackageNode = !isFileNode && (
      node.kind === 'package' ||
      (filePath && !filePath.includes(':') && !/\.\w+$/.test(filePath))
    );

    // Handle package navigation - find a specific file and load its neighbors
    // OPTIMIZATION: Don't load entire package (causes 204 nodes explosion)
    if (isPackageNode) {
      console.log('Package node clicked, resolving to file:', node.id);

      // We need to find *a* file in this package to anchor the view.
      // Queries "defines" predicate where object is this package ID (if modeled that way)
      // OR finds a file that declares this package.
      // Safe bet: find a file that starts with this package path.

      try {
        // Find files in this package
        const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
        const resp = await fetch(`${cleanBase}/v1/files?project=${projectId}`);
        const allFiles = await resp.json();

        // Filter files in this package (simple prefix match)
        // We want direct children or files declared in this package
        // For Go: files in the dir.
        const pkgPath = node.id;
        const pkgFiles = allFiles.filter((f: string) => {
          // Exact dir match (pkgPath is dir)
          const dir = f.substring(0, f.lastIndexOf('/'));
          return dir === pkgPath || dir.endsWith('/' + pkgPath);
        });

        if (pkgFiles.length > 0) {
          // Pick "best" file: doc.go, package.go, main.go, or first alphabetical
          let bestFile = pkgFiles.find((f: string) => f.endsWith('/doc.go')) ||
            pkgFiles.find((f: string) => f.endsWith('/package.go')) ||
            pkgFiles.find((f: string) => f.endsWith('/main.go')) ||
            pkgFiles[0];

          console.log('Resolved package', pkgPath, 'to file', bestFile);

          // Navigate to this file instead
          // Recurse safely
          handleNodeSelect({
            id: bestFile,
            kind: 'file',
            type: 'file',
            _isFile: true,
            _project: projectId,
            _filePath: bestFile
          });
          return;
        }
      } catch (e) {
        console.warn('Failed to resolve package files', e);
      }
    }

    // Discovery Mode Polish: Don't switch view mode on file select



    // Always set the selected node so the code panel updates
    setSelectedNode(node);
    setNodeInsight(null);

    // Trigger hydration if node doesn't have code
    if (!node.code && !node._isMissingCode && dataApiBase && selectedProjectId) {
      // Check cache first
      const cachedNode = symbolCache.get(node.id);
      if (cachedNode?.code) {
        console.log('[Hydrate] Using cached code for:', node.id);
        // Update selectedNode with cached data
        setSelectedNode((prev: any) => ({ ...prev, ...cachedNode, _scrollToLine: node.start_line }));
      } else {
        console.log('[Hydrate] Triggering hydration for:', node.id);
        hydrateNode(node.id).then(hydratedNode => {
          if (hydratedNode?.code) {
            setSelectedNode((prev: any) => ({ ...prev, ...hydratedNode, _scrollToLine: node.start_line }));
          }
        });
      }
    }

    console.log('Current flow file:', currentFlowFileRef.current, 'New file:', filePath);

    // Check if we're clicking a node in the same file (in flow mode)
    const isSameFile = currentFlowFileRef.current && currentFlowFileRef.current === filePath;

    if (isSameFile && viewMode === 'flow') {
      console.log('Same file - skipping graph rebuild, only updating selected node');
      setSkipFlowZoom(true);
      // Find the full node data from fileScopedNodes which has code
      const fullNodeData = fileScopedNodes.find((n: any) => n.id === node.id);
      setSelectedNode(fullNodeData || node);
      setNodeInsight(null);
      return;
    }

    // Different file or not in flow mode - rebuild graph
    setSelectedNode(node);
    setNodeInsight(null);

    // Sync Trinity #2: Scroll code panel to line
    if (node.start_line) {
      console.log('2. Code Panel: Will scroll to line:', node.start_line);
    }

    // For Flow mode, prefer AST data which has internal function calls
    const astNodes = astData?.nodes || [];
    const astLinks = astData?.links || [];

    // Try to find AST nodes for this file
    // Node IDs might have project prefix (e.g., "gca-be/gca-fe/App.tsx:symbol")
    // so we need to check both with and without the prefix
    let fileNodesFromAst: any[] = [];
    if (filePath) {
      // First try exact match
      fileNodesFromAst = astNodes.filter((n: any) => n.id && n.id.startsWith(filePath + ':'));

      // If no match, try with project prefixes
      if (fileNodesFromAst.length === 0) {
        const prefixes = ['gca-be/'];
        if (selectedProjectId && selectedProjectId !== 'gca-be') {
          prefixes.push(selectedProjectId + '/');
        }

        for (const prefix of prefixes) {
          if (!filePath.startsWith(prefix)) {
            const prefixedPath = prefix + filePath;
            const matches = astNodes.filter((n: any) => n.id && n.id.startsWith(prefixedPath + ':'));
            if (matches.length > 0) {
              fileNodesFromAst = matches;
              break;
            }
          }
        }
      }
    }

    console.log('AST data check:', {
      totalAstNodes: astNodes.length,
      fileNodesFromAst: fileNodesFromAst.length,
      hasAstData: !!astData,
      nodeHasCode: !!node.code,
      filePath: filePath,
      triedWithPrefix: !filePath?.startsWith(selectedProjectId + '/')
    });

    // Use AST data if it has nodes for this file
    if (filePath && fileNodesFromAst.length > 0) {
      console.log('Using AST data for Flow mode');

      try {
        const nodesWithInDegree = fileNodesFromAst.map((n: any) => {
          const inDegree = astLinks.filter((l: any) => {
            const target = typeof l.target === 'object' ? l.target.id : l.target;
            return target === n.id;
          }).length || 0;

          const parts = n.id.split(':');
          const symbolName = parts.length > 1 ? parts[parts.length - 1] : n.name;

          return {
            id: n.id,
            name: symbolName,
            kind: n.kind || n.type || 'func',
            filePath: filePath,
            start_line: n.start_line,
            end_line: n.end_line,
            parent: n.parent,
            inDegree,
            code: n.code,
            _filePath: n._filePath || filePath,
            _project: n._project || selectedProjectId
          };
        });

        const diagramLinks = astLinks
          .filter((l: any) => {
            if (!l) return false;
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return nodesWithInDegree.some((n: any) => n.id === sourceId || n.id === targetId);
          })
          .map((l: any) => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target,
            relation: l.relation || 'contains'
          }));

        console.log('AST-based Flow graph:', nodesWithInDegree.length, 'nodes,', diagramLinks.length, 'links');

        setSkipFlowZoom(false);
        setFileScopedNodes(nodesWithInDegree);
        setFileScopedLinks(diagramLinks);
        currentFlowFileRef.current = filePath; // Update current file ref
        console.log('[DEBUG] Setting viewMode to FLOW');
        // debugSetViewMode('flow'); // Disabled per user request
      } catch (e) {
        console.error('Error processing AST data:', e);
      }
      return;
    }

    // Fall back to API if AST data not available
    if (dataApiBase && projectId && filePath) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;

      setIsFlowLoading(true);

      // Use fetchFileGraph which includes package-to-file resolution
      console.log('Fetching file graph for:', filePath);

      fetchFileGraph(cleanBase, projectId, filePath, true)
        .then(data => {
          console.log('[Flow] File graph loaded:', data);

          if (!data || !data.nodes || data.nodes.length === 0) {
            console.warn("No imports found or empty graph");
            // Fallback to ensuring at least the file node exists
            setFileScopedNodes([{
              id: filePath,
              name: filePath.split('/').pop(),
              kind: 'file',
              type: 'file',
              filePath: filePath
            }]);
            setFileScopedLinks([]);
          } else {
            // Convert to D3 format
            const nodes = data.nodes.map((n: any) => ({
              ...n,
              type: n.kind === 'func' ? 'function' : (n.kind || 'default'),
              sourcePosition: 'right',
              targetPosition: 'left',
              data: { label: n.name, ...n },
              // Mark imports as such if needed, or TreeVisualizer handles it
            }));

            const links = data.links.map((l: any, i: number) => ({
              id: `e${i}`,
              source: typeof l.source === 'object' ? l.source.id : l.source,
              target: typeof l.target === 'object' ? l.target.id : l.target,
              animated: true,
              label: l.relation || 'imports'
            }));

            setFileScopedNodes(nodes);
            setFileScopedLinks(links);
          }

          currentFlowFileRef.current = filePath;
          setIsFlowLoading(false);
          // debugSetViewMode('flow'); // Interaction Polish: Don't force switch to flow view

          // Check if file was previously expanded, if so, re-trigger expansion to show internals?
          // For now, satisfy "hiding all internal symbols by default".
          // If the user wants to see them, they click [+].
          if (expandedFileIds.has(filePath)) {
            // If it WAS expanded, we might want to keep it expanded?
            // The user said "hiding... by default". 
            // Maybe collapse it on click? 
            // Let's Collapse it to ensure "Import Only" view is fresh.
            collapseFile(filePath);
          }

        })
        .catch(err => {
          console.error('[Flow] Error loading file imports:', err);
          setIsFlowLoading(false);
        });
    }
  }, [dataApiBase, selectedProjectId, astData, viewMode, fileScopedNodes, debugSetViewMode, expandedFileIds, expandFile, collapseFile]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const newSandbox = { ...sandboxFiles };
    const fileList = Array.from(files);

    for (const file of fileList) {
      try {
        const text = await (file as File).text();
        let content: any = text;
        const fileName = (file as File).name;
        if (fileName.endsWith('.json')) {
          try {
            content = JSON.parse(text);
          } catch (e) {
            console.warn("Invalid JSON upload", fileName);
            continue;
          }
        }
        const fileNameLower = fileName.toLowerCase();

        if (fileNameLower.includes('query') || fileNameLower.includes('symbols') || fileNameLower.includes('nodes')) {
          if (content && typeof content === 'object' && 'nodes' in content) {
            setAstData(content as FlatGraph);
          }
        }

        if (fileNameLower.includes('project')) {
          const projectContent = content as any[];
          if (Array.isArray(projectContent) && projectContent[0] && projectContent[0].name) {
            setCurrentProject(projectContent[0].name);
          }
        }

        newSandbox[fileName] = content;
      } catch (err) { console.error(`Error processing file`, err); }
    }
    setSandboxFiles(newSandbox);
    event.target.value = '';
  };

  const sourceTree = useMemo(() => {
    const nodes = (astData as FlatGraph)?.nodes || [];
    const filesJson = sandboxFiles['files.json'];
    const explicitPaths = Array.isArray(filesJson) ? filesJson : [];
    return stratifyPaths(nodes, explicitPaths);
  }, [astData, sandboxFiles]);

  // Memoize fileScopedData to prevent unnecessary TreeVisualizer re-renders
  const fileScopedData = useMemo(() => ({
    nodes: fileScopedNodes,
    links: fileScopedLinks
  }), [fileScopedNodes, fileScopedLinks]);

  // Filter data based on showVirtualLinks state and expansion
  // Use expanded graph data directly (no filtering needed)
  const filteredAstData = useMemo(() => {
    return expandedGraphData;
  }, [expandedGraphData]);

  // Use file scoped data directly (no filtering needed)
  const filteredFileScopedData = useMemo(() => {
    console.log('[DEBUG] filteredFileScopedData RECALC', {
      nodes: fileScopedData.nodes?.length,
      links: fileScopedData.links?.length
    });
    return fileScopedData;
  }, [fileScopedData]);



  const handleClassDiagramNodeClick = (node: any) => {
    console.log('Class diagram node clicked:', node);

    // Get the file path - use filePath, _filePath, or id for file nodes
    const isFileNode = node.kind === 'file' || node.type === 'file';
    const fileId = node.filePath || node._filePath || (isFileNode ? node.id : null);

    console.log('[Class Diagram] Debug:', {
      fileId,
      isFileNode,
      hasCode: !!node.code,
      dataApiBase,
      selectedProjectId
    });

    // Set node with scroll position if available
    const nodeToSet = { ...node, _filePath: fileId };
    if (node.start_line) {
      nodeToSet._scrollToLine = node.start_line;
    }
    setSelectedNode(nodeToSet);

    // Fetch source code if missing
    if (!node.code && fileId && dataApiBase && selectedProjectId) {
      console.log('[Source] Fetching source for:', fileId, 'project:', selectedProjectId);
      setHydratingNodeId(node.id); // Show loading state
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
      fetchSource(cleanBase, selectedProjectId, fileId)
        .then(code => {
          console.log('[Source] Got code, length:', code?.length, 'preview:', code?.substring(0, 50));
          setSelectedNode((prev: any) => {
            console.log('[Source] Updating selectedNode, prev:', prev?.id);
            return { ...prev, code };
          });
          // Update cache
          setSymbolCache(prev => new Map(prev).set(fileId, { ...node, code }));
        })
        .catch(err => console.error('[Source] Failed to fetch source:', err))
        .finally(() => setHydratingNodeId(null)); // Clear loading state
    } else {
      console.log('[Source] Skipping fetch - condition not met:', {
        hasCode: !!node.code,
        fileId,
        dataApiBase: !!dataApiBase,
        selectedProjectId
      });
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a1118] text-slate-400 overflow-hidden font-sans">
      <aside
        style={{ width: sidebarWidth }}
        className="glass-sidebar flex flex-col z-30 shrink-0 shadow-2xl relative"
      >
        <div className="p-6 border-b border-white/5 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-[#00f2ff] flex items-center justify-center text-[#0a1118] font-black shadow-[0_0_15px_rgba(0,242,255,0.4)]">G</div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight uppercase italic">GCA EXPLORER</h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-tighter">PROJECT ANALYZER</p>
          </div>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2 flex justify-between">
              <span>ACTIVE PROJECT</span>
              {dataApiBase && <i className={`fas fa-plug text-[8px] ${isDataSyncing ? 'text-[#00f2ff] animate-pulse' : 'text-[#10b981]'}`}></i>}
            </h2>

            {availableProjects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const newProjectId = e.target.value;
                  setSelectedProjectId(newProjectId);
                  const project = availableProjects.find((p: { id: string; name: string; description?: string }) => p.id === newProjectId);
                  if (project) {
                    setCurrentProject(project.name);
                    // Load data for the selected project
                    syncDataFromApi(dataApiBase, newProjectId);
                  }
                }}
                className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-2 text-[11px] text-white focus:outline-none focus:border-[#00f2ff]/50 font-mono"
              >
                <option value="">-- Select a project --</option>
                {availableProjects.map((project: { id: string; name: string; description?: string }) => (
                  <option key={project.id} value={project.id}>
                    {project.name} {project.description ? `- ${project.description}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-2 text-[11px] text-white truncate font-medium flex items-center gap-2">
                <i className="fas fa-cube text-[#00f2ff] text-[10px]"></i> {currentProject}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">SOURCE NAVIGATOR</h2>
            <div className="space-y-0.5 border-l border-white/5 ml-2">
              {Object.entries(sourceTree).map(([name, node]) => (
                <FileTreeItem
                  key={name}
                  name={name}
                  node={node as any}
                  depth={0}
                  onNodeSelect={handleNodeSelect}
                  astData={astData}
                  selectedNode={selectedNode}
                />
              ))}
              {Object.keys(sourceTree).length === 0 && (
                <div className="px-4 py-8 text-center text-[10px] text-slate-700 italic border border-dashed border-white/5 rounded mx-2">
                  No files indexed.<br />Upload AST or configure API.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 bg-[#0d171d] space-y-2">

          {dataApiBase && (
            <button
              onClick={syncApi}
              className="w-full py-2 bg-[#10b981]/5 hover:bg-[#10b981]/10 border border-[#10b981]/20 rounded text-[9px] font-black uppercase tracking-[0.3em] text-[#10b981] transition-all shadow-inner"
            >
              <i className="fas fa-sync-alt mr-2"></i> Sync API
            </button>
          )}
        </div>

        <div
          onMouseDown={startResizeSidebar}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center px-6 gap-6 bg-[#0a1118]/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex-1 flex items-center justify-center">
            <div className={`flex items-center bg-[#16222a] border ${isSearching ? 'border-[#00f2ff] shadow-[0_0_15px_-3px_rgba(0,242,255,0.3)]' : 'border-white/10 hover:border-white/20'} rounded-full px-1.5 py-1.5 w-full max-w-2xl shadow-xl transition-all relative group`}>
              <div className="px-3 py-1.5 rounded-full text-[10px] font-black bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20 mr-2 uppercase tracking-wide flex items-center gap-1.5">
                <i className="fas fa-sparkles"></i>
                Ask AI
              </div>
              <input
                type="text"
                placeholder='Ask a question (e.g. "How does Auth work?") or search symbols...'
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchError(null);
                  if (e.target.value.length > 2) {
                    clearTimeout((e.target as any)._searchTimeout);
                    (e.target as any)._searchTimeout = setTimeout(() => {
                      // Only auto-search for symbols if typing specific names?
                      // For AI questions, maybe wait for Enter.
                      // Let's auto-search to show candidates.
                      // handleSmartSearch(e.target.value); // DISABLED auto-search on type for now to be cleaner
                    }, 800);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    addToHistory(searchTerm);
                    setShowHistory(false);
                    handleSmartSearch(searchTerm);
                  }
                }}
                className="bg-transparent border-none flex-1 px-2 text-xs focus:outline-none text-white font-medium placeholder-slate-500 h-8"
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              />

              {/* Search Status Indicator */}
              {searchStatus && (
                <div className="absolute top-[80%] right-4 text-[10px] text-[#00f2ff] font-mono animate-pulse bg-[#0a1118]/80 px-2 py-1 rounded">
                  <i className="fas fa-circle-notch animate-spin mr-2"></i>
                  {searchStatus}
                </div>
              )}

              {showHistory && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[#0d171d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recent Queries</span>
                    <button onClick={clearHistory} className="text-[9px] text-slate-500 hover:text-white transition-colors">Clear</button>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                    {searchHistory.map((q, i) => (
                      <div
                        key={i}
                        className="px-4 py-2.5 text-[11px] text-slate-300 hover:bg-[#00f2ff]/10 hover:text-[#00f2ff] cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
                        onClick={() => {
                          setSearchTerm(q);
                          handleSmartSearch(q);
                          setShowHistory(false);
                        }}
                      >
                        <i className="fas fa-history text-slate-600 text-[10px]"></i>
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isSearching && <i className="fas fa-circle-notch fa-spin text-[#00f2ff] text-xs absolute right-12"></i>}

              {/* Query results summary */}
              {(queryResults || searchError) && !isSearching && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[#0d171d]/95 backdrop-blur-xl border border-[#00f2ff]/30 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start justify-between">
                    {searchError ? (
                      <div className="text-[11px] text-red-400 font-bold flex items-start gap-2">
                        <i className="fas fa-exclamation-triangle mt-0.5"></i>
                        <span>{searchError}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#00f2ff] font-bold flex items-center gap-2">
                        <i className="fas fa-check-circle"></i>
                        Found {queryResults.nodes?.length || 0} symbols.
                        <span className="text-slate-500 font-normal ml-1">AI Context Loaded.</span>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setQueryResults(null);
                        setSearchError(null);
                        setNodeInsight(null);
                        setFileScopedNodes([]);
                        setFileScopedLinks([]);
                        // debugSetViewMode('backbone'); // Keep current view or reset?
                      }}
                      className="text-slate-500 hover:text-white ml-4 px-2 py-0.5 text-[9px] border border-white/10 rounded hover:bg-white/10 transition-colors uppercase tracking-wider"
                      title="Clear Search & Reset Graph"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Run query button */}
              <button
                onClick={runSearch}
                disabled={!searchTerm || isSearching}
                className="w-8 h-8 rounded-full bg-[#00f2ff] flex items-center justify-center text-[#0a1118] text-[10px] disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,242,255,0.4)] ml-1"
              >
                <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>


          <div className="flex items-center gap-2">
            <button
              onClick={setMapMode}
              className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest border rounded transition-all ${viewMode === 'map'
                ? 'bg-[#f59e0b] border-[#f59e0b] text-[#0a1118]'
                : 'bg-[#16222a] border-white/5 text-[#f59e0b] hover:bg-white/5'
                }`}
            >
              Map
            </button>

            <button
              onClick={setDiscoveryMode}
              className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest border rounded transition-all ${viewMode === 'discovery'
                ? 'bg-[#00f2ff] border-[#00f2ff] text-[#0a1118]'
                : 'bg-[#16222a] border-white/5 text-[#00f2ff] hover:bg-white/5'
                }`}
            >
              Discovery
            </button>

            <button
              onClick={setArchitectureMode}
              className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest border rounded transition-all ${viewMode === 'architecture'
                ? 'bg-[#a855f7] border-[#a855f7] text-[#0a1118]'
                : 'bg-[#16222a] border-white/5 text-[#a855f7] hover:bg-white/5'
                }`}
            >
              Architecture
            </button>




          </div>

          <div className="ml-auto flex gap-5 items-center">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-white font-bold leading-none">View Mode</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${viewMode === 'map' ? 'text-[#f59e0b]' :
                viewMode === 'backbone' ? 'text-[#a855f7]' : 'text-[#00f2ff]'
                }`}>
                {viewMode === 'map' ? 'MAP' : viewMode === 'backbone' ? 'BACKBONE' : 'DISCOVERY'}
              </span>
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <i
              className="fas fa-cog text-slate-600 hover:text-white cursor-pointer transition-colors text-xs"
              onClick={openSettings}
            ></i>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative dot-grid overflow-hidden bg-[#0a1118]">
            {(() => {
              // Use fileScopedNodes for visualization count (includes clustered nodes)
              const visualizationNodeCount = fileScopedNodes.length;
              const nodeCount = (astData as any).nodes?.length || 0;
              const linkCount = (astData as any).links?.length || 0;
              const tooManyNodes = visualizationNodeCount > 1000 && !isClustered;

              console.log('[DEBUG] AppIIFE Render:', {
                viewMode,
                nodeCount,
                visualizationNodeCount,
                tooManyNodes,
                hasData: !!astData,
                fileScopedDataHeight: fileScopedNodes.length,
                isClustered
              });

              if (tooManyNodes) {
                return (
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
                          onClick={async () => {
                            try {
                              // Fallback to a default query if lastExecutedQuery is empty
                              const queryToUse = lastExecutedQuery || 'query(?x) :- triples(?x, "defines", ?y)';
                              console.log('[Clustering] Using query:', queryToUse);

                              setCtxIsSearching(true);
                              setCtxSearchStatus('Applying Leiden clustering...');
                              const { getClusteredGraph } = await import('./services/graphService');
                              const clusteredData = await getClusteredGraph(dataApiBase, selectedProjectId, queryToUse);
                              console.log('[Clustering] Received data:', clusteredData);

                              // Only update visualization data, keep astData intact for SOURCE NAVIGATOR
                              setFileScopedNodes(clusteredData.nodes);
                              setFileScopedLinks(clusteredData.links);
                              setIsClustered(true);
                              setCtxSearchStatus(null);
                              setCtxIsSearching(false);
                            } catch (err: any) {
                              console.error('[Clustering] Error:', err);
                              setCtxSearchError(err.message || 'Clustering failed');
                              setCtxSearchStatus(null);
                              setCtxIsSearching(false);
                            }
                          }}
                          className="px-6 py-3 bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white font-medium rounded-lg hover:shadow-lg hover:shadow-[#f59e0b]/20 transition-all duration-200"
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
                );
              }

              return (
                <>



                  {viewMode === 'architecture' ? (
                    <div className="w-full h-full bg-[#0d171d] relative z-0">
                      <ClassDiagramCanvas
                        nodes={fileScopedNodes}
                        links={fileScopedLinks}
                        onNodeClick={handleClassDiagramNodeClick}
                        width={window.innerWidth - sidebarWidth - codePanelWidth}
                        height={window.innerHeight - 56}
                      />
                    </div>
                  ) : (
                    <TreeVisualizer
                      data={filteredAstData}
                      onNodeSelect={handleNodeSelect}
                      onNodeHover={() => { }}
                      mode={viewMode}
                      selectedId={selectedNode?.id}
                      fileScopedData={filteredFileScopedData}
                      skipFlowZoom={skipFlowZoom}
                      expandedFileIds={expandedFileIds}
                      onToggleFileExpansion={toggleFileExpansion}
                      expandingFileId={expandingFileId}
                    />
                  )}
                </>
              );
            })()}
          </div>

          <CodePanel
            width={codePanelWidth}
            isCollapsed={isCodeCollapsed}
            onToggleCollapse={() => setIsCodeCollapsed(!isCodeCollapsed)}
            onStartResize={startResizeCodePanel}
          >
            <SynthesisPanel
              height={synthesisHeight}
              isCollapsed={isSynthesisCollapsed}
              onToggleCollapse={() => setIsSynthesisCollapsed(!isSynthesisCollapsed)}
              onStartResize={startResizeSynthesis}
              onAnalyze={generateInsights}
              onClearInsight={() => setNodeInsight(null)}
              onLinkClick={handleMarkdownLinkClick}
              onSymbolClick={handleMarkdownSymbolClick}
            />
          </CodePanel>
        </div>


        <footer className="h-10 border-t border-white/5 flex items-center px-6 gap-8 bg-[#0a1118] text-[9px] shrink-0 font-mono tracking-widest">
          <div className="text-slate-600">ARTIFACTS: <span className="text-[#00f2ff] font-bold">{(astData as FlatGraph)?.nodes?.length || 0}</span></div>
          <div className="text-slate-600">RELATIONS: <span className="text-[#00f2ff] font-bold">{(astData as FlatGraph)?.links?.length || 0}</span></div>
          <div className="text-slate-600">ENDPOINT: <span className="text-[#10b981] font-bold uppercase truncate max-w-[100px]">{dataApiBase ? (() => {
            try {
              return new URL(dataApiBase).hostname;
            } catch {
              return 'INVALID';
            }
          })() : 'NONE'}</span></div>
          <div className="ml-auto flex items-center gap-3 text-slate-700">
            <span className="uppercase tracking-tighter font-black italic">Gem-Code-V2.1</span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
          </div>
        </footer>
      </div >

      {/* Settings Modal */}
      {
        isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={() => console.log('Settings modal opened')}>
            <div className="bg-[#0d171d] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">System Configuration</h3>
                <button onClick={closeSettings} className="text-slate-500 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Data API Base URL</label>
                  <input
                    type="text"
                    value={dataApiBase}
                    onChange={(e) => {
                      setDataApiBase(e.target.value);
                      setAvailableProjects([]);
                      setSelectedProjectId('');
                    }}
                    placeholder="http://localhost:8080"
                    className={`w-full bg-[#0a1118] border rounded px-4 py-2.5 text-xs text-white focus:outline-none font-mono ${dataApiBase && (() => {
                      try {
                        new URL(dataApiBase);
                        return 'border-white/10 focus:border-[#00f2ff]/50';
                      } catch {
                        return 'border-red-500/50 focus:border-red-500';
                      }
                    })()
                      }`}
                  />
                  {dataApiBase && (() => {
                    try {
                      new URL(dataApiBase);
                      return null;
                    } catch {
                      return (
                        <p className="mt-2 text-[9px] text-red-400">
                          <i className="fas fa-exclamation-circle mr-1"></i>
                          Invalid URL format. Include protocol (e.g., http://localhost:8080)
                        </p>
                      );
                    }
                  })()}
                  <p className="mt-2 text-[9px] text-slate-600 leading-normal">
                    This endpoint will be used to fetch /v1/projects, /v1/files, and /v1/query.
                    <br />After connecting, select a project from the sidebar dropdown.
                  </p>
                </div>



                {syncError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    {syncError}
                  </div>
                )}

                {isDataSyncing && (
                  <div className="p-3 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded flex items-center gap-2 text-[10px] text-[#00f2ff]">
                    <i className="fas fa-sync fa-spin"></i>
                    Connecting to API...
                  </div>
                )}

                {!isDataSyncing && availableProjects.length > 0 && (
                  <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded text-[10px] text-[#10b981]">
                    <i className="fas fa-check-circle mr-2"></i>
                    Connected! Found {availableProjects.length} project(s). Select one from the sidebar.
                  </div>
                )}
              </div>
              <div className="p-6 bg-[#0a1118]/50 flex justify-end gap-3">
                <button
                  onClick={() => syncDataFromApi(dataApiBase)}
                  className="px-6 py-2 bg-[#10b981] text-[#0a1118] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                >
                  Connect & Fetch Projects
                </button>
                {/* Focus Mode Toggle */}

                <button
                  onClick={closeSettings}
                  className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;