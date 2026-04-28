import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ASTNode, FlatGraph, GraphNode, GraphLink } from '../types';
import { FileDetailsResponse } from '../services/graphService';

interface GraphState {
  astData: ASTNode | FlatGraph;
  setAstData: React.Dispatch<React.SetStateAction<ASTNode | FlatGraph>>;
  fileScopedNodes: GraphNode[];
  setFileScopedNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
  fileScopedLinks: GraphLink[];
  setFileScopedLinks: React.Dispatch<React.SetStateAction<GraphLink[]>>;
  expandedFileIds: Set<string>;
  setExpandedFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  fileDetailsCache: Map<string, FileDetailsResponse>;
  setFileDetailsCache: React.Dispatch<React.SetStateAction<Map<string, FileDetailsResponse>>>;
  expandingFileId: string | null;
  setExpandingFileId: React.Dispatch<React.SetStateAction<string | null>>;
  highlightedNodeId: string | null;
  setHighlightedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedNode: GraphNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<GraphNode | null>>;
  hydratingNodeId: string | null;
  setHydratingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  symbolCache: Map<string, GraphNode>;
  setSymbolCache: React.Dispatch<React.SetStateAction<Map<string, GraphNode>>>;
}

const GraphContext = createContext<GraphState | null>(null);

export const useGraphContext = () => {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error('useGraphContext must be used within GraphProvider');
  return ctx;
};

export const GraphProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const SAMPLE_DATA: FlatGraph = { nodes: [], links: [] };

  const [astData, setAstData] = useState<ASTNode | FlatGraph>(() => {
    try {
      const saved = sessionStorage.getItem('gca_ast_data');
      return saved ? JSON.parse(saved) : SAMPLE_DATA;
    } catch { return SAMPLE_DATA; }
  });
  const [fileScopedNodes, setFileScopedNodes] = useState<GraphNode[]>([]);
  const [fileScopedLinks, setFileScopedLinks] = useState<GraphLink[]>([]);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [fileDetailsCache, setFileDetailsCache] = useState<Map<string, FileDetailsResponse>>(new Map());
  const [expandingFileId, setExpandingFileId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hydratingNodeId, setHydratingNodeId] = useState<string | null>(null);
  const [symbolCache, setSymbolCache] = useState<Map<string, GraphNode>>(new Map());

  return (
    <GraphContext.Provider value={{
      astData, setAstData,
      fileScopedNodes, setFileScopedNodes,
      fileScopedLinks, setFileScopedLinks,
      expandedFileIds, setExpandedFileIds,
      fileDetailsCache, setFileDetailsCache,
      expandingFileId, setExpandingFileId,
      highlightedNodeId, setHighlightedNodeId,
      selectedNode, setSelectedNode,
      hydratingNodeId, setHydratingNodeId,
      symbolCache, setSymbolCache,
    }}>
      {children}
    </GraphContext.Provider>
  );
};