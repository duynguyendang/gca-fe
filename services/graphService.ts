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
 * GET /v1/graph/backbone?project={projectId}
 */
export async function fetchBackbone(
  dataApiBase: string,
  projectId: string
): Promise<BackboneResponse> {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/graph/backbone?project=${encodeURIComponent(projectId)}`;

  console.log('[GraphService] Fetching backbone graph:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch backbone graph: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[GraphService] Backbone response:', data);
  return data;
}
