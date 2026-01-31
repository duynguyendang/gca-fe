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
            // 0. Fast-Path: Check Manifest for Exact Match
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

            // 1. Extract Keywords & Search
            const stopWords = new Set(['what', 'is', 'the', 'how', 'does', 'where', 'are', 'in', 'of', 'for', 'to', 'a', 'an', 'who', 'calls', 'call', 'called', 'by', 'show', 'me', 'find', 'get', 'all']);
            const tokens = query.toLowerCase().replace(/[?.,!'"]/g, ' ').split(/\s+/).filter(t => !stopWords.has(t) && t.length > 2);

            let symbols: string[] = [];

            if (!query.includes(' ') && query.length < 50) {
                symbols = await fetchSymbols(dataApiBase, selectedProjectId, query);
            } else if (tokens.length > 0) {
                const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
                for (const token of sortedTokens.slice(0, 3)) {
                    console.log('Searching keyword:', token);
                    const found = await fetchSymbols(dataApiBase, selectedProjectId, token);
                    if (found.length > 0) {
                        symbols = found;
                        break;
                    }
                }
            }

            // 2. Resolve Subject ID
            let subjectId: string | null = null;
            if (symbols.length > 0) {
                setSearchStatus("Resolving subject symbol...");
                subjectId = await resolveSymbolFromQuery(query, symbols, dataApiBase, selectedProjectId);
                if (!subjectId && symbols.length === 1) subjectId = symbols[0];
                console.log('Resolved Subject ID:', subjectId);
            }

            // 3. Translate to Datalog
            setSearchStatus("Translating to Datalog...");
            const datalogQuery = await translateNLToDatalog(query, subjectId, dataApiBase, selectedProjectId);
            console.log('Generated Datalog:', datalogQuery);

            if (!datalogQuery) {
                setSearchError("Could not translate query to Datalog.");
                setSearchStatus(null);
                setIsSearching(false);
                return;
            }

            // Handle Tool Calls (Discovery Mode)
            if (datalogQuery.trim().startsWith('{')) {
                try {
                    const toolCall = JSON.parse(datalogQuery);
                    if (toolCall.tool === 'find_connection') {
                        console.log('[App] Executing Tool Call:', toolCall);
                        setSearchStatus(`Tracing path from ${toolCall.source_id} to ${toolCall.target_id}...`);

                        const pathGraph = await fetchGraphPath(dataApiBase, selectedProjectId, toolCall.source_id, toolCall.target_id);

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
                    console.warn("Failed to parse tool call JSON:", e);
                }
            }

            // 4. Execute Query
            setSearchStatus("Executing Datalog query...");
            const results = await executeQuery(dataApiBase, selectedProjectId, datalogQuery, true);
            console.log('Query Results:', results);

            if (!results || !results.nodes || results.nodes.length === 0) {
                setSearchError("No result found.");
                setNodeInsight("Query returned no facts.");
                setSearchStatus(null);
                setIsSearching(false);
                return;
            }

            // 5. Render Results Immediately (no AI explanation)
            setFileScopedNodes(results.nodes.map((n: any) => ({
                ...n,
                name: n.name || n.id.split('/').pop(),
                kind: n.kind || 'struct'
            })));
            setFileScopedLinks(results.links || []);

            console.log('[DEBUG] Transitioning to Discovery view for search results');
            onViewModeChange('discovery');

            // Show basic summary instead of AI-generated explanation
            setNodeInsight(`Found ${results.nodes.length} nodes and ${results.links?.length || 0} relationships.`);
            setSearchStatus(null);
            setIsSearching(false);

        } catch (err: any) {
            console.error("Smart Search Error:", err);
            setSearchError(err.message || 'Search failed');
            setNodeInsight("Search failed.");
            setSearchStatus(null);
            setIsSearching(false);
        }
    }, [dataApiBase, selectedProjectId, availablePredicates, manifest, onViewModeChange, setFileScopedNodes, setFileScopedLinks, setSelectedNode, setNodeInsight]);

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
