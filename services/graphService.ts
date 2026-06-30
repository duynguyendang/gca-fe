/**
 * Graph API Service
 * Handles API calls for progressive graph expansion
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_CONFIG } from '../constants';
import { logger } from '../logger';

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

const cleanBase = (url: string): string => url.endsWith('/') ? url.slice(0, -1) : url;

// Internal request helper — single fetch+validate+error path for all API calls.
async function request<T>(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    headers?: Record<string, string>;
    parseAs?: 'json' | 'text';
  }
): Promise<T> {
  const base = cleanBase(baseUrl);
  let url = `${base}${path}`;
  if (options?.params) {
    const qs = new URLSearchParams(options.params).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  const fetchOpts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    signal: options?.signal,
  };
  if (options?.body !== undefined) {
    fetchOpts.body = JSON.stringify(options.body);
  }
  const response = await fetchWithTimeout(url, fetchOpts, options?.timeoutMs ?? API_CONFIG.TIMEOUT.DEFAULT, options?.signal);
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`API Error ${response.status} [${method} ${path}]: ${errBody || response.statusText}`);
  }
  const parseAs = options?.parseAs ?? 'json';
  const data = parseAs === 'text' ? await response.text() : await response.json();
  return data as T;
}

export interface GraphMapNode {
  id: string;
  name: string;
  type: string;
  kind: string;
  filePath?: string;
  start_line?: number;
  end_line?: number;
  community?: number;
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
export async function fetchProjects(dataApiBase: string, signal?: AbortSignal): Promise<ProjectMetadata[]> {
  return request<ProjectMetadata[]>(dataApiBase, 'GET', '/api/v1/projects', { signal });
}

/**
 * Fetch project summary
 * GET /api/v1/summary?project={projectId}
 */
export async function fetchSummary(dataApiBase: string, projectId: string): Promise<ProjectSummary> {
  return request<ProjectSummary>(dataApiBase, 'GET', '/api/v1/summary', {
    params: { project: projectId },
  });
}

/**
 * List files in project
 * GET /api/v1/files?project={projectId}
 */
export async function fetchFiles(dataApiBase: string, projectId: string): Promise<string[]> {
  return request<string[]>(dataApiBase, 'GET', '/api/v1/files', {
    params: { project: projectId },
  });
}

/**
 * Get source code
 * GET /api/v1/source?project={projectId}&id={id}&start={start}&end={end}
 */
export async function fetchSource(dataApiBase: string, projectId: string, id: string, start?: number, end?: number): Promise<string> {
  if (!id || typeof id !== 'string') throw new Error('Invalid ID');
  
  const params: Record<string, string> = { project: projectId, id };
  if (start !== undefined) params.start = String(start);
  if (end !== undefined) params.end = String(end);
  
  return request<string>(dataApiBase, 'GET', '/api/v1/source', { params, parseAs: 'text' });
}

/**
 * Search symbols
 * GET /api/v1/symbols?project={projectId}&q={query}&p={predicate}
 */
export async function fetchSymbols(dataApiBase: string, projectId: string, query: string, predicate?: string, signal?: AbortSignal | null): Promise<string[]> {
  const params: Record<string, string> = { project: projectId, q: query };
  if (predicate) params.p = predicate;
  
  const data = await request<{ symbols?: string[] }>(dataApiBase, 'GET', '/api/v1/symbols', { 
    params,
    signal: signal || undefined,
  });
  return data.symbols || [];
}

/**
 * Get predicates
 * GET /api/v1/predicates?project={projectId}
 */
export async function fetchPredicates(dataApiBase: string, projectId: string): Promise<any[]> {
  const data = await request<{ predicates?: any[] }>(dataApiBase, 'GET', '/api/v1/predicates', {
    params: { project: projectId },
  });
  return data.predicates || [];
}

/**
 * Hydrate symbol
 * GET /api/v1/hydrate?project={projectId}&id={id}
 */
export async function fetchHydrate(dataApiBase: string, projectId: string, id: string): Promise<any> {
  return request<any>(dataApiBase, 'GET', '/api/v1/hydrate', {
    params: { project: projectId, id },
  });
}

