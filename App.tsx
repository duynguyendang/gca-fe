
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import TreeVisualizer from './components/TreeVisualizer/index';
import ClassDiagramCanvas from './components/ClassDiagramCanvas';
import HighlightedCode from './components/HighlightedCode';
import FileTreeItem from './components/FileTreeItem';
import { ASTNode, FlatGraph, BackboneGraph, BackboneNode, BackboneLink } from './types';
import { getGeminiInsight, pruneNodesWithAI, resolveSymbolFromQuery, generateAnswerForSymbol, findPathEndpoints, generatePathNarrative, getArchitectureSummary, getArchitectureNarrative, getFileRoleSummary } from './services/geminiService';
import { findShortestPath, PathResult } from './utils/pathfinding';
import {
  fetchGraphMap,
  fetchFileDetails,
  fetchBackbone,
  fetchProjects,
  fetchFiles,
  fetchHydrate,
  executeQuery,
  fetchFileGraph,
  fetchFileImports, // Added fetchFileImports
  fetchFileCalls,
  fetchSource,
  fetchSymbols,
  fetchFlowPath,
  fetchFileBackbone,
  GraphMapResponse,
  FileDetailsResponse
} from './services/graphService';

// Ensure Prism is available for highlighting
declare var Prism: any;

const SAMPLE_DATA: FlatGraph = {
  nodes: [
    { id: "src/main.go:main", name: "main", type: "func", kind: "func", start_line: 1, end_line: 5, code: "func main() {\n\tfmt.Println(\"Hello GCA\")\n\t// Analyzer Entry Point\n\tinitialize()\n}" },
  ],
  links: []
};

const stratifyPaths = (nodes: any[], filePaths: string[] = []) => {
  const root: any = { _isFolder: true, children: {} };

  if (Array.isArray(filePaths)) {
    filePaths.forEach(path => {
      if (typeof path !== 'string') return;
      const parts = path.split('/');
      let current = root;
      parts.forEach((part, i) => {
        const isLastPart = i === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = {
            _isFolder: !isLastPart,
            _isFile: isLastPart,
            children: {},
            _symbols: []
          };
        }
        current = current.children[part];
      });
    });
  }

  if (Array.isArray(nodes)) {
    nodes.forEach(node => {
      if (!node || !node.id) return;
      const [filePath, symbol] = node.id.split(':');
      if (!filePath) return;

      const parts = filePath.split('/');
      let current = root;

      parts.forEach((part, i) => {
        const isLastPart = i === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = {
            _isFolder: !isLastPart,
            _isFile: isLastPart,
            children: {},
            _symbols: []
          };
        }
        if (isLastPart && symbol) {
          if (!current.children[part]._symbols.find((s: any) => s.node.id === node.id)) {
            current.children[part]._symbols.push({ name: symbol, node });
          }
        }
        current = current.children[part];
      });
    });
  }

  return root.children;
};

// HighlightedCode moved to components/HighlightedCode.tsx

// FileTreeItem moved to components/FileTreeItem.tsx



