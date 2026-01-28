/**
 * Graph API Service
 * Handles API calls for progressive graph expansion
 */

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
 * GET /v1/projects
 */
export async function fetchProjects(dataApiBase: string): Promise<ProjectMetadata[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/projects`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch projects: ${response.statusText}`);
  return await response.json();
}

/**
 * Fetch project summary
 * GET /v1/summary?project={projectId}
 */
export async function fetchSummary(dataApiBase: string, projectId: string): Promise<ProjectSummary> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/summary?project=${encodeURIComponent(projectId)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch summary: ${response.statusText}`);
  return await response.json();
}

/**
 * List files in project
 * GET /v1/files?project={projectId}
 */
export async function fetchFiles(dataApiBase: string, projectId: string): Promise<string[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/files?project=${encodeURIComponent(projectId)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch files: ${response.statusText}`);
  const data = await response.json();
  return data.files || [];
}

/**
 * Get source code
 * GET /v1/source?project={projectId}&id={id}&start={start}&end={end}
 */
export async function fetchSource(dataApiBase: string, projectId: string, id: string, start?: number, end?: number): Promise<string> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/v1/source?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch source: ${response.statusText}`);
  return await response.text();
}

/**
 * Search symbols
 * GET /v1/symbols?project={projectId}&q={query}&p={predicate}
 */
export async function fetchSymbols(dataApiBase: string, projectId: string, query: string, predicate?: string): Promise<string[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  let url = `${cleanBase}/v1/symbols?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}`;
  if (predicate) url += `&p=${encodeURIComponent(predicate)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch symbols: ${response.statusText}`);
  const data = await response.json();
  return data.symbols || [];
}

/**
 * Get predicates
 * GET /v1/predicates?project={projectId}
 */
export async function fetchPredicates(dataApiBase: string, projectId: string): Promise<any[]> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/predicates?project=${encodeURIComponent(projectId)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch predicates: ${response.statusText}`);
  const data = await response.json();
  return data.predicates || [];
}

/**
 * Hydrate symbol
 * GET /v1/hydrate?project={projectId}&id={id}
 */
export async function fetchHydrate(dataApiBase: string, projectId: string, id: string): Promise<any> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/hydrate?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to hydrate symbol: ${response.statusText}`);
  return await response.json();
}

/**
 * Execute Datalog query
 * POST /v1/query
 */
export async function executeQuery(dataApiBase: string, projectId: string, query: string, hydrate: boolean = true): Promise<any> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/query?project=${encodeURIComponent(projectId)}${hydrate ? '&hydrate=true' : ''}`;

  const response = await fetch(url, {
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
 * GET /v1/graph?project={projectId}&file={fileId}
 */
export async function fetchFileGraph(
  dataApiBase: string,
  projectId: string,
  fileId: string,
  lazy: boolean = true
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(fileId)}&lazy=${lazy}`;

  const response = await fetch(url);
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
  // executeQuery returns whatever the backend returns for POST /v1/query, which IS {nodes, links}
  return await executeQuery(dataApiBase, projectId, query, false);
}

/**
 * Fetch the initial graph map (file-level overview)
 * GET /v1/graph/map?project={projectId}
 */
export async function fetchGraphMap(
  dataApiBase: string,
  projectId: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/map?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching graph map:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch graph map: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Graph map response:', data);
  return data;
}

/**
 * Fetch project manifest (compressed symbol map)
 * GET /v1/graph/manifest?project={projectId}
 */
export async function fetchManifest(
  dataApiBase: string,
  projectId: string
): Promise<{ F: Record<string, string>, S: Record<string, number> }> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/manifest?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching manifest:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch detailed graph for a specific file
 * GET /v1/graph/file-details?file={fileId}&project={projectId}
 */
export async function fetchFileDetails(
  dataApiBase: string,
  fileId: string,
  projectId: string
): Promise<FileDetailsResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/file-details?file=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching file details:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file details: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File details response:', data);
  return data;
}

/**
 * Fetch backbone graph (cross-file architecture)
 * GET /v1/graph/backbone?project={projectId}&aggregate={aggregate}
 */
export async function fetchBackbone(
  dataApiBase: string,
  projectId: string,
  aggregate: boolean = true
): Promise<BackboneResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/backbone?project=${encodeURIComponent(projectId)}&aggregate=${aggregate}`;

  console.log('[GraphService] Fetching backbone graph:', url);
  const response = await fetch(url);

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
 * GET /v1/graph/file-calls?id={fileId}&project={projectId}&depth={depth}
 */
export async function fetchFileCalls(
  dataApiBase: string,
  projectId: string,
  fileId: string,
  depth: number = 3
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/file-calls?id=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}&depth=${depth}`;

  console.log('[GraphService] Fetching file calls:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file calls: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File calls response:', data);
  return data;
}

/**
 * Fetch flow path between two symbols
 * GET /v1/search/flow?from={from}&to={to}&project={projectId}
 */
export async function fetchFlowPath(
  dataApiBase: string,
  projectId: string,
  from: string,
  to: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/search/flow?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching flow path:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch flow path: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Flow path response:', data);
  return data;
}

/**
 * Fetch file backbone (bidirectional depth-1)
 * GET /v1/graph/file-backbone?id={fileId}&project={projectId}
 */
export async function fetchFileBackbone(
  dataApiBase: string,
  projectId: string,
  fileId: string
): Promise<GraphMapResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/file-backbone?id=${encodeURIComponent(fileId)}&project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching file backbone:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file backbone: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] File backbone response:', data);
  return data;
}
