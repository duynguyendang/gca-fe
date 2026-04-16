/**
 * useNodeHydration - Hook for hydrating individual nodes
 * Extracted from App.tsx hydrateNode function
 */
import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { FlatGraph } from '../types';
import { logger } from '../src/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { requestManager } from '../utils/requestManager';

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

    // Track the current hydration request to handle race conditions
    const hydrationRequestRef = useRef<string | null>(null);

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
            logger.log('[Hydrate] Cache hit for:', nodeId);
            return symbolCache.get(nodeId);
        }

        // Check if node already has code
        const existingNode = (astData as FlatGraph)?.nodes?.find((n: any) => n.id === nodeId);
        if (existingNode?.code) {
            logger.log('[Hydrate] Node already has code:', nodeId);
            setSymbolCache(prev => new Map(prev).set(nodeId, existingNode));
            return existingNode;
        }

        if (!dataApiBase || !selectedProjectId) {
            console.warn('[Hydrate] Missing dataApiBase or selectedProjectId');
            return null;
        }

        // Cancel any in-flight hydration request
        if (hydrationRequestRef.current) {
            requestManager.cancelRequest(hydrationRequestRef.current);
        }

        const requestId = `hydrate-${nodeId}-${Date.now()}`;
        hydrationRequestRef.current = requestId;

        logger.log('[Hydrate] Fetching node from API:', nodeId);
        setHydratingNodeId(nodeId);

        let targetId = nodeId;
        // Optimization: Check for Python dotted paths that need resolution
        if (nodeId && !nodeId.includes('/') && nodeId.includes('.')) {
            try {
                const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
                const controller = requestManager.startRequest(`${requestId}-pathResolution`);
                // Fetch file list to resolve path - minimal overhead for single click
                const filesResp = await fetchWithTimeout(
                    `${cleanBase}/api/v1/files?project=${encodeURIComponent(selectedProjectId)}`,
                    {},
                    5000, // Short timeout for path resolution
                    controller.signal
                );
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
                        logger.log('[Hydrate] Resolved dotted ID', nodeId, 'to file', targetId);
                    }
                }
            } catch (e) {
                // Ignore abort errors
                if ((e as Error).name !== 'AbortError') {
                    console.warn('[Hydrate] Path resolution failed', e);
                }
            }
        }

        try {
            const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
            const controller = requestManager.startRequest(requestId);
            const response = await fetchWithTimeout(
                `${cleanBase}/api/v1/hydrate?id=${encodeURIComponent(targetId)}&project=${encodeURIComponent(selectedProjectId)}`,
                {},
                30000,
                controller.signal
            );

            // Check if this request is still valid (not stale)
            if (hydrationRequestRef.current !== requestId) {
                logger.log('[Hydrate] Stale response discarded for:', nodeId);
                return null;
            }

            if (!response.ok) {
                console.error('[Hydrate] Failed to hydrate node:', response.status, response.statusText);
                return null;
            }

            const hydratedNode = await response.json();
            logger.log('[Hydrate] Successfully hydrated node:', hydratedNode);

            // Update cache
            setSymbolCache(prev => new Map(prev).set(nodeId, hydratedNode));

            // Update astData with the hydrated node
            setAstData(prev => {
                if (!prev || !('nodes' in prev)) return prev;
                return {
                    ...prev,
                    nodes: (prev.nodes as any[]).map(n =>
                        n.id === nodeId ? { ...n, ...hydratedNode } : n
                    )
                };
            });

            return hydratedNode;
        } catch (error) {
            // Ignore AbortError - expected when request is cancelled
            if ((error as Error).name === 'AbortError' || (error as Error).message?.includes('aborted')) {
                logger.log('[Hydrate] Request cancelled for:', nodeId);
            } else {
                console.error('[Hydrate] Error hydrating node:', error);
            }
            return null;
        } finally {
            if (hydrationRequestRef.current === requestId) {
                hydrationRequestRef.current = null;
            }
            setHydratingNodeId(null);
        }
    }, [dataApiBase, selectedProjectId, astData, symbolCache, setHydratingNodeId, setSymbolCache, setAstData]);

    return { hydrateNode };
};

export default useNodeHydration;
