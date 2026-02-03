/**
 * useSmartSearch - Hook for semantic search functionality
 * Extracted from App.tsx handleSmartSearch (~250 lines)
 */
import { useCallback, useState } from 'react';
import { useManifest } from './useManifest';
import {
    executeQuery,
    fetchSymbols,
    fetchSource,
    fetchGraphPath
} from '../services/graphService';
import {
    resolveSymbolFromQuery,
    translateNLToDatalog,
    generateReactiveNarrative,
    analyzePathWithCode
} from '../services/geminiService';

interface UseSmartSearchOptions {
    dataApiBase: string;
    selectedProjectId: string;

    availablePredicates: string[];
    manifest: any;
    onViewModeChange: (mode: 'discovery' | 'flow' | 'architecture') => void;
    setFileScopedNodes: (nodes: any[]) => void;
    setFileScopedLinks: (links: any[]) => void;
    setSelectedNode: (node: any) => void;
    setNodeInsight: (insight: string | null) => void;
    setLastExecutedQuery: (query: string) => void;
}

interface SearchState {
    isSearching: boolean;
    searchError: string | null;
    searchStatus: string | null;
    queryResults: any;
}

export const useSmartSearch = (options: UseSmartSearchOptions) => {
    const {
        dataApiBase,
        selectedProjectId,

        availablePredicates,
        manifest,
        onViewModeChange,
        setFileScopedNodes,
        setFileScopedLinks,
        setSelectedNode,
        setNodeInsight,
        setLastExecutedQuery,
    } = options;

    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<string | null>(null);
    const [queryResults, setQueryResults] = useState<any>(null);

    const handleSmartSearch = useCallback(async (query: string) => {
        console.log('=== handleSmartSearch called ===', query);
        setSearchError(null);
        setIsSearching(true);
        setQueryResults(null);
        setNodeInsight(null);
        setSearchStatus("Analyzing query...");

        if (!dataApiBase || !selectedProjectId || !query || query.length < 1) {
            setIsSearching(false);
            setSearchStatus(null);
            return;
        }

        try {
            // 0. Ultra-Fast-Path: Simple "what is X?" queries
            const whatIsMatch = query.match(/^what\s+is\s+(\w+)\??$/i);
            if (whatIsMatch) {
                const symbolName = whatIsMatch[1];
                console.log('[Ultra-Fast-Path] Detected simple lookup:', symbolName);
                setSearchStatus(`Looking up ${symbolName}...`);

                const symbols = await fetchSymbols(dataApiBase, selectedProjectId, symbolName);
                if (symbols.length > 0) {
                    // Found it! Just select the symbol and show it
                    const symbolId = symbols[0];
                    console.log('[Ultra-Fast-Path] Found symbol:', symbolId);
                    setSelectedNode({ id: symbolId });
                    setNodeInsight(`Found symbol: ${symbolName}`);
                    setSearchStatus(null);
                    setIsSearching(false);
                    return;
                }
            }

            // 1. Fast-Path: Check Manifest for Exact Match
            if (manifest && manifest.S && manifest.F) {
                const exactMatchId = manifest.S[query.trim()];
                if (exactMatchId) {
                    console.log('[Fast-Path] Found exact match in manifest:', query, '->', exactMatchId);
                    setSearchStatus("Fast-path found...");

                    const fileId = exactMatchId.toString();
                    const filePath = manifest.F[fileId];

                    if (filePath) {
                        const putativeSymbolId = `${filePath}:${query.trim()}`;
                        console.log('[Fast-Path] Inferring Symbol ID:', putativeSymbolId);

                        const fastDatalog = `triples(?s, "calls", "${putativeSymbolId}"), triples("${putativeSymbolId}", "calls", ?o), triples("${putativeSymbolId}", "defines", ?d)`;
                        console.log('[Fast-Path] Generated Datalog:', fastDatalog);

                        setSearchStatus("Executing fast query...");
                        const result = await executeQuery(dataApiBase, selectedProjectId, fastDatalog);

                        if (result && result.nodes.length > 0) {
                            setQueryResults(result);
                            setIsSearching(false);
                            setSearchStatus(null);
                            setNodeInsight(null);
                            const targetNode = result.nodes.find((n: any) => n.id === putativeSymbolId) || result.nodes[0];
                            if (targetNode) {
                                setSelectedNode(targetNode);
                            }
                            return;
                        }
                    }
                }
            }

            // Skip symbol search/resolution - causes 40-50s delays
            // Most queries are semantic ("which X does Y"), not specific ("what does foo() do")
            // Datalog generation handles semantic queries better without a pre-selected symbol

            // Translate directly to Datalog (with project-specific predicates)
            setSearchStatus("Translating to Datalog...");
            const datalogQuery = await translateNLToDatalog(query, null, dataApiBase, selectedProjectId, availablePredicates);
            console.log('Generated Datalog:', datalogQuery);

            if (!datalogQuery) {
                setSearchError("Could not translate query to Datalog.");
                setSearchStatus(null);
                setIsSearching(false);
                return;
            }

            // Handle Tool Calls (Path-Finding)
            if (datalogQuery.trim().startsWith('{')) {
                try {
                    const toolCall = JSON.parse(datalogQuery);
                    if (toolCall.tool === 'find_connection') {
                        console.log('[Path-Finding] Tool call detected:', toolCall);

                        // Resolve symbol names to full IDs
                        setSearchStatus("Resolving symbols for path...");
                        const sourceSymbols = await fetchSymbols(dataApiBase, selectedProjectId, toolCall.source_id);
                        const targetSymbols = await fetchSymbols(dataApiBase, selectedProjectId, toolCall.target_id);

                        if (sourceSymbols.length === 0) {
                            setSearchError(`Symbol not found: ${toolCall.source_id}`);
                            setSearchStatus(null);
                            setIsSearching(false);
                            return;
                        }

                        if (targetSymbols.length === 0) {
                            setSearchError(`Symbol not found: ${toolCall.target_id}`);
                            setSearchStatus(null);
                            setIsSearching(false);
                            return;
                        }

                        const sourceId = sourceSymbols[0];
                        const targetId = targetSymbols[0];

                        console.log('[Path-Finding] Resolved:', { sourceId, targetId });
                        setSearchStatus(`Tracing path from ${sourceId} to ${targetId}...`);

                        const pathGraph = await fetchGraphPath(dataApiBase, selectedProjectId, sourceId, targetId);

                        if (!pathGraph || !pathGraph.nodes || pathGraph.nodes.length === 0) {
                            setSearchStatus(null);
                            setSearchError("No path found between these symbols.");
                            setIsSearching(false);
                            return;
                        }

                        setFileScopedNodes(pathGraph.nodes.map((n: any) => ({
                            ...n,
                            name: n.name || n.id.split('/').pop(),
                            kind: n.kind || 'unknown',
                            _isPath: true
                        })));
                        setFileScopedLinks(pathGraph.links.map((l: any) => ({
                            ...l,
                            _isPath: true
                        })));

                        onViewModeChange('discovery');

                        setSearchStatus("Analyzing interaction path with AI...");
                        try {
                            const analysis = await analyzePathWithCode(pathGraph, query, dataApiBase, selectedProjectId);
                            setNodeInsight(analysis);
                        } catch (err) {
                            console.error("Path analysis failed:", err);
                            setNodeInsight(`Found interaction path with ${pathGraph.nodes.length} steps.\n\n*AI analysis unavailable*`);
                        }

                        setSearchStatus(null);
                        setIsSearching(false);
                        return;
                    }
                } catch (e) {
                    console.warn("Failed to parse tool call JSON:", e, "Query:", datalogQuery);
                    // Fall through to execute as Datalog
                }
            }

            // 4. Execute Query
            setSearchStatus("Executing Datalog query...");
            setLastExecutedQuery(datalogQuery); // Store for clustering
            const results = await executeQuery(dataApiBase, selectedProjectId, datalogQuery, true);
            console.log('Query Results:', results);

            if (!results || !results.nodes || results.nodes.length === 0) {
                setSearchError('No results found for this query');
                setSearchStatus(null);
                setIsSearching(false);
                return;
            }

            let finalNodes = results.nodes;
            let finalLinks = results.links || [];

            // Set results directly (Backend auto-clusters if needed)
            setFileScopedNodes(finalNodes.map((n: any) => ({
                ...n,
                name: n.name || n.id.split('/').pop(),
                kind: n.kind || 'struct'
            })));
            setFileScopedLinks(finalLinks);

            console.log('[DEBUG] Transitioning to Discovery view for search results');
            onViewModeChange('discovery');

            // Analyze results with AI using actual graph data
            setSearchStatus("Analyzing results with AI...");
            try {
                const { askAI } = await import('../services/geminiService');
                const analysis = await askAI(dataApiBase, selectedProjectId, {
                    task: 'smart_search_analysis',
                    query: query,
                    data: {
                        nodes: results.nodes.map((n: any) => ({ id: n.id, name: n.name, kind: n.kind, type: n.type })),
                        links: results.links || []
                    }
                });
                setNodeInsight(analysis || `Found ${results.nodes.length} nodes and ${results.links?.length || 0} relationships.`);
            } catch (aiErr) {
                console.error("AI analysis failed:", aiErr);
                setNodeInsight(`Found ${results.nodes.length} nodes and ${results.links?.length || 0} relationships.`);
            }

            setSearchStatus(null);
            setIsSearching(false);

        } catch (err: any) {
            console.error("Smart Search Error:", err);
            setSearchError(err.message || 'Search failed');
            setNodeInsight("Search failed.");
            setSearchStatus(null);
            setIsSearching(false);
        }
    }, [dataApiBase, selectedProjectId, availablePredicates, manifest, onViewModeChange, setFileScopedNodes, setFileScopedLinks, setSelectedNode, setNodeInsight, setLastExecutedQuery]);

    return {
        handleSmartSearch,
        isSearching,
        searchError,
        searchStatus,
        queryResults,
        setSearchError,
        setSearchStatus,
        setQueryResults,
    };
};

export default useSmartSearch;
