
import * as d3 from 'd3';

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue; }

export interface ASTNode {
  id?: string;
  name: string;
  type: string;
  children?: ASTNode[];
  value?: JsonValue;
  metadata?: Record<string, string>;
}

export interface SymbolStub {
  id: string;
  name: string;
  kind: string;
  type: string;
  filePath?: string;
  start_line?: number;
  end_line?: number;
  parent?: string;
  _isStub?: true;
  code?: never;
}

export type HydratedNode = ASTNode | SymbolStub;

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  kind?: string;
  filePath?: string;
  file_path?: string;
  _filePath?: string;
  start_line?: number;
  end_line?: number;
  code?: string;
  metadata?: Record<string, string>;
  community?: number;
  _isFile?: boolean;
  _isMissingCode?: boolean;
  _scrollToLine?: number;
  _parentFile?: string;
  _isExpandedChild?: boolean;
  _project?: string;
}

export interface GraphLink {
  source: string | { id: string };
  target: string | { id: string };
  relation?: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
  confidence?: number;
  confidence_tier?: ConfidenceTier;
}

export interface FlatGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  depth?: number;
  original: GraphNode;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  relation?: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
}

// Backbone visualization types
export interface BackboneNode {
  id: string;
  name: string;
  type: string;
  kind: string;
  filePath?: string;
  file_path?: string;
  start_line?: number;
  end_line?: number;
  gatewayType?: 'entry' | 'exit' | 'internal';
  isGateway?: boolean;
  code?: string;
  metadata?: Record<string, string>;
}

export interface BackboneLink {
  source: string;
  target: string;
  relation?: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
  isCrossFile?: boolean;
  sourceFile?: string;
  targetFile?: string;
}

export interface BackboneGraph {
  nodes: BackboneNode[];
  links: BackboneLink[];
  files?: Array<{
    id: string;
    path: string;
    entryNodes: string[];
    exitNodes: string[];
  }>;
}

export interface BackboneFileCluster {
  filePath: string;
  fileName: string;
  entryNodes: BackboneNode[];
  exitNodes: BackboneNode[];
  internalNodes: BackboneNode[];
  outgoingLinks: BackboneLink[];
  incomingLinks: BackboneLink[];
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

// Legacy health summary (for backward compatibility)
export interface HealthSummaryLegacy {
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

// Confidence tier for edge reliability
export type ConfidenceTier = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';

// Extended graph link with confidence
export interface GraphLinkExtended extends GraphLink {
  confidence?: number;
  confidence_tier?: ConfidenceTier;
}

// Surprise analysis types
export interface SurpriseFactor {
  type: string;
  score: number;
}

export interface SurpriseEdge {
  source: string;
  target: string;
  score: number;
  factors: SurpriseFactor[];
  src_file?: string;
  tgt_file?: string;
}

export interface SurpriseResponse {
  edges: SurpriseEdge[];
  total_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

// Knowledge gap types
export interface KnowledgeGapItem {
  symbol: string;
  gap_type: 'isolated' | 'untested_hotspot' | 'thin_community' | 'single_file_community';
  severity: 'high' | 'medium' | 'low';
  detail: string;
  degree?: number;
}

export interface KnowledgeGapsResponse {
  isolated_nodes: KnowledgeGapItem[];
  untested_hotspots: KnowledgeGapItem[];
  thin_communities: KnowledgeGapItem[];
  single_file_clusters: KnowledgeGapItem[];
  total_count: number;
}

// Graph diff types
export interface NodeDiff {
  id: string;
  kind: string;
  file?: string;
  surprise_score?: number;
}

export interface EdgeDiff {
  id: string;
  source: string;
  target: string;
  predicate: string;
  surprise_score?: number;
}

export interface CommChange {
  node: string;
  before_cluster: number;
  after_cluster: number;
}

export interface DiffSummary {
  nodes_added: number;
  nodes_removed: number;
  edges_added: number;
  edges_removed: number;
  community_moves: number;
  before_total_nodes: number;
  after_total_nodes: number;
}

export interface GraphDiff {
  new_nodes: NodeDiff[];
  removed_nodes: string[];
  new_edges: EdgeDiff[];
  removed_edges: string[];
  community_changes: CommChange[];
  summary: DiffSummary;
}

// Community cluster info
export interface CommunityInfo {
  cluster_id: number;
  member_count: number;
  color?: string;
}
