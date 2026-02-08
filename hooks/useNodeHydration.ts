/**
 * useNodeHydration - Hook for hydrating individual nodes
 * Extracted from App.tsx hydrateNode function
 */
import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { FlatGraph } from '../types';

export const useNodeHydration = () => {
    const {
        dataApiBase,
        selectedProjectId,
        setHydratingNodeId,
        symbolCache,
        setSymbolCache,
        astData,
        setAstData
    } = useAppContext();

    const hydrateNode = useCallback(async (nodeId: string): Promise<any | null> => {
        // Validate nodeId - skip obviously invalid IDs
        if (!nodeId ||
            nodeId.startsWith('//') ||
            nodeId.startsWith('/*') ||
            nodeId.includes('\n') ||
            nodeId.length > 200) {
            console.warn('[Hydrate] Skipping invalid nodeId:', nodeId?.substring(0, 50));
            return null;
        }

        // Check cache first
        if (symbolCache.has(nodeId)) {
            console.log('[Hydrate] Cache hit for:', nodeId);
            return symbolCache.get(nodeId);
        }

        // Check if node already has code
        const existingNode = (astData as FlatGraph)?.nodes?.find((n: any) => n.id === nodeId);
        if (existingNode?.code) {
            console.log('[Hydrate] Node already has code:', nodeId);
            setSymbolCache(prev => new Map(prev).set(nodeId, existingNode));
            return existingNode;
        }

        if (!dataApiBase || !selectedProjectId) {
            console.warn('[Hydrate] Missing dataApiBase or selectedProjectId');
            return null;
        }

        console.log('[Hydrate] Fetching node from API:', nodeId);
        setHydratingNodeId(nodeId);

        let targetId = nodeId;
        // Optimization: Check for Python dotted paths that need resolution
        if (nodeId && !nodeId.includes('/') && nodeId.includes('.')) {
            try {
                const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
                // Fetch file list to resolve path - minimal overhead for single click
                const filesResp = await fetch(`${cleanBase}/v1/files?project=${encodeURIComponent(selectedProjectId)}`);
                if (filesResp.ok) {
                    const allFiles = await filesResp.json();
                    const slashPath = nodeId.replace(/\./g, '/');
                    const suffixMatches = allFiles.filter((f: string) =>
                        f.endsWith(slashPath + '.py') ||
                        f.endsWith(slashPath + '/__init__.py')
                    );
                    if (suffixMatches.length > 0) {
                        suffixMatches.sort((a: string, b: string) => a.length - b.length);
                        targetId = suffixMatches[0];
                        console.log('[Hydrate] Resolved dotted ID', nodeId, 'to file', targetId);
                    }
                }
            } catch (e) {
                console.warn('[Hydrate] Path resolution failed', e);
            }
        }

        try {
            const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
            const response = await fetch(`${cleanBase}/v1/hydrate?id=${encodeURIComponent(targetId)}&project=${encodeURIComponent(selectedProjectId)}`);

            if (!response.ok) {
                console.error('[Hydrate] Failed to hydrate node:', response.status, response.statusText);
                return null;
            }

            const hydratedNode = await response.json();
            console.log('[Hydrate] Successfully hydrated node:', hydratedNode);

            // Update cache
            setSymbolCache(prev => new Map(prev).set(nodeId, hydratedNode));

            // Update astData with the hydrated node
            setAstData(prev => {
                if (!prev || !('nodes' in prev)) return prev;
                return {
                    ...prev,
                    nodes: prev.nodes.map(n =>
                        n.id === nodeId ? { ...n, ...hydratedNode } : n
                    )
                };
            });

            return hydratedNode;
        } catch (error) {
            console.error('[Hydrate] Error hydrating node:', error);
            return null;
        } finally {
            setHydratingNodeId(null);
        }
    }, [dataApiBase, selectedProjectId, astData, symbolCache, setHydratingNodeId, setSymbolCache, setAstData]);

    return { hydrateNode };
};

export default useNodeHydration;
