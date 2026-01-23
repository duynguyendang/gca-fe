
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import TreeVisualizer from './components/TreeVisualizer/index';
import ClassDiagramCanvas from './components/ClassDiagramCanvas';
import HighlightedCode from './components/HighlightedCode';
import FileTreeItem from './components/FileTreeItem';
import { ASTNode, FlatGraph, BackboneGraph, BackboneNode, BackboneLink } from './types';
import { getGeminiInsight } from './services/geminiService';
import { findShortestPath, PathResult } from './utils/pathfinding';
import { fetchGraphMap, fetchFileDetails, fetchBackbone, GraphMapResponse, FileDetailsResponse } from './services/graphService';

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

const traceBackboneConnections = (graph: BackboneGraph, fileId: string): Set<string> => {
  const activeIds = new Set<string>();
  const fileNodes = graph.nodes.filter(n => n.file_path === fileId);
  if (fileNodes.length === 0) return activeIds;

  // Add all nodes from selected file
  fileNodes.forEach(n => activeIds.add(n.id));
  activeIds.add(fileId); // Add the file itself

  // Find connected links and nodes (simple BFS for now, or just immediate 1-hop? Let's do recursive)
  // Actually, full path trace might be too noisy. Let's do "Connected Component" via cross-file links.

  const queue = [...fileNodes.map(n => n.id)];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    activeIds.add(currId);

    // Find links connected to currId
    graph.links.forEach(link => {
      const isConnected = link.source === currId || link.target === currId;
      if (!isConnected) return;

      // We only traverse CROSS-FILE links to find other files
      // BUT within a file, we should arguably show everything? 
      // Let's stick to: traverse cross-file links, and if we enter a node, we add its file too.

      const otherId = link.source === currId ? link.target : link.source;
      if (!visited.has(otherId)) {
        // Check if this link is cross-file or if we want to follow it
        // For backbone, usually we care about how data flows across files.
        // Let's follow ALL links in the backbone graph since it's already a summary.
        visited.add(otherId);
        queue.push(otherId);

        // Also add the file of the other node
        const otherNode = graph.nodes.find(n => n.id === otherId);
        if (otherNode && otherNode.file_path) {
          activeIds.add(otherNode.file_path);
        }
      }
      // Add the link itself to "active"? We might handle link highlighting separately based on node presence.
    });
  }

  return activeIds;
};

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

  const [dataApiBase, setDataApiBase] = useState<string>(() => {
    return sessionStorage.getItem('gca_data_api_base') || '';
  });

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Class Diagram state
  const [fileScopedNodes, setFileScopedNodes] = useState<any[]>([]);
  const [fileScopedLinks, setFileScopedLinks] = useState<any[]>([]);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const currentFlowFileRef = useRef<string | null>(null);
  const [skipFlowZoom, setSkipFlowZoom] = useState(false);

  // View Modes: flow (Architecture), map (Circle), discovery (Force), backbone (Cross-file architecture)
  const [viewMode, setViewMode] = useState<'flow' | 'map' | 'discovery' | 'backbone'>('discovery');

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
  const [backboneData, setBackboneData] = useState<BackboneGraph | null>(null);
  const [isBackboneLoading, setIsBackboneLoading] = useState(false);
  const [selectedFileInBackbone, setSelectedFileInBackbone] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[] | null>(null);
  const [showArchitecturePanel, setShowArchitecturePanel] = useState(false);

  // Debug wrapper for setViewMode
  const debugSetViewMode = useCallback((newMode: typeof viewMode) => {
    console.log('setViewMode called:', { from: viewMode, to: newMode });
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

  // Fetch backbone data when switching to backbone mode
  const setBackboneMode = useCallback(async () => {
    debugSetViewMode('backbone');
    if (!dataApiBase || !selectedProjectId || backboneData) {
      return; // Already loaded or no API configured
    }

    setIsBackboneLoading(true);
    try {
      const data = await fetchBackbone(dataApiBase, selectedProjectId);
      setBackboneData(data);
      console.log('[Backbone] Loaded backbone graph:', data.nodes.length, 'gateway nodes,', data.links.length, 'cross-file links');
    } catch (error) {
      console.error('[Backbone] Failed to load backbone:', error);
    } finally {
      setIsBackboneLoading(false);
    }
  }, [dataApiBase, selectedProjectId, backboneData, debugSetViewMode]);



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
      console.warn('Failed to save AST data to session storage:', e);
    }
    try {
      sessionStorage.setItem('gca_ast_data', JSON.stringify(astData));
    } catch (e) {
      console.warn('Failed to save AST data to session storage:', e);
    }
  }, [astData]);

  useEffect(() => {
    try {
      sessionStorage.setItem('gca_sandbox_files', JSON.stringify(sandboxFiles));
    } catch (e) {
      console.warn('Failed to save sandbox files to session storage:', e);
    }
    try {
      sessionStorage.setItem('gca_sandbox_files', JSON.stringify(sandboxFiles));
    } catch (e) {
      console.warn('Failed to save sandbox files to session storage:', e);
    }
  }, [sandboxFiles]);

  useEffect(() => {
    try {
      sessionStorage.setItem('gca_data_api_base', dataApiBase);
    } catch (e) {
      console.warn('Failed to save API base to session storage:', e);
    }
    try {
      sessionStorage.setItem('gca_data_api_base', dataApiBase);
    } catch (e) {
      console.warn('Failed to save API base to session storage:', e);
    }
  }, [dataApiBase]);

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
        document.head.appendChild(langScript);
      });
    };
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

  // Search symbols or run Datalog query via API
  const searchSymbols = useCallback(async (query: string) => {
    console.log('=== searchSymbols called ===');
    console.log('query:', query);
    console.log('dataApiBase:', dataApiBase);
    console.log('selectedProjectId:', selectedProjectId);

    setSearchError(null);

    if (!dataApiBase || !selectedProjectId || !query || query.length < 1) {
      console.log('Search cancelled: missing dataApiBase or selectedProjectId or query');
      if (!dataApiBase) {
        setSearchError('API endpoint not configured. Please click the gear icon to set up the Data API.');
      } else if (!selectedProjectId) {
        setSearchError('No project selected. Please open settings and select a project.');
      }
      setQueryResults(null);

      // If no API configured, try local search as fallback
      if (!dataApiBase && query && astData?.nodes) {
        console.log('Trying local search fallback...');
        const localResults = {
          nodes: astData.nodes.filter((n: any) =>
            n.name?.toLowerCase().includes(query.toLowerCase()) ||
            n.id?.toLowerCase().includes(query.toLowerCase())
          ),
          links: astData.links || []
        };
        console.log('Local search results:', localResults.nodes.length, 'nodes');
        if (localResults.nodes.length > 0) {
          setQueryResults(localResults);
        }
      }
      return;
    }

    setIsSearching(true);
    setQueryResults(null);
    const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;

    try {
      console.log('Fetching from API:', `${cleanBase}/v1/query?project=${encodeURIComponent(selectedProjectId)}`);
      const res = await fetch(`${cleanBase}/v1/query?project=${encodeURIComponent(selectedProjectId)}&hydrate=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      console.log('Response status:', res.status, res.statusText);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      if (res.ok) {
        const rawText = await res.text();
        console.log('Raw response length:', rawText.length);
        console.log('Raw response (first 500 chars):', rawText.substring(0, 500));

        // Try to parse JSON with better error handling
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          // The response likely has trailing content after a valid JSON object
          // Find the first complete JSON object by counting braces
          let braceCount = 0;
          let bracketCount = 0;
          let inString = false;
          let escapeNext = false;
          let jsonEnd = -1;

          for (let i = 0; i < rawText.length; i++) {
            const char = rawText[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') braceCount--;
              else if (char === '[') bracketCount++;
              else if (char === ']') bracketCount--;

              // Check if we've closed all braces and brackets
              if (braceCount === 0 && bracketCount === 0 && i > 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }

          if (jsonEnd > 0) {
            try {
              const trimmedJson = rawText.substring(0, jsonEnd);
              console.log('Trimmed JSON to', jsonEnd, 'chars (from', rawText.length, ')');
              console.log('Last 100 chars of trimmed JSON:', trimmedJson.slice(-100));
              data = JSON.parse(trimmedJson);
              console.warn('Successfully parsed JSON by trimming trailing content');
            } catch (retryErr) {
              console.error('Failed to parse even trimmed JSON:', retryErr);
              throw new Error(`Invalid JSON from API. ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`);
            }
          } else {
            throw new Error(`Invalid JSON from API. ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`);
          }
        }

        console.log('Parsed API response:', data);
        const responseData: any = data;
        setQueryResults(responseData);
        if (responseData.nodes && responseData.nodes.length > 0) {
          setAstData(prev => ({
            nodes: responseData.nodes.map((n: any) => ({ ...n, _project: selectedProjectId })),
            links: responseData.links || []
          }));
        }
      } else {
        const errorText = await res.text();
        console.error('API error response:', errorText);
        setSearchError(`API error: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
    } catch (e) {
      console.error("Search error:", e);
      setSearchError(`Search failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setQueryResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [dataApiBase, selectedProjectId, astData]);

  // Additional memoized callbacks (defined after searchSymbols due to dependency)
  const runSearch = useCallback(() => {
    if (searchTerm) {
      searchSymbols(searchTerm);
    }
  }, [searchTerm, searchSymbols]);

  const generateInsights = useCallback(() => {
    setIsInsightLoading(true);
    getGeminiInsight(selectedNode).then(i => {
      setNodeInsight(i);
      setIsInsightLoading(false);
    }).catch(() => {
      setIsInsightLoading(false);
      setNodeInsight("Analysis connection failed.");
    });
  }, [selectedNode]);

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
      console.log('[Expand] Successfully fetched file details:', details);

      // Cache the result
      setFileDetailsCache(prev => new Map(prev).set(fileId, details));

      // Add to expanded set
      setExpandedFileIds(prev => new Set(prev).add(fileId));
    } catch (error) {
      console.error('[Expand] Error fetching file details:', error);
    } finally {
      setExpandingFileId(null);
    }
  }, [dataApiBase, selectedProjectId, expandedFileIds, fileDetailsCache]);

  // Collapse a file to hide its internal symbols
  const collapseFile = useCallback((fileId: string) => {
    console.log('[Collapse] Collapsing file:', fileId);
    setExpandedFileIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
  }, []);

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

  const handleNodeSelect = useCallback(async (node: any) => {
    console.log('=== SYNC TRINITY: Node Clicked ===');
    console.log('1. Graph: Highlighting node:', node.id);

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
        debugSetViewMode('flow');
      } catch (e) {
        console.error('Error processing AST data:', e);
      }
      return;
    }

    // Fall back to API if AST data not available
    if (dataApiBase && projectId && filePath) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;

      fetch(`${cleanBase}/v1/graph?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(filePath)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.nodes && data.nodes.length > 0) {
            console.log('Graph API response:', data.nodes.length, 'nodes,', data.links?.length, 'links');

            const fileNode = data.nodes.find((n: any) => n.kind === 'file' || n.id === filePath);
            if (fileNode && fileNode.code) {
              setSelectedNode((prev: any) => ({ ...prev, ...fileNode, _project: projectId }));
            }

            try {
              const nodesWithInDegree = data.nodes.map((n: any, i: number) => {
                const nodeId = n.id;
                const inDegree = data.links?.filter((l: any) => {
                  const target = typeof l.target === 'object' ? l.target.id : l.target;
                  return target === nodeId;
                }).length || 0;

                return {
                  id: nodeId,
                  name: n.name,
                  kind: n.kind || n.type || 'func',
                  filePath: filePath,
                  start_line: n.start_line || n.metadata?.start_line,
                  end_line: n.end_line || n.metadata?.end_line,
                  parent: n.metadata?.parent || n.parent,
                  inDegree,
                  code: n.code,
                  _filePath: n._filePath || filePath,
                  _project: n._project || projectId
                };
              });

              console.log('Nodes with IDs:', nodesWithInDegree.map(n => n.id).slice(0, 5));

              const nodeIds = new Set(nodesWithInDegree.map(n => n.id));
              const nodeNames = new Set(nodesWithInDegree.map(n => n.name));

              const diagramLinks = (data.links || [])
                .filter((l: any) => {
                  if (!l) return false;
                  const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                  const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                  const sourceName = typeof l.source === 'object' ? l.source.name : l.source.split(':').pop();
                  const targetName = typeof l.target === 'object' ? l.target.name : l.target.split(':').pop();

                  const hasSource = nodeIds.has(sourceId) || nodeNames.has(sourceName);
                  const hasTarget = nodeIds.has(targetId) || nodeNames.has(targetName);
                  return hasSource || hasTarget;
                })
                .map((l: any) => ({
                  source: typeof l.source === 'object' ? l.source.id : l.source,
                  target: typeof l.target === 'object' ? l.target.id : l.target,
                  relation: l.relation || 'defines'
                }));

              console.log('Filtered links:', diagramLinks.slice(0, 5));

              setSkipFlowZoom(false);
              setFileScopedNodes(nodesWithInDegree);
              setFileScopedLinks(diagramLinks);
              currentFlowFileRef.current = filePath; // Update current file ref
              debugSetViewMode('flow');
            } catch (e) {
              console.error('Error processing API data:', e);
            }
          } else {
            setFileScopedNodes([]);
            setFileScopedLinks([]);
          }
        })
        .catch(e => {
          console.error("Error fetching file graph:", e);
        });
    }
  }, [dataApiBase, selectedProjectId, astData, viewMode, fileScopedNodes, debugSetViewMode]);

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
  const filteredFileScopedData = useMemo(() => ({
    nodes: fileScopedData.nodes,
    links: showVirtualLinks
      ? fileScopedData.links
      : fileScopedData.links.filter((link: any) => {
        const isVirtual = link.source_type === 'virtual' ||
          (link.relation && link.relation.startsWith('v:'));
        return !isVirtual;
      })
  }), [fileScopedData, showVirtualLinks]);

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

    if (!node.code && node.filePath && dataApiBase && selectedProjectId) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
      fetch(`${cleanBase}/v1/source?project=${encodeURIComponent(selectedProjectId)}&id=${encodeURIComponent(node.filePath)}`)
        .then(r => r.ok ? r.text() : null)
        .then(code => {
          if (code) {
            setSelectedNode((prev: any) => ({ ...prev, code, _scrollToLine: node.start_line }));
          }
        })
        .catch(e => console.error('Error fetching code:', e));
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
              {/* Object.entries(sourceTree).map(([name, node]) => (
                  <FileTreeItem
                    key={name}
                    name={name}
                    node={node as any}
                    depth={0}
                    onNodeSelect={handleNodeSelect}
                    astData={astData}
                    selectedNode={selectedNode}
                  />
                )) */}
              {Object.keys(sourceTree).length === 0 && (
                <div className="px-4 py-8 text-center text-[10px] text-slate-700 italic border border-dashed border-white/5 rounded mx-2">
                  No files indexed.<br />Upload AST or configure API.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 bg-[#0d171d] space-y-2">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
          <button
            onClick={triggerFileInput}
            className="w-full py-2 bg-[#00f2ff]/5 hover:bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded text-[9px] font-black uppercase tracking-[0.3em] text-[#00f2ff] transition-all shadow-inner"
          >
            <i className="fas fa-file-import mr-2"></i> Local Import
          </button>
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
          <div className="flex-1 flex items-center bg-[#16222a] border border-white/5 rounded-full px-1 py-1 max-w-xl shadow-inner relative">
            <div className="px-3 py-1 rounded-full text-[9px] font-black bg-[#f59e0b] text-[#0a1118] border border-[#f59e0b] mr-2 uppercase">
              Query
            </div>
            <input
              type="text"
              placeholder='Datalog query (e.g., triples(?s, "calls", ?o))...'
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchError(null);
                clearTimeout((e.target as any)._searchTimeout);
                (e.target as any)._searchTimeout = setTimeout(() => {
                  searchSymbols(e.target.value);
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm) {
                  searchSymbols(searchTerm);
                }
              }}
              className="bg-transparent border-none flex-1 px-4 text-[11px] focus:outline-none text-white font-mono placeholder-slate-700"
            />
            {isSearching && <i className="fas fa-circle-notch fa-spin text-[#00f2ff] text-[10px] absolute right-12"></i>}

            {/* Query results summary */}
            {(queryResults || searchError) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d171d] border border-[#f59e0b]/30 rounded-lg shadow-2xl z-50 p-3">
                <div className="flex items-start justify-between">
                  {searchError ? (
                    <div className="text-[10px] text-red-400 font-black uppercase tracking-widest flex items-start gap-2">
                      <i className="fas fa-exclamation-circle mt-0.5"></i>
                      <span>{searchError}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#f59e0b] font-black uppercase tracking-widest">
                      Query Results: {queryResults.nodes?.length || 0} nodes, {queryResults.links?.length || 0} links
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setQueryResults(null);
                      setSearchError(null);
                    }}
                    className="text-slate-500 hover:text-white ml-4"
                    title={searchError ? 'Dismiss error' : 'Clear results'}
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
              className="w-8 h-8 rounded-full bg-[#f59e0b] flex items-center justify-center text-[#0a1118] text-[10px] disabled:opacity-50"
            >
              <i className="fas fa-play"></i>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#16222a] border border-white/5 rounded px-1">
              <span className="px-2 py-1 text-[7px] font-black text-[#10b981] uppercase tracking-wider">Flow</span>
              <button
                onClick={setFlowMode}
                className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded ${viewMode === 'flow' ? 'bg-[#10b981] text-[#0a1118]' : 'hover:bg-white/5 text-slate-400'}`}
              >
                View
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#16222a] border border-white/5 rounded px-1">
              <span className="px-2 py-1 text-[7px] font-black text-[#f59e0b] uppercase tracking-wider">Map</span>
              <button
                onClick={setMapMode}
                className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded ${viewMode === 'map' ? 'bg-[#f59e0b] text-[#0a1118]' : 'hover:bg-white/5 text-slate-400'}`}
              >
                View
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#16222a] border border-white/5 rounded px-1">
              <span className="px-2 py-1 text-[7px] font-black text-[#00f2ff] uppercase tracking-wider">Discovery</span>
              <button
                onClick={setDiscoveryMode}
                className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded ${viewMode === 'discovery' ? 'bg-[#00f2ff] text-[#0a1118]' : 'hover:bg-white/5 text-slate-400'}`}
              >
                View
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#16222a] border border-white/5 rounded px-1">
              <span className="px-2 py-1 text-[7px] font-black text-[#a855f7] uppercase tracking-wider">Backbone</span>
              <button
                onClick={setBackboneMode}
                className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded ${viewMode === 'backbone' ? 'bg-[#a855f7] text-[#0a1118]' : 'hover:bg-white/5 text-slate-400'}`}
              >
                {isBackboneLoading ? <i className="fas fa-circle-notch fa-spin"></i> : 'View'}
              </button>
            </div>

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
              <span className={`text-[8px] font-black uppercase tracking-widest ${viewMode === 'flow' ? 'text-[#10b981]' :
                viewMode === 'map' ? 'text-[#f59e0b]' :
                  viewMode === 'backbone' ? 'text-[#a855f7]' : 'text-[#00f2ff]'
                }`}>
                {viewMode === 'flow' ? 'FLOW' : viewMode === 'map' ? 'MAP' : viewMode === 'backbone' ? 'BACKBONE' : 'DISCOVERY'}
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

              return viewMode !== 'flow' ? (
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

                  <div className="absolute top-4 left-4 z-10 p-3 bg-[#0d171d]/95 backdrop-blur-xl border border-white/10 rounded shadow-2xl min-w-[160px]">
                    <h3 className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center justify-between">
                      <span>MOUNTED ASSETS</span>
                      <span className="text-[#00f2ff]">{Object.keys(sandboxFiles).length}</span>
                    </h3>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {Object.keys(sandboxFiles).map(f => (
                        <div key={f} className="text-[9px] font-mono text-[#00f2ff]/70 flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#00f2ff]/40 shadow-[0_0_5px_#00f2ff]"></div> {f}
                        </div>
                      ))}
                      {Object.keys(sandboxFiles).length === 0 && <span className="text-[9px] text-slate-700 italic">Local cache empty</span>}
                    </div>
                  </div>
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
                    backboneData={backboneData}
                    selectedFileInBackbone={selectedFileInBackbone}
                    highlightedPath={highlightedPath}
                    isBackboneLoading={isBackboneLoading}
                    onFileSelectInBackbone={(file) => {
                      console.log('Selected file in backbone:', file);
                      if (selectedFileInBackbone === file) {
                        // Deselect
                        setSelectedFileInBackbone(null);
                        setHighlightedPath(null);
                      } else {
                        setSelectedFileInBackbone(file);
                        if (backboneData) {
                          const activeSet = traceBackboneConnections(backboneData, file);
                          setHighlightedPath(Array.from(activeSet));
                        }
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  {/* Trace Path Status Panel for Flow Mode */}
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

        {showArchitecturePanel && (
          <div className="absolute bottom-24 right-4 w-80 h-64 bg-[#0d171d]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-20 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#0a1118]/50">
              <div className="flex items-center gap-2">
                <i className="fas fa-sitemap text-[#10b981] text-[10px]"></i>
                <span className="text-[9px] font-black uppercase tracking-wider text-white/80">Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowArchitecturePanel(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </div>
            </div>
            <div className="flex-1">
              <ClassDiagramCanvas
                nodes={fileScopedNodes}
                links={fileScopedLinks}
                onNodeClick={handleClassDiagramNodeClick}
                width={320}
                height={220}
              />
            </div>
            <div className="px-3 py-1.5 border-t border-white/5 bg-[#0a1118]/30 flex items-center justify-between">
              <span className="text-[8px] text-slate-600 font-mono">
                {fileScopedNodes.length} symbols
              </span>
            </div>
          </div>
        )}

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
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
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
              <button
                onClick={closeSettings}
                className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;