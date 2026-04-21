/**
 * Graph API Service
 * Handles API calls for progressive graph expansion
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_CONFIG } from '../src/constants';

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeInput = (input: string, maxLength = 1000): string => {
  if (!input || typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
};

const isValidProjectId = (projectId: string): boolean => {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(projectId);
};

export interface GraphMapNode {
  id: string;
  name: string;
  type: string;
  kind: string;
  filePath?: string;
  start_line?: number;
  end_line?: number;
  [key: string]: any;
}

export interface GraphMapLink {
  source: string;
  target: string;
  relation?: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
}

export interface GraphMapResponse {
  nodes: GraphMapNode[];
  links: GraphMapLink[];
}

export interface FileDetailsResponse {
  nodes: GraphMapNode[];
  links: GraphMapLink[];
}

export interface BackboneNode extends GraphMapNode {
  gatewayType?: 'entry' | 'exit' | 'internal';
  isGateway?: boolean;
  file_path?: string;
}

export interface BackboneLink extends GraphMapLink {
  isCrossFile?: boolean;
  sourceFile?: string;
  targetFile?: string;
}

export interface BackboneResponse {
  nodes: BackboneNode[];
  links: BackboneLink[];
  files: Array<{
    id: string;
    path: string;
    entryNodes: string[];
    exitNodes: string[];
  }>;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectSummary {
  project_name: string;
  total_facts: number;
  top_symbols: any[];
  [key: string]: any;
}

/**
 * Fetch list of projects
 * GET /api/v1/projects
 */
export async function fetchProjects(dataApiBase: string): Promise<ProjectMetadata[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/projects`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch projects: ${response.statusText}`);
  return await response.json();
}

/**
 * Fetch project summary
 * GET /api/v1/summary?project={projectId}
 */
export async function fetchSummary(dataApiBase: string, projectId: string): Promise<ProjectSummary> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/summary?project=${encodeURIComponent(projectId)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch summary: ${response.statusText}`);
  return await response.json();
}

/**
 * List files in project
 * GET /api/v1/files?project={projectId}
 */
export async function fetchFiles(dataApiBase: string, projectId: string): Promise<string[]> {
  if (!isValidUrl(dataApiBase)) throw new Error('Invalid API base URL');
  if (!isValidProjectId(projectId)) throw new Error('Invalid project ID');
  
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/files?project=${encodeURIComponent(projectId)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch files: ${response.statusText}`);
  // Backend returns plain array of strings directly
  return await response.json();
}

/**
 * Get source code
 * GET /api/v1/source?project={projectId}&id={id}&start={start}&end={end}
 */
export async function fetchSource(dataApiBase: string, projectId: string, id: string, start?: number, end?: number): Promise<string> {
  if (!isValidUrl(dataApiBase)) throw new Error('Invalid API base URL');
  if (!isValidProjectId(projectId)) throw new Error('Invalid project ID');
  if (!id || typeof id !== 'string') throw new Error('Invalid ID');
  
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/api/v1/source?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch source: ${response.statusText}`);
  return await response.text();
}

/**
 * Search symbols
 * GET /api/v1/symbols?project={projectId}&q={query}&p={predicate}
 */
export async function fetchSymbols(dataApiBase: string, projectId: string, query: string, predicate?: string): Promise<string[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/api/v1/symbols?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}`;
  if (predicate) url += `&p=${encodeURIComponent(predicate)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch symbols: ${response.statusText}`);
  const data = await response.json();
  return data.symbols || [];
}

/**
 * Get predicates
 * GET /api/v1/predicates?project={projectId}
 */
export async function fetchPredicates(dataApiBase: string, projectId: string): Promise<any[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/predicates?project=${encodeURIComponent(projectId)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch predicates: ${response.statusText}`);
  const data = await response.json();
  return data.predicates || [];
}

/**
 * Hydrate symbol
 * GET /api/v1/hydrate?project={projectId}&id={id}
 */
export async function fetchHydrate(dataApiBase: string, projectId: string, id: string): Promise<any> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/hydrate?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to hydrate symbol: ${response.statusText}`);
  return await response.json();
}

/**
 * Execute Datalog query
 * POST /api/v1/query
 */
export async function executeQuery(dataApiBase: string, projectId: string, query: string, hydrate: boolean = true): Promise<any> {
  if (!isValidUrl(dataApiBase)) throw new Error('Invalid API base URL');
  if (!isValidProjectId(projectId)) throw new Error('Invalid project ID');
  if (!query || typeof query !== 'string') throw new Error('Invalid query');
  
  const sanitizedQuery = sanitizeInput(query, 5000);
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/query?project=${encodeURIComponent(projectId)}${hydrate ? '&hydrate=true' : ''}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error(`Failed to execute query: ${response.statusText}`);

  // Handle potential JSON parsing issues with fallback (simple proxy for now)
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try minimalist repair if needed, similar to App.tsx logic?
    // For now assume server returns valid JSON.
    console.error("JSON Parse Error on Query Response", text.substring(0, 100));
    throw e;
  }
}

/**
 * Fetch composite graph for a specific file (Defines + Imports + Calls)
 * GET /api/v1/graph?project={projectId}&file={fileId}
 */
export async function fetchFileGraph(
  dataApiBase: string,
  projectId: string,
  fileId: string,
  lazy: boolean = true
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(fileId)}&lazy=${lazy}`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch file graph: ${response.statusText}`);
  return await response.json();
}

/**
 * Fetch only imports for a file
 * Query: triples("{fileId}", "imports", ?target)
 */
export async function fetchFileImports(
  dataApiBase: string,
  projectId: string,
  fileId: string
): Promise<GraphMapResponse> {
  const query = `triples("${fileId}", "imports", ?target)`;
  // Use executeQuery but we need to format the result as GraphMapResponse (nodes/links)
  // executeQuery returns whatever the backend returns for POST /api/v1/query, which IS {nodes, links}
  return await executeQuery(dataApiBase, projectId, query, false);
}

/**
 * Fetch the initial graph map (file-level overview)
 * GET /api/v1/graph/map?project={projectId}
 */
export async function fetchGraphMap(
  dataApiBase: string,
  projectId: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/map?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching graph map:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch graph map: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Graph map response:', data);
  return data;
}

/**
 * Fetch project manifest (compressed symbol map)
 * GET /api/v1/graph/manifest?project={projectId}
 */
export async function fetchManifest(
  dataApiBase: string,
  projectId: string
): Promise<{ F: Record<string, string>, S: Record<string, number> }> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/manifest?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching manifest:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch detailed graph for a specific file
 * GET /api/v1/graph/file-details?file={fileId}&project={projectId}
 */
export async function fetchFileDetails(
  dataApiBase: string,
  fileId: string,
  projectId: string
): Promise<FileDetailsResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/file-details?file=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching file details:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file details: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File details response:', data);
  return data;
}

/**
 * Fetch backbone graph (cross-file architecture)
 * GET /api/v1/graph/backbone?project={projectId}&aggregate={aggregate}
 */
export async function fetchBackbone(
  dataApiBase: string,
  projectId: string,
  aggregate: boolean = true
): Promise<BackboneResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/backbone?project=${encodeURIComponent(projectId)}&aggregate=${aggregate}`;

  console.log('[GraphService] Fetching backbone graph:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch backbone graph: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Backbone response:', data);

  // Backend returns { nodes: [], links: [] } (D3Graph)
  // Frontend expects BackboneResponse with logic-rich "files" array.
  // We must compute "files" from the nodes.

  const nodes = data.nodes || [];
  const links = data.links || [];

  // 1. Group nodes by file (using ParentID or splitting ID)
  const fileGroups = new Map<string, { id: string, path: string, nodes: any[] }>();

  nodes.forEach((node: any) => {
    // D3Node has ParentID which is the file path
    const filePath = node.parentId || (node.id.includes(':') ? node.id.split(':')[0] : node.id);

    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, {
        id: filePath,
        path: filePath,
        nodes: []
      });
    }
    fileGroups.get(filePath)?.nodes.push(node);
  });

  // 2. Identify Entry/Exit nodes per file
  // Entry: Node is target of a cross-file link
  // Exit: Node is source of a cross-file link
  const files = Array.from(fileGroups.values()).map(group => {
    const entryNodes = new Set<string>();
    const exitNodes = new Set<string>();

    group.nodes.forEach(node => {
      // Check links
      links.forEach((link: any) => {
        // Normalize source/target if they are objects
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;

        if (s === node.id) {
          // This node calls something. Is it cross-file?
          // Check target's file
          const targetNode = nodes.find((n: any) => n.id === t);
          const targetFile = targetNode?.parentId || (t.includes(':') ? t.split(':')[0] : t);
          if (targetFile && targetFile !== group.path) {
            exitNodes.add(node.id);
          }
        }
        if (t === node.id) {
          // This node is called. Is it cross-file?
          const sourceNode = nodes.find((n: any) => n.id === s);
          const sourceFile = sourceNode?.parentId || (s.includes(':') ? s.split(':')[0] : s);
          if (sourceFile && sourceFile !== group.path) {
            entryNodes.add(node.id);
          }
        }
      });
    });

    return {
      id: group.id,
      path: group.path,
      entryNodes: Array.from(entryNodes),
      exitNodes: Array.from(exitNodes)
    };
  });

  // Return structure matching BackboneResponse interface
  return {
    nodes: nodes,
    links: links.map((l: any) => ({
      ...l,
      source_type: l.type // map backend 'type' to frontend 'source_type'
    })),
    files: files
  };
}

/**
 * Fetch recursive file call graph
 * GET /api/v1/graph/file-calls?id={fileId}&project={projectId}&depth={depth}
 */
export async function fetchFileCalls(
  dataApiBase: string,
  projectId: string,
  fileId: string,
  depth: number = 3,
  signal?: AbortSignal | null
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/file-calls?id=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}&depth=${depth}`;

  console.log('[GraphService] Fetching file calls:', url);
  const response = await fetchWithTimeout(url, {}, API_CONFIG.TIMEOUT.LONG, signal);

  if (!response.ok) {
    throw new Error(`Failed to fetch file calls: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File calls response:', data);
  return data;
}

/**
 * Fetch flow path between two symbols
 * GET /api/v1/search/flow?from={from}&to={to}&project={projectId}
 */
export async function fetchFlowPath(
  dataApiBase: string,
  projectId: string,
  from: string,
  to: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/search/flow?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching flow path:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch flow path: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Flow path response:', data);
  return data;
}

/**
 * Fetch file backbone (bidirectional depth-1)
 * GET /api/v1/graph/file-backbone?id={fileId}&project={projectId}
 */
export async function fetchFileBackbone(
  dataApiBase: string,
  projectId: string,
  fileId: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/file-backbone?id=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching file backbone:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file backbone: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File backbone response:', data);
  return data;
}

/**
 * Fetch shortest path between two symbols
 * GET /api/v1/graph/path?project={projectId}&source={source}&target={target}
 */
export async function fetchGraphPath(
  dataApiBase: string,
  projectId: string,
  source: string,
  target: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/path?project=${encodeURIComponent(projectId)}&source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;

  console.log('[GraphService] Fetching graph path:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch graph path: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Graph path response:', data);
  return data;
}

/**
 * Search for symbols using semantic similarity
 * GET /api/v1/semantic-search?project={projectId}&q={query}&k={k}
 */
export interface SemanticSearchResult {
  symbol_id: string;
  score: number;
  name: string;
}

export async function fetchSemanticSearch(
  dataApiBase: string,
  projectId: string,
  query: string,
  k: number = 10
): Promise<SemanticSearchResult[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/semantic-search?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}&k=${k}`;

  console.log('[GraphService] Fetching semantic search:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch semantic search: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Semantic search response:', data);
  return data.results || [];
}

/**
 * Get clustered graph for large result sets using Leiden algorithm
 * GET /api/v1/graph/cluster?project={projectId}&query={query}
 */
export async function getClusteredGraph(
  apiBase: string,
  projectId: string,
  query: string
): Promise<GraphMapResponse> {
  const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
  const url = `${cleanBase}/api/v1/graph/cluster?project=${encodeURIComponent(projectId)}&query=${encodeURIComponent(query)}`;

  console.log('[GraphService] Fetching clustered graph:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch clustered graph: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Cluster response:', data);
  return data;
}

/**
 * Fetch subgraph for specific IDs (used for cluster expansion)
 * POST /api/v1/graph/subgraph
 */
export async function fetchSubgraph(
  dataApiBase: string,
  projectId: string,
  ids: string[]
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/subgraph?project=${encodeURIComponent(projectId)}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subgraph: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Paginated graph response with cursor-based pagination support
 */
export interface PaginatedGraphResponse {
  nodes: GraphMapNode[];
  links: GraphMapLink[];
  next_cursor?: string;
  has_more: boolean;
  total_nodes: number;
  total_links: number;
}

/**
 * Options for paginated graph loading
 */
export interface PaginatedGraphOptions {
  cursor?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch paginated graph for large datasets with lazy loading
 * GET /api/v1/graph/paginated?project={projectId}&query={query}&cursor={cursor}&limit={limit}&offset={offset}
 */
export async function fetchPaginatedGraph(
  dataApiBase: string,
  projectId: string,
  query: string,
  options?: PaginatedGraphOptions
): Promise<PaginatedGraphResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;

  const params = new URLSearchParams({
    project: projectId,
    query: query
  });

  if (options?.cursor) {
    params.append('cursor', options.cursor);
  }
  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options?.offset) {
    params.append('offset', options.offset.toString());
  }

  const url = `${cleanBase}/api/v1/graph/paginated?${params.toString()}`;

  console.log('[GraphService] Fetching paginated graph:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch paginated graph: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Paginated graph response:', data);
  return data;
}

// Cross-Reference Analysis APIs

export interface WhoCallsResponse {
  nodes: GraphMapNode[];
  links: GraphMapLink[];
}

export interface WhatCallsResponse {
  nodes: GraphMapNode[];
  links: GraphMapLink[];
}

export interface ReachabilityResponse {
  reachable: boolean;
  from: string;
  to: string;
}

export interface CyclesResponse {
  cycles: string[][];
  count: number;
}

export interface LCAResponse {
  lca: string | null;
  a: string;
  b: string;
}

/**
 * Find all callers of a symbol (backward slice)
 * GET /api/v1/graph/who-calls?project={projectId}&symbol={symbol}&depth={depth}&focused={focused}
 */
export async function fetchWhoCalls(
  dataApiBase: string,
  projectId: string,
  symbol: string,
  depth: number = 3,
  focused: boolean = false
): Promise<WhoCallsResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/api/v1/graph/who-calls?project=${encodeURIComponent(projectId)}&symbol=${encodeURIComponent(symbol)}&depth=${depth}`;
  if (focused) {
    url += '&focused=true';
  }

  console.log('[GraphService] Fetching who-calls:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch who-calls: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Who-calls response:', data);
  return data;
}

/**
 * Find all callees of a symbol (forward slice)
 * GET /api/v1/graph/what-calls?project={projectId}&symbol={symbol}&depth={depth}&focused={focused}
 */
export async function fetchWhatCalls(
  dataApiBase: string,
  projectId: string,
  symbol: string,
  depth: number = 3,
  focused: boolean = false
): Promise<WhatCallsResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/api/v1/graph/what-calls?project=${encodeURIComponent(projectId)}&symbol=${encodeURIComponent(symbol)}&depth=${depth}`;
  if (focused) {
    url += '&focused=true';
  }

  console.log('[GraphService] Fetching what-calls:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch what-calls: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] What-calls response:', data);
  return data;
}