/**
 * Execute Datalog query
 * POST /api/v1/query
 */
export async function executeQuery(dataApiBase: string, projectId: string, query: string, hydrate: boolean = true, signal?: AbortSignal | null, raw?: boolean): Promise<any> {
  if (!query || typeof query !== 'string') throw new Error('Invalid query');
  
  const sanitizedQuery = sanitizeInput(query, 5000);
  const params: Record<string, string> = { project: projectId };
  if (hydrate) params.hydrate = 'true';
  if (raw) params.raw = 'true';
  
  return request<any>(dataApiBase, 'POST', '/api/v1/query', {
    params,
    body: { query: sanitizedQuery },
    signal: signal || undefined,
    timeoutMs: API_CONFIG.TIMEOUT.LONG,
  });
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
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/graph', {
    params: { project: projectId, file: fileId, lazy: String(lazy) },
  });
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
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/graph/map', {
    params: { project: projectId },
  });
}

/**
 * Fetch project manifest (compressed symbol map)
 * GET /api/v1/graph/manifest?project={projectId}
 */
export async function fetchManifest(
  dataApiBase: string,
  projectId: string
): Promise<{ F: Record<string, string>, S: Record<string, number> }> {
  return request<{ F: Record<string, string>, S: Record<string, number> }>(dataApiBase, 'GET', '/api/v1/graph/manifest', {
    params: { project: projectId },
  });
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
  return request<FileDetailsResponse>(dataApiBase, 'GET', '/api/v1/graph/file-details', {
    params: { file: fileId, project: projectId },
  });
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
  const data = await request<{ nodes?: any[], links?: any[] }>(dataApiBase, 'GET', '/api/v1/graph/backbone', {
    params: { project: projectId, aggregate: String(aggregate) },
  });

  // Backend returns { nodes: [], links: [] } (D3Graph)
  // Frontend expects BackboneResponse with logic-rich "files" array.
  // We must compute "files" from the nodes.

  const nodes = data.nodes || [];
  const links = data.links || [];

  // Build O(1) lookup map: node.id → node
  const nodeById = new Map<string, any>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

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
          // Check target's file — O(1) map lookup instead of O(n) find()
          const targetNode = nodeById.get(t);
          const targetFile = targetNode?.parentId || (t.includes(':') ? t.split(':')[0] : t);
          if (targetFile && targetFile !== group.path) {
            exitNodes.add(node.id);
          }
        }
        if (t === node.id) {
          // This node is called. Is it cross-file?
          const sourceNode = nodeById.get(s);
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
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/graph/file-calls', {
    params: { id: fileId, project: projectId, depth: String(depth) },
    signal: signal || undefined,
    timeoutMs: API_CONFIG.TIMEOUT.LONG,
  });
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
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/search/flow', {
    params: { from, to, project: projectId },
  });
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
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/graph/file-backbone', {
    params: { id: fileId, project: projectId },
  });
}

/**
 * Fetch shortest path between two symbols
 * GET /api/v1/graph/path?project={projectId}&source={source}&target={target}
 */