const App: React.FC = () => {
  const [astData, setAstData] = useState<ASTNode | FlatGraph>(() => {
    try {
      const saved = sessionStorage.getItem('gca_ast_data');
      return saved ? JSON.parse(saved) : SAMPLE_DATA;
    } catch (e) { return SAMPLE_DATA; }
  });

  const [sandboxFiles, setSandboxFiles] = useState<Record<string, any>>(() => {
    try {
      const saved = sessionStorage.getItem('gca_sandbox_files');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  // Additional UI states
  const [dataApiBase, setDataApiBase] = useState<string>(() => sessionStorage.getItem('gca_api_base') || "http://localhost:8080");
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('gca_gemini_api_key') || "");

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nodeInsight, setNodeInsight] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<string>("GCA-Sandbox-Default");
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queryHistory');
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse history', e);
    }
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Class Diagram state
  const [fileScopedNodes, setFileScopedNodes] = useState<any[]>([]);
  const [fileScopedLinks, setFileScopedLinks] = useState<any[]>([]);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const currentFlowFileRef = useRef<string | null>(null);
  const [skipFlowZoom, setSkipFlowZoom] = useState(false);

  // View Modes: flow (Architecture), map (Circle), discovery (Force), backbone (Cross-file), architecture (File-to-File)
  const [viewMode, setViewMode] = useState<'flow' | 'map' | 'discovery' | 'backbone' | 'architecture'>('discovery');
  const [isFlowLoading, setIsFlowLoading] = useState(false);

  // Trace Path state
  const [tracePathMode, setTracePathMode] = useState(false);
  const [traceStartNode, setTraceStartNode] = useState<string | null>(null);
  const [traceEndNode, setTraceEndNode] = useState<string | null>(null);
  const [tracePathResult, setTracePathResult] = useState<PathResult | null>(null);
  const [showVirtualLinks, setShowVirtualLinks] = useState(false);

  // Symbol hydration state
  const [symbolCache, setSymbolCache] = useState<Map<string, any>>(new Map());
  const [hydratingNodeId, setHydratingNodeId] = useState<string | null>(null);

  // Progressive expansion state
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [fileDetailsCache, setFileDetailsCache] = useState<Map<string, FileDetailsResponse>>(new Map());
  const [expandingFileId, setExpandingFileId] = useState<string | null>(null);

  // Backbone mode state

  const [showArchitecturePanel, setShowArchitecturePanel] = useState(false);

  // Focus Mode State - REMOVED

  // Debug wrapper for setViewMode
  const debugSetViewMode = useCallback((newMode: typeof viewMode) => {
    console.log('setViewMode called:', { from: viewMode, to: newMode });
    if (newMode === 'discovery' && viewMode === 'flow') {
      console.trace('Trace for switching to DISCOVERY from FLOW');
    }
    setViewMode(newMode);
  }, [viewMode]);

  // Memoized callbacks to prevent re-renders
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);
  const syncApi = useCallback(() => syncDataFromApi(dataApiBase), [dataApiBase]);
  const setFlowMode = useCallback(() => debugSetViewMode('flow'), [debugSetViewMode]);
  const setMapMode = useCallback(() => debugSetViewMode('map'), [debugSetViewMode]);
  const setDiscoveryMode = useCallback(() => debugSetViewMode('discovery'), [debugSetViewMode]);
  const setArchitectureMode = useCallback(() => debugSetViewMode('architecture'), [debugSetViewMode]);





  // Debug: log viewMode changes
  useEffect(() => {
    console.log('viewMode changed to:', viewMode);
  }, [viewMode]);

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [codePanelWidth, setCodePanelWidth] = useState(500);
  const isResizingSidebar = useRef(false);
  const isResizingCode = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Persist Gemini API Key to local storage
  useEffect(() => {
    if (geminiApiKey) {
      localStorage.setItem('gca_gemini_api_key', geminiApiKey);
    } else {
      localStorage.removeItem('gca_gemini_api_key');
    }
  }, [geminiApiKey]);

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

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX)));
      if (isResizingCode.current) setCodePanelWidth(Math.max(300, Math.min(window.innerWidth * 0.7, window.innerWidth - e.clientX)));
    };

    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      isResizingCode.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const syncDataFromApi = async (baseUrl: string, projectId?: string, onComplete?: () => void) => {

    if (!baseUrl) return;
    setIsDataSyncing(true);
    setSyncError(null);
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    try {
      // Fetch all projects
      const projectsRes = await fetch(`${cleanBase}/v1/projects`);
      if (!projectsRes.ok) {
        setSyncError('Failed to fetch projects');
        setIsDataSyncing(false);
        setIsDataSyncing(false);
        return;
      }

      const projects = await projectsRes.json() as Array<{ id: string; name: string; description?: string }>;
      setAvailableProjects(projects);

      // Require project selection
      if (!projectId && projects.length > 0) {
        // Auto-select first project if none selected
        projectId = projects[0].id;
        setSelectedProjectId(projectId);
      }

      if (!projectId) {
        setSyncError('No projects available');
        setIsDataSyncing(false);
        setIsDataSyncing(false);
        return;
      }

      setCurrentProject(projects.find(p => p.id === projectId)?.name || projectId);

      // Fetch files for the project
      const filesUrl = `${cleanBase}/v1/files?project=${encodeURIComponent(projectId)}`;
      const filesRes = await fetch(filesUrl);
      if (!filesRes.ok) {
        setSyncError(`Failed to fetch files: ${filesRes.statusText}`);
        setIsDataSyncing(false);
        setIsDataSyncing(false);
        return;
      }

      const filesData = await filesRes.json();
      const filesList = Array.isArray(filesData) ? filesData : (filesData.files || []);
      setSandboxFiles(prev => ({ ...prev, 'files.json': filesList }));

      // Build AST from files list
      if (filesList.length > 0) {
        const astNodes: any[] = [];
        const astLinks: any[] = [];

        filesList.forEach((filePath: string) => {
          const fileName = filePath.split('/').pop() || filePath;
          const ext = fileName.split('.').pop()?.toLowerCase();
          const kind = ['py', 'ts', 'js', 'go', 'rs'].includes(ext || '') ? 'function' : 'file';

          astNodes.push({
            id: filePath,
            name: fileName,
            type: kind,
            kind: kind,
            start_line: 1,
            end_line: 100,
            code: '',
            _filePath: filePath,
            _project: projectId
          });
        });

        setAstData({ nodes: astNodes, links: astLinks });
      }

      // Fetch enriched AST from query endpoint (POST with body)
      try {
        const queryRes = await fetch(`${cleanBase}/v1/query?project=${encodeURIComponent(projectId)}&hydrate=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'triples(?s, "defines", ?o)' })
        });

        if (queryRes.ok) {
          const ast = await queryRes.json();
          if (ast && ast.nodes && ast.nodes.length > 0) {
            // Enrich existing nodes with code from query response
            setAstData(prev => {
              const enrichedNodes = prev.nodes.map(node => {
                const enrichedNode = ast.nodes.find((n: any) => n.id === node.id || n.id === node._filePath);
                return enrichedNode ? { ...node, ...enrichedNode, _project: projectId } : { ...node, _project: projectId };
              });
              return { nodes: enrichedNodes, links: ast.links || prev.links };
            });
          }
        }
      } catch (queryErr) {
        console.log('Query endpoint not available, using file-based AST');
      }

      // Success - don't auto-close, let user select project in main UI
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error("API Sync Error:", err);
      setSyncError(err.message || 'Unknown error during sync');
    } finally {
      setIsDataSyncing(false);
    }
  };

  // Smart Search: Orchestrates Symbol Search and Pathfinding
  const handleSmartSearch = useCallback(async (query: string) => {
    console.log('=== handleSmartSearch called ===', query);
    setSearchError(null);
    setIsSearching(true);
    setQueryResults(null);

    if (!dataApiBase || !selectedProjectId || !query || query.length < 1) {
      setIsSearching(false);
      return;
    }

    try {
      // 1. First, search for symbols matching the query (broad search)
      // Use the new /v1/search/symbols endpoint
      let symbols = await fetchSymbols(dataApiBase, selectedProjectId, query);
      console.log('Search candidates (exact):', symbols);

      // Fallback: If no symbols found, try keyword extraction (heuristic)
      if (symbols.length === 0) {
        console.log('No exact match, attempting keyword fallback...');
        const stopWords = new Set(['what', 'is', 'the', 'how', 'does', 'where', 'are', 'in', 'of', 'for', 'to', 'a', 'an', 'who', 'calls', 'call', 'called', 'by']);

        // Simple tokenization: remove punctuation, split by spaces, filter stop words
        const tokens = query.toLowerCase().replace(/[?.,!]/g, ' ').split(/\s+/).filter(t => !stopWords.has(t) && t.length > 2);

        if (tokens.length > 0) {
          // Find the longest significant token as the most likely primary symbol candidate
          const longestToken = tokens.reduce((a, b) => a.length > b.length ? a : b);
          console.log('Fallback: Searching for longest token:', longestToken);

          symbols = await fetchSymbols(dataApiBase, selectedProjectId, longestToken);
          console.log('Search candidates (fallback):', symbols);
        }
      }

      if (symbols.length === 0) {
        setSearchError("No symbols found matching your query.");
        setIsSearching(false);
        return;
      }

      // 2. AI Resolution: Check for Pathfinding OR Single Symbol
      let pathEndpoints = null;
      if (symbols.length > 1) {
        setNodeInsight("Checking for flow path...");
        pathEndpoints = await findPathEndpoints(query, symbols, geminiApiKey);
      }

      if (pathEndpoints && pathEndpoints.from && pathEndpoints.to && pathEndpoints.from !== pathEndpoints.to) {
        // --- PATHFINDING MODE ---
        console.log('Pathfinding Mode:', pathEndpoints);
        setNodeInsight(`Tracing flow from ${pathEndpoints.from} to ${pathEndpoints.to}...`);

        try {
          const flowData = await fetchFlowPath(dataApiBase, selectedProjectId, pathEndpoints.from, pathEndpoints.to);

          if (!flowData.nodes || flowData.nodes.length === 0) {
            setSearchError(`No path found between ${pathEndpoints.from} and ${pathEndpoints.to}`);
            setIsSearching(false);
            return;
          }

          // AGGREGATION: Collapse to File -> File links
          const fileSet = new Map<string, any>(); // path -> node
          const fileLinks: any[] = [];

          // 1. Create File Nodes
          flowData.nodes.forEach((n: any) => {
            // Extract file path from ID: "pkg/foo/bar.go:Func" -> "pkg/foo/bar.go"
            const filePath = n.id.includes(':') ? n.id.split(':')[0] : n.id;
            if (!fileSet.has(filePath)) {
              fileSet.set(filePath, {
                id: filePath,
                name: filePath.split('/').pop(), // Short name
                kind: 'file',
                type: 'file', // Helper for visualization
                _project: selectedProjectId,
                _filePath: filePath
              });
            }
          });

          // 2. Create File Links based on Call Chain
          for (let i = 0; i < flowData.nodes.length - 1; i++) {
            const n1 = flowData.nodes[i];
            const n2 = flowData.nodes[i + 1];

            const f1 = n1.id.includes(':') ? n1.id.split(':')[0] : n1.id;
            const f2 = n2.id.includes(':') ? n2.id.split(':')[0] : n2.id;

            if (f1 !== f2) {
              // Check if link already exists
              const linkExists = fileLinks.find(l => l.source === f1 && l.target === f2);
              if (!linkExists) {
                fileLinks.push({
                  source: f1,
                  target: f2,
                  relation: 'calls',
                  weight: 1
                });
              }
            }
          }

          const aggregatedNodes = Array.from(fileSet.values());
          console.log('Aggregated Flow:', aggregatedNodes, fileLinks);

          if (aggregatedNodes.length > 0) {
            setAstData({
              nodes: aggregatedNodes,
              links: fileLinks
            });
          } else {
            // Fallback if no file transitions (all in one file)
            setAstData({
              nodes: flowData.nodes.map((n: any) => ({ ...n, _project: selectedProjectId })),
              links: flowData.links || []
            });
          }

          // Generate Narrative
          const narrative = await generatePathNarrative(query, flowData.nodes, geminiApiKey);
          setNodeInsight(narrative);
          setSelectedNode(flowData.nodes[0]); // Select start node

        } catch (pathErr) {
          console.error("Pathfinding failed", pathErr);
          setSearchError("Failed to trace path.");
        }

      } else {
        // --- SINGLE SYMBOL MODE ---
        let targetId = symbols[0];
        if (symbols.length > 1) {
          setNodeInsight("Resolving best match...");
          const resolved = await resolveSymbolFromQuery(query, symbols, geminiApiKey);
          if (resolved && symbols.includes(resolved)) targetId = resolved;
        }

        console.log('Resolved target:', targetId);

        // Single Symbol Context
        const queryRes = await executeQuery(dataApiBase, selectedProjectId, `triples("${targetId}", ?p, ?o)`);
        setAstData({
          nodes: queryRes.nodes.map((n: any) => ({ ...n, _project: selectedProjectId })),
          links: queryRes.links
        });

        const targetNode = queryRes.nodes.find((n: any) => n.id === targetId);
        setSelectedNode(targetNode);

        setNodeInsight(`Analyzing "${targetId}"...`);
        const answer = await generateAnswerForSymbol(query, targetId, targetNode, geminiApiKey);
        setNodeInsight(answer);
      }

    } catch (e) {
      console.error("Smart Search failed:", e);
      setSearchError("Search failed.");
    } finally {
      setIsSearching(false);
    }
  }, [dataApiBase, selectedProjectId, geminiApiKey]);

  // Wrapper for UI
  const searchSymbols = handleSmartSearch;

  // Additional memoized callbacks (defined after searchSymbols due to dependency)
  const runSearch = useCallback(() => {
    if (searchTerm) {
      searchSymbols(searchTerm);
    }
  }, [searchTerm, searchSymbols]);

  const generateInsights = useCallback(() => {
    setIsInsightLoading(true);
    getGeminiInsight(selectedNode, undefined, geminiApiKey).then(i => {
      setNodeInsight(i);
      setIsInsightLoading(false);
    }).catch(() => {
      setIsInsightLoading(false);
      setNodeInsight("Analysis connection failed.");
    });
  }, [selectedNode, geminiApiKey]);

  // Hydrate a single node's code from the backend
  const hydrateNode = useCallback(async (nodeId: string): Promise<any | null> => {
    // Check cache first
    if (symbolCache.has(nodeId)) {
      console.log('[Hydrate] Cache hit for:', nodeId);
      return symbolCache.get(nodeId);
    }

    // Check if node already has code
    const existingNode = (astData as FlatGraph)?.nodes?.find((n: any) => n.id === nodeId);
    if (existingNode?.code) {
      console.log('[Hydrate] Node already has code:', nodeId);
      // Cache it for future
      setSymbolCache(prev => new Map(prev).set(nodeId, existingNode));
      return existingNode;
    }

    if (!dataApiBase || !selectedProjectId) {
      console.warn('[Hydrate] Missing dataApiBase or selectedProjectId');
      return null;
    }

    console.log('[Hydrate] Fetching node from API:', nodeId);
    setHydratingNodeId(nodeId);

    try {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
      const response = await fetch(`${cleanBase}/v1/hydrate?id=${encodeURIComponent(nodeId)}&project=${encodeURIComponent(selectedProjectId)}`);

      if (!response.ok) {
        console.error('[Hydrate] Failed to hydrate node:', response.status, response.statusText);
        return null;
      }

      const hydratedNode = await response.json();
      console.log('[Hydrate] Successfully hydrated node:', hydratedNode);

      // Update cache
      setSymbolCache(prev => new Map(prev).set(nodeId, hydratedNode));

      // Update astData with the hydrated node
      setAstData(prev => {
        if (!prev || !('nodes' in prev)) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map(n =>
            n.id === nodeId ? { ...n, ...hydratedNode } : n
          )
        };
      });

      return hydratedNode;
    } catch (error) {
      console.error('[Hydrate] Error hydrating node:', error);
      return null;
    } finally {
      setHydratingNodeId(null);
    }
  }, [dataApiBase, selectedProjectId, astData, symbolCache]);

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
      getArchitectureSummary(fileId, details.nodes, geminiApiKey).then(summary => {
        setNodeInsight(summary);
      }).catch(err => {
        console.warn('[Expand] Architecture Summary failed:', err);
      });

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
    setNodeInsight("Generating Backbone Insight...");

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

        // 3. AI Insight
        getFileRoleSummary(fileId, backbone.nodes, geminiApiKey).then(summary => {
          setNodeInsight(summary);
        });

      } else {
        setNodeInsight("No dependencies found.");
        setFileScopedNodes([]);
        setFileScopedLinks([]);
      }
    } catch (e) {
      console.error("Backbone Load Failed", e);
      setNodeInsight("Failed to load file backbone.");
    } finally {
      setIsFlowLoading(false);
    }
  }, [dataApiBase, selectedProjectId, geminiApiKey, debugSetViewMode]);

  const handleNodeSelect = useCallback(async (node: any) => {
    console.log('=== SYNC TRINITY: Node Clicked ===');
    console.log('1. Graph: Highlighting node:', node.id);

    // Architecture Mode Navigation
    // Check if node is a file (either by kind, type, _isFile flag or extension pattern)
    const isFileNode = node.kind === 'file' || node.type === 'file' || node._isFile || (node.id && /\.\w+$/.test(node.id) && !node.id.includes(':'));

    if (isFileNode) {
      const path = node._filePath || (node.id.includes(':') ? node.id.split(':')[0] : node.id);
      console.log('File Selected. Loading Backbone:', path);
      loadFileBackbone(path);
      return;
    }

    // Handle Trace Path mode state updates
    if (tracePathMode) {
      if (!traceStartNode) {
        setTraceStartNode(node.id);
        setTracePathResult(null);
      } else if (!traceEndNode && node.id !== traceStartNode) {
        setTraceEndNode(node.id);
        // Find path using BFS/Dijkstra
        const nodes = (astData as FlatGraph)?.nodes || [];
        const links = (astData as FlatGraph)?.links || [];
        const result = findShortestPath(nodes, links, traceStartNode, node.id, true);
        setTracePathResult(result);
      } else if (traceStartNode && traceEndNode) {
        // Reset and start new path
        setTraceStartNode(node.id);
        setTraceEndNode(null);
        setTracePathResult(null);
      }
      // Note: Don't return early - allow normal node selection to proceed
    }

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

    // Extract file path
    const projectId = node._project || selectedProjectId;
    const filePath = node._isFile ? (node._filePath || node.id) : (node.id ? node.id.split(':')[0] : null);

    console.log('handleNodeSelect:', { id: node.id, _isFile: node._isFile, _filePath: node._filePath, filePath });
    console.log('Current flow file:', currentFlowFileRef.current, 'New file:', filePath);

    // Check if node is from an external library by path patterns
    // Only block if we can confidently identify it as external
    const isExternalLibrary = filePath && (
      filePath.includes('/node_modules/') ||
      filePath.startsWith('node_modules/') ||
      filePath.includes('/std/') ||
      filePath.includes('/vendor/') ||
      filePath.includes('/external/')
    );

    if (isExternalLibrary) {
      console.log('External library detected, staying in current view:', filePath);
      setSelectedNode(node);
      setNodeInsight(null);
      return;
    }

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
    const fileNodesFromAst = filePath ? astNodes.filter((n: any) => n.id && n.id.startsWith(filePath + ':')) : [];

    console.log('AST data check:', {
      totalAstNodes: astNodes.length,
      fileNodesFromAst: fileNodesFromAst.length,
      hasAstData: !!astData,
      nodeHasCode: !!node.code,
      filePath: filePath
    });

    // Check if this is likely an external function reference (no file path separators, no code)
    // External functions are often referenced as just "fmt", "console", etc.
    const isExternalFunctionRef = filePath && !filePath.includes('/') && !node.code && !node._isFile;
    if (isExternalFunctionRef) {
      console.log('Likely external function reference (no path separators, no code), staying in current view:', filePath);
      return;
    }

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
        debugSetViewMode('flow');
      } catch (e) {
        console.error('Error processing AST data:', e);
      }
      return;
    }

    // Fall back to API if AST data not available
    if (dataApiBase && projectId && filePath) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;

      setIsFlowLoading(true);

      // REFACTOR: Use fetchFileImports to get "Import-Only" view
      console.log('Fetching imports only for:', filePath);

      fetchFileImports(cleanBase, projectId, filePath)
        .then(data => {
          console.log('[Flow] File imports loaded:', data);

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
          debugSetViewMode('flow'); // Switch to flow view

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
  const filteredAstData = useMemo(() => {
    const baseData = expandedGraphData;
    if (!baseData || !('nodes' in baseData)) return baseData;

    const nodes = baseData.nodes;
    const links = baseData.links || [];

    if (showVirtualLinks) {
      return { nodes, links };
    }

    // Filter out virtual links (relation starts with 'v:' or source_type === 'virtual')
    const filteredLinks = links.filter((link: any) => {
      const isVirtual = link.source_type === 'virtual' ||
        (link.relation && link.relation.startsWith('v:'));
      return !isVirtual;
    });

    return { nodes, links: filteredLinks };
  }, [expandedGraphData, showVirtualLinks]);

  // Filter fileScopedData based on showVirtualLinks state
  const filteredFileScopedData = useMemo(() => {
    console.log('[DEBUG] filteredFileScopedData RECALC', {
      nodes: fileScopedData.nodes?.length,
      links: fileScopedData.links?.length,
      showVirtualLinks
    });
    return {
      nodes: fileScopedData.nodes,
      links: showVirtualLinks
        ? fileScopedData.links
        : fileScopedData.links.filter((link: any) => {
          const isVirtual = link.source_type === 'virtual' ||
            (link.relation && link.relation.startsWith('v:'));
          return !isVirtual;
        })
    };
  }, [fileScopedData, showVirtualLinks]);

  const renderCode = () => {
    if (!selectedNode) return (
      <div className="h-full flex items-center justify-center flex-col gap-4 grayscale opacity-20">
        <i className="fas fa-microchip text-5xl"></i>
        <p className="text-[9px] uppercase font-black tracking-[0.2em]">Select an Asset to Inspect</p>
      </div>
    );

    // Show loading skeleton when hydrating
    if (hydratingNodeId === selectedNode.id || (!selectedNode.code && !selectedNode._isMissingCode)) {
      return (
        <div className="h-full flex items-center justify-center flex-col gap-4">
          <div className="flex items-center gap-3">
            <i className="fas fa-circle-notch fa-spin text-[#00f2ff] text-2xl"></i>
            <p className="text-[10px] text-[#00f2ff] font-medium">Loading code...</p>
          </div>
          {/* Code skeleton */}
          <div className="flex-1 w-full max-w-2xl mx-4 space-y-2">
            <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '40%' }}></div>
            <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '70%' }}></div>
            <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '60%' }}></div>
            <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '50%' }}></div>
            <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '80%' }}></div>
          </div>
        </div>
      );
    }

    let code = selectedNode.code;
    if (!code && selectedNode._isMissingCode) {
      return (
        <div className="h-full flex items-center justify-center flex-col gap-3 opacity-30 italic">
          <i className="fas fa-file-invoice text-3xl"></i>
          <p className="text-[10px] uppercase font-bold tracking-widest">Source Buffer Unavailable</p>
        </div>
      );
    }

    let language = 'go';
    const id = (selectedNode.id || "").toLowerCase();
    if (id.endsWith('.ts') || id.endsWith('.tsx')) language = 'typescript';
    else if (id.endsWith('.js') || id.endsWith('.jsx')) language = 'javascript';
    else if (id.endsWith('.py')) language = 'python';
    else if (id.endsWith('.rs')) language = 'rust';
    else if (id.endsWith('.cpp')) language = 'cpp';

    return (
      <HighlightedCode
        code={code || "// Code snippet missing."}
        language={language}
        startLine={selectedNode.start_line || 1}
        scrollToLine={selectedNode._scrollToLine}
      />
    );
  };

  const handleClassDiagramNodeClick = (node: any) => {
    console.log('Class diagram node clicked:', node);

    if (node.start_line) {
      setSelectedNode((prev: any) => ({ ...prev, ...node, _scrollToLine: node.start_line }));
    } else {
      setSelectedNode((prev: any) => ({ ...prev, ...node }));
    }

    // Fetch source code if missing
    if (!node.code && node.filePath && dataApiBase && selectedProjectId) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
      fetchSource(cleanBase, selectedProjectId, node.filePath)
        .then(code => {
          setSelectedNode((prev: any) => ({ ...prev, code }));
          // Update cache
          setSymbolCache(prev => new Map(prev).set(node.filePath, { ...node, code }));
        })
        .catch(err => console.error('[Source] Failed to fetch source:', err));
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
          onMouseDown={() => {
            isResizingSidebar.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
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
                      handleSmartSearch(e.target.value);
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
                      }}
                      className="text-slate-500 hover:text-white ml-4 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                      title="Clear"
                    >
                      <i className="fas fa-times"></i>
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



            {/* Trace Path Mode Button */}
            <button
              onClick={() => {
                setTracePathMode(!tracePathMode);
                if (!tracePathMode) {
                  setTraceStartNode(null);
                  setTraceEndNode(null);
                  setTracePathResult(null);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 border ${tracePathMode ? 'bg-[#a855f7] border-[#a855f7] text-[#0a1118]' : 'bg-transparent border-white/10 text-slate-400 hover:border-[#a855f7]/50'} rounded transition-all`}
              title="Toggle Trace Path mode"
            >
              <i className={`fas fa-route text-[8px] font-black ${tracePathMode ? 'text-[#0a1118]' : 'text-[#a855f7]'}`}></i>
              <span className="text-[8px] font-black uppercase tracking-widest">Trace</span>
            </button>

            {/* Enrich Graph Button */}
            <button
              onClick={() => setShowVirtualLinks(!showVirtualLinks)}
              className={`flex items-center gap-1.5 px-2.5 py-1 border ${showVirtualLinks ? 'bg-[#a855f7] border-[#a855f7] text-[#0a1118]' : 'bg-transparent border-white/10 text-slate-400 hover:border-[#a855f7]/50'} rounded transition-all`}
              title="Toggle virtual links"
            >
              <i className={`fas fa-project-diagram text-[8px] font-black ${showVirtualLinks ? 'text-[#0a1118]' : 'text-[#a855f7]'}`}></i>
              <span className="text-[8px] font-black uppercase tracking-widest">Enrich</span>
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
              const nodeCount = (astData as FlatGraph)?.nodes?.length || 0;
              const linkCount = (astData as FlatGraph)?.links?.length || 0;
              const tooManyNodes = nodeCount > 1000;

              console.log('[DEBUG] AppIIFE Render:', {
                viewMode,
                nodeCount,
                tooManyNodes,
                hasData: !!astData,
                fileScopedDataHeight: fileScopedData?.nodes?.length
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
                        Please use a more specific query to reduce the result size, or use the search functionality to find specific nodes.
                      </p>
                      <div className="flex items-center justify-center gap-3 text-xs">
                        <div className="px-4 py-2 bg-[#16222a] border border-white/10 rounded text-slate-400">
                          <i className="fas fa-lightbulb text-[#f59e0b] mr-2"></i>
                          Try filtering with specific predicates or entity names
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  {/* Trace Path Status Panel */}
                  {tracePathMode && (
                    <div className="absolute top-4 left-4 z-10 p-4 bg-[#0d171d]/95 backdrop-blur-xl border border-[#a855f7]/30 rounded shadow-2xl min-w-[200px]">
                      <h3 className="text-[8px] font-black text-[#a855f7] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <i className="fas fa-route"></i>
                        <span>TRACE PATH MODE</span>
                      </h3>
                      <div className="space-y-2">
                        {!traceStartNode ? (
                          <div className="text-[10px] text-slate-400">
                            <i className="fas fa-mouse-pointer mr-1.5 text-[#a855f7]"></i>
                            Click start node...
                          </div>
                        ) : !traceEndNode ? (
                          <>
                            <div className="text-[10px] text-slate-300">
                              <i className="fas fa-play-circle mr-1.5 text-[#10b981]"></i>
                              Start: <span className="font-mono text-[#00f2ff]">{traceStartNode.split(':').pop()}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              <i className="fas fa-mouse-pointer mr-1.5 text-[#a855f7]"></i>
                              Click end node...
                            </div>
                          </>
                        ) : tracePathResult ? (
                          <>
                            <div className="text-[10px] text-slate-300">
                              <i className="fas fa-play-circle mr-1.5 text-[#10b981]"></i>
                              Start: <span className="font-mono text-[#00f2ff]">{traceStartNode.split(':').pop()}</span>
                            </div>
                            <div className="text-[10px] text-slate-300">
                              <i className="fas fa-flag-checkered mr-1.5 text-[#f59e0b]"></i>
                              End: <span className="font-mono text-[#00f2ff]">{traceEndNode.split(':').pop()}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <div className="text-[10px] text-[#10b981] font-bold">
                                <i className="fas fa-check-circle mr-1.5"></i>
                                Path found: {tracePathResult.path.length} nodes
                              </div>
                              <div className="text-[9px] text-slate-500 mt-1">
                                Length: {tracePathResult.length} hops
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-red-400">
                            <i className="fas fa-exclamation-triangle mr-1.5"></i>
                            No path found
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setTraceStartNode(null);
                            setTraceEndNode(null);
                            setTracePathResult(null);
                          }}
                          className="w-full mt-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] text-slate-400 font-black uppercase tracking-widest transition-all"
                        >
                          <i className="fas fa-redo mr-1.5"></i>
                          Reset
                        </button>
                      </div>
                    </div>
                  )}


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
                      tracePathResult={tracePathResult}
                      expandedFileIds={expandedFileIds}
                      onToggleFileExpansion={toggleFileExpansion}
                      expandingFileId={expandingFileId}
                    />
                  )}
                </>
              );
            })()}
          </div>

          <aside
            style={{ width: codePanelWidth }}
            className="code-panel flex flex-col shrink-0 border-l border-white/10 shadow-2xl z-10 relative bg-[#0d171d]"
          >
            <div
              onMouseDown={() => {
                isResizingCode.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
            />

            <header className="h-12 px-5 border-b border-white/5 flex items-center justify-between bg-[#0a1118] shrink-0">
              <div className="flex items-center gap-3 overflow-hidden mr-4">
                <i className="fas fa-terminal text-[#00f2ff] text-[12px]"></i>
                <span className="text-[10px] font-mono text-slate-300 truncate uppercase tracking-tighter">{selectedNode?.id || "IDLE"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-[8px] font-black px-2 py-0.5 rounded bg-[#00f2ff]/5 border border-[#00f2ff]/20 text-[#00f2ff] uppercase tracking-widest">
                  {selectedNode?.kind || "raw"}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar">
              {renderCode()}
            </div>

            <div className="h-64 border-t border-white/10 p-5 bg-[#0a1118] shadow-2xl flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse shadow-[0_0_8px_#00f2ff]"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">GenAI SYNTHESIS</h3>
                </div>
                <button
                  onClick={generateInsights}
                  disabled={isInsightLoading || !selectedNode}
                  className="px-4 py-2 bg-[#00f2ff] text-[#0a1118] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-20 transition-all shadow-[0_4px_15_rgba(0,242,255,0.2)]"
                >
                  {isInsightLoading ? <i className="fas fa-circle-notch animate-spin"></i> : "Generate Insights"}
                </button>
              </div>
              <div className="flex-1 bg-[#0d171d] p-4 rounded border border-white/5 text-[11px] text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar font-mono">
                {nodeInsight ? nodeInsight : (
                  <div className="flex flex-col items-center justify-center h-full opacity-10 gap-3 grayscale">
                    <i className="fas fa-brain text-4xl"></i>
                    <p className="text-[10px] uppercase font-black tracking-[0.4em]">Inference Engine Standby</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
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

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Gemini API Key (Optional)</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key..."
                    className="w-full bg-[#0a1118] border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f2ff]/50 font-mono"
                  />
                  <p className="mt-2 text-[9px] text-slate-600 leading-normal">
                    Leave blank to use the server-configured key (if available).
                    <br />Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#00f2ff] hover:underline">Google AI Studio</a>.
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