
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
  [key: string]: JsonValue;
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
  start_line?: number;
  end_line?: number;
  code?: string;
  metadata?: Record<string, string>;
  [key: string]: JsonValue;
}

export interface GraphLink {
  source: string;
  target: string;
  relation?: string;
  source_type?: 'ast' | 'virtual';
  weight?: number;
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
  [key: string]: JsonValue;
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