export async function fetchGraphPath(
  dataApiBase: string,
  projectId: string,
  source: string,
  target: string,
  signal?: AbortSignal | null
): Promise<GraphMapResponse> {
  return request<GraphMapResponse>(dataApiBase, 'GET', '/api/v1/graph/path', {
    params: { project: projectId, source, target },
    signal: signal || undefined,
    timeoutMs: API_CONFIG.TIMEOUT.LONG,
  });
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
  k: number = 10,
  signal?: AbortSignal | null
): Promise<SemanticSearchResult[]> {
  const data = await request<{ results?: SemanticSearchResult[] }>(dataApiBase, 'GET', '/api/v1/semantic-search', {
    params: { project: projectId, q: query, k: String(k) },
    signal: signal || undefined,
    timeoutMs: API_CONFIG.TIMEOUT.SHORT,
  });
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
  return request<GraphMapResponse>(apiBase, 'GET', '/api/v1/graph/cluster', {
    params: { project: projectId, query },
  });
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
  return request<GraphMapResponse>(dataApiBase, 'POST', '/api/v1/graph/subgraph', {
    params: { project: projectId },
    body: { ids },
  });
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
  const params: Record<string, string> = { project: projectId, query };
  if (options?.cursor) params.cursor = options.cursor;
  if (options?.limit) params.limit = String(options.limit);
  if (options?.offset) params.offset = String(options.offset);

  return request<PaginatedGraphResponse>(dataApiBase, 'GET', '/api/v1/graph/paginated', {
    params,
  });
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

// Extended graph link with line number info (for who-calls/what-calls responses)
export interface GraphMapLinkWithLine extends GraphMapLink {
  line?: number;  // Source line number (1-based) for the calling edge
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
): Promise<{ nodes: GraphMapNode[]; links: GraphMapLinkWithLine[] }> {
  const params: Record<string, string> = { 
    project: projectId, 
    symbol, 
    depth: String(depth) 
  };
  if (focused) params.focused = 'true';

  return request<{ nodes: GraphMapNode[]; links: GraphMapLinkWithLine[] }>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/who-calls', 
    { params }
  );
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
): Promise<{ nodes: GraphMapNode[]; links: GraphMapLinkWithLine[] }> {
  const params: Record<string, string> = { 
    project: projectId, 
    symbol, 
    depth: String(depth) 
  };
  if (focused) params.focused = 'true';

  return request<{ nodes: GraphMapNode[]; links: GraphMapLinkWithLine[] }>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/what-calls', 
    { params }
  );
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
  return request<ReachabilityResponse>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/reachable', 
    { 
      params: { 
        project: projectId, 
        from, 
        to, 
        depth: String(depth) 
      } 
    }
  );
}

/**
 * Detect cycles in the call graph
 * GET /api/v1/graph/cycles?project={projectId}
 */
export async function detectCycles(
  dataApiBase: string,
  projectId: string
): Promise<CyclesResponse> {
  return request<CyclesResponse>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/cycles', 
    { params: { project: projectId } }
  );
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
  return request<LCAResponse>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/lca', 
    { 
      params: { 
        project: projectId, 
        a: symbolA, 
        b: symbolB, 
        depth: String(depth) 
      } 
    }
  );
}

// Dashboard V2 Risk Leaderboard types
export interface FileHealth {
  file_name: string;
  total_debt_score: number;
  security_issues: number;
  arch_smells: string[];
}

export interface HealthSummaryV2 {
  overall_score: number;
  total_security_alerts: number;
  total_arch_debt: number;
  files: FileHealth[];
}

/**
 * Health summary response (legacy)
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
  return request<HealthSummary>(
    dataApiBase, 
    'GET', 
    '/api/v1/health/summary', 
    { params: { project: projectId } }
  );
}

/**
 * Fetch health summary V2 (Risk Leaderboard) for a project
 * GET /api/v1/health/summary?project={projectId}&version=2
 */
export async function fetchHealthSummaryV2(
  dataApiBase: string,
  projectId: string
): Promise<HealthSummaryV2> {
  return request<HealthSummaryV2>(
    dataApiBase, 
    'GET', 
    '/api/v1/health/summary/v2', 
    { params: { project: projectId } }
  );
}

/**
 * Enrich store with called_by predicates
 * POST /api/v1/graph/enrich-called-by?project={projectId}
 */
export async function enrichCalledBy(
  dataApiBase: string,
  projectId: string
): Promise<{ status: string; predicate: string }> {
  return request<{ status: string; predicate: string }>(
    dataApiBase, 
    'POST', 
    '/api/v1/graph/enrich-called-by', 
    { params: { project: projectId } }
  );
}

/**
 * Fetch surprise analysis - ranked list of surprising call edges
 * GET /api/v1/analysis/surprise?project={projectId}
 */
export async function fetchSurpriseAnalysis(
  dataApiBase: string,
  projectId: string
): Promise<import('../types').SurpriseResponse> {
  return request<import('../types').SurpriseResponse>(
    dataApiBase, 
    'GET', 
    '/api/v1/analysis/surprise', 
    { params: { project: projectId } }
  );
}

/**
 * Fetch knowledge gaps analysis
 * GET /api/v1/analysis/knowledge-gaps?project={projectId}
 */
export async function fetchKnowledgeGaps(
  dataApiBase: string,
  projectId: string
): Promise<import('../types').KnowledgeGapsResponse> {
  return request<import('../types').KnowledgeGapsResponse>(
    dataApiBase, 
    'GET', 
    '/api/v1/analysis/knowledge-gaps', 
    { params: { project: projectId } }
  );
}

/**
 * Generate integration tests for a symbol or route
 * POST /api/v1/projects/:projectId/test/generate
 */
export async function generateTests(
  dataApiBase: string,
  projectId: string,
  target: string,
  query: string = 'generate integration tests'
): Promise<{ answer: string }> {
  return request<{ answer: string }>(
    dataApiBase, 
    'POST', 
    `/api/v1/projects/${encodeURIComponent(projectId)}/test/generate`, 
    { body: { target, query } }
  );
}

/**
 * Generate tests for all API handlers in the project
 * POST /api/v1/projects/:projectId/test/generate-all
 */
export async function generateTestsAll(
  dataApiBase: string,
  projectId: string,
  depth?: number,
): Promise<import('../types').TestGenerateAllResponse> {
  return request<import('../types').TestGenerateAllResponse>(
    dataApiBase, 
    'POST', 
    `/api/v1/projects/${encodeURIComponent(projectId)}/test/generate-all`, 
    { 
      body: { depth: depth || 3 },
      timeoutMs: API_CONFIG.TIMEOUT.LONG 
    }
  );
}

/**
 * Compute graph diff between two snapshots or current state
 * POST /api/v1/graph/diff
 */
export async function fetchGraphDiff(
  dataApiBase: string,
  projectId: string,
  beforeSnapshotPath?: string,
  afterSnapshotPath?: string,
  beforeId?: string
): Promise<import('../types').GraphDiff> {
  return request<import('../types').GraphDiff>(
    dataApiBase, 
    'POST', 
    '/api/v1/graph/diff', 
    { 
      body: {
        project_id: projectId,
        before_snapshot_path: beforeSnapshotPath,
        after_snapshot_path: afterSnapshotPath,
        before_id: beforeId,
      }
    }
  );
}

/**
 * Fetch list of snapshots for a project
 * GET /api/v1/graph/snapshots?project=...
 */
export async function fetchSnapshots(
  dataApiBase: string,
  projectId: string
): Promise<import('../types').SnapshotInfo[]> {
  return request<import('../types').SnapshotInfo[]>(
    dataApiBase, 
    'GET', 
    '/api/v1/graph/snapshots', 
    { params: { project: projectId } }
  );
}

/**
 * Create a new snapshot for a project
 * POST /api/v1/graph/snapshots
 */
export async function createSnapshot(
  dataApiBase: string,
  projectId: string,
  label?: string
): Promise<import('../types').SnapshotInfo> {
  return request<import('../types').SnapshotInfo>(
    dataApiBase, 
    'POST', 
    '/api/v1/graph/snapshots', 
    { body: { project_id: projectId, label: label || '' } }
  );
}

/**
 * OKF: Ingest a bundle
 * POST /api/v1/okf/ingest
 */
export async function ingestOKFBundle(
  dataApiBase: string,
  projectId: string,
  bundleDir: string
): Promise<import('../types').OKFIngestReport> {
  return request<import('../types').OKFIngestReport>(
    dataApiBase, 
    'POST', 
    '/api/v1/okf/ingest', 
    { body: { project_id: projectId, bundle_dir: bundleDir } }
  );
}

/**
 * OKF: Fetch orphan concepts
 * GET /api/v1/okf/orphans?project=...
 */
export async function fetchOKFOrphans(
  dataApiBase: string,
  projectId: string
): Promise<{ orphans: Array<{ concept_id: string; description?: string }>; count: number }> {
  return request<{ orphans: Array<{ concept_id: string; description?: string }>; count: number }>(
    dataApiBase, 
    'GET', 
    '/api/v1/okf/orphans', 
    { params: { project: projectId } }
  );
}
