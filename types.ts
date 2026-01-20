
import * as d3 from 'd3';

export interface ASTNode {
  id?: string;
  name: string;
  type: string;
  children?: ASTNode[];
  value?: any;
  [key: string]: any;
}

export interface FlatGraph {
  nodes: Array<{ id: string; name: string; type: string; [key: string]: any }>;
  links: Array<{ source: string; target: string; relation?: string }>;
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
}