/**
 * Check if symbol A can reach symbol B
 * GET /api/v1/graph/reachable?project={projectId}&from={from}&to={to}&depth={depth}
 */
export async function checkReachability(
  dataApiBase: string,
  projectId: string,
  from: string,
  to: string,
  depth: number = 5
): Promise<ReachabilityResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/reachable?project=${encodeURIComponent(projectId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&depth=${depth}`;

  console.log('[GraphService] Checking reachability:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to check reachability: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Reachability response:', data);
  return data;
}

/**
 * Detect cycles in the call graph
 * GET /api/v1/graph/cycles?project={projectId}
 */
export async function detectCycles(
  dataApiBase: string,
  projectId: string
): Promise<CyclesResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/cycles?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Detecting cycles:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to detect cycles: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Cycles response:', data);
  return data;
}

/**
 * Find least common ancestor of two symbols
 * GET /api/v1/graph/lca?project={projectId}&a={a}&b={b}&depth={depth}
 */
export async function findLCA(
  dataApiBase: string,
  projectId: string,
  symbolA: string,
  symbolB: string,
  depth: number = 10
): Promise<LCAResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/lca?project=${encodeURIComponent(projectId)}&a=${encodeURIComponent(symbolA)}&b=${encodeURIComponent(symbolB)}&depth=${depth}`;

  console.log('[GraphService] Finding LCA:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to find LCA: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] LCA response:', data);
  return data;
}

/**
 * Health summary response
 */
export interface HealthSummary {
  overall_score: number;
  total_smells: number;
  total_hubs: number;
  total_entry_points: number;
  smells: Array<{
    file: string;
    smell_type: string;
    severity: 'High' | 'Medium' | 'Low';
  }>;
}

/**
 * Fetch health summary for a project
 * GET /api/v1/health/summary?project={projectId}
 */
export async function fetchHealthSummary(
  dataApiBase: string,
  projectId: string
): Promise<HealthSummary> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/health/summary?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching health summary:', url);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch health summary: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Health summary response:', data);
  return data;
}

/**
 * Enrich store with called_by predicates
 * POST /api/v1/graph/enrich-called-by?project={projectId}
 */
export async function enrichCalledBy(
  dataApiBase: string,
  projectId: string
): Promise<{ status: string; predicate: string }> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/graph/enrich-called-by?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Enriching called_by:', url);
  const response = await fetchWithTimeout(url, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Failed to enrich called_by: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Enrich called_by response:', data);
  return data;
}
