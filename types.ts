
import * as d3 from 'd3';

export interface ASTNode {
  id?: string;
  name: string;
  type: string;
  children?: ASTNode[];
  value?: any;
  [key: string]: any;
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
  code?: never; // SymbolStub never has code
}

export type HydratedNode = ASTNode | SymbolStub;

export interface FlatGraph {
  nodes: Array<{ id: string; name: string; type: string; [key: string]: any }>;
  links: Array<{ source: string; target: string; relation?: string; source_type?: 'ast' | 'virtual'; weight?: number }>;
}

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  depth?: number;
  original: any;
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
  [key: string]: any;
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
