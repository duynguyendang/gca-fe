/**
 * useInsights - Hook for AI insight generation
 * Extracted from App.tsx generateInsights function
 */
import { useCallback } from 'react';
import { fetchSource } from '../services/graphService';
import { getGeminiInsight, getFileRoleSummary } from '../services/geminiService';
import { FlatGraph } from '../types';
import { useAppContext } from '../context/AppContext';

export const useInsights = () => {
    const {
        dataApiBase,
        selectedProjectId,
        selectedNode,
        astData,
        fileScopedNodes,
        fileScopedLinks,
        setNodeInsight,
        setIsInsightLoading
    } = useAppContext();

    const generateInsights = useCallback(() => {
        if (!selectedNode) return;

        setIsInsightLoading(true);

        // Multi-file analysis: If we have multiple files in view
        const uniqueFiles = new Set<string>();
        fileScopedNodes.forEach(n => {
            const path = n._filePath || n.filePath || (n.kind === 'file' ? n.id : null);
            if (path) uniqueFiles.add(path);
        });

        // Ensure the selected node's file is included
        const selectedFile = selectedNode._filePath || selectedNode.filePath || (selectedNode._isFile ? selectedNode.id : null);
        if (selectedFile) uniqueFiles.add(selectedFile);

        if (uniqueFiles.size > 1) {
            console.log("Generating Multi-File Insight for:", Array.from(uniqueFiles));
            const fileList = Array.from(uniqueFiles);
            // Use the new multi-file service
            import('../services/geminiService').then(({ getMultiFileInsight }) => {
                getMultiFileInsight(fileList, `Analyze the architectural relationship between ${selectedNode.name} and the other visible files.`, dataApiBase, selectedProjectId)
                    .then(summary => setNodeInsight(summary))
                    .catch(err => {
                        console.error("Multi-file insight failed:", err);
                        setNodeInsight("Analysis failed.");
                    })
                    .finally(() => setIsInsightLoading(false));
            });
            return;
        }

        // If it's a file with scoped nodes (backbone), use architectural summary
        if (selectedNode?._isFile && fileScopedNodes.length > 0) {
            fetchSource(dataApiBase, selectedProjectId, selectedNode.id).then(fileContent => {
                // Compute Relational Context from fileScopedLinks
                const neighbors = {
                    callers: [] as string[],
                    dependencies: [] as string[]
                };

                const currentId = selectedNode.id;

                fileScopedLinks.forEach(link => {
                    const s = typeof link.source === 'object' ? link.source.id : link.source;
                    const t = typeof link.target === 'object' ? link.target.id : link.target;
                    const sName = typeof link.source === 'object' ? link.source.name : link.source.split('/').pop();
                    const tName = typeof link.target === 'object' ? link.target.name : link.target.split('/').pop();

                    if (t === currentId && s !== currentId) {
                        neighbors.callers.push(`[${sName}](${s})`);
                    }
                    if (s === currentId && t !== currentId) {
                        neighbors.dependencies.push(`[${tName}](${t})`);
                    }
                });

                // Deduplicate
                neighbors.callers = Array.from(new Set(neighbors.callers));
                neighbors.dependencies = Array.from(new Set(neighbors.dependencies));

                return getFileRoleSummary(selectedNode.name, fileContent, neighbors, dataApiBase, selectedProjectId);
            }).then(summary => {
                setNodeInsight(summary);
            }).catch(err => {
                console.error("Architectural Insight Failed:", err);
                setNodeInsight("Analysis failed or source unavailable.");
            }).finally(() => {
                setIsInsightLoading(false);
            });
            return;
        }

        // Default symbol insight with Graph Context
        const links = (astData && 'links' in astData) ? (astData as FlatGraph).links : [];

        const inbound = links
            .filter(l => {
                const target = l.target;
                if (!target) return false;
                const targetId = typeof target === 'object' ? (target as any).id : target;
                return targetId === selectedNode.id;
            })
            .map(l => ({
                id: (l.source && typeof l.source === 'object' ? (l.source as any).id : l.source),
                rel: l.relation || 'calls'
            }));

        const outbound = links
            .filter(l => {
                const source = l.source;
                if (!source) return false;
                const sourceId = typeof source === 'object' ? (source as any).id : source;
                return sourceId === selectedNode.id;
            })
            .map(l => ({
                id: (l.target && typeof l.target === 'object' ? (l.target as any).id : l.target),
                rel: l.relation || 'calls'
            }));

        const context = { inbound, outbound };

        getGeminiInsight(selectedNode, context, dataApiBase, selectedProjectId).then(i => {
            setNodeInsight(i);
            setIsInsightLoading(false);
        }).catch(() => {
            setIsInsightLoading(false);
            setNodeInsight("Analysis connection failed.");
        });
    }, [selectedNode, fileScopedNodes, fileScopedLinks, astData, dataApiBase, selectedProjectId, setNodeInsight, setIsInsightLoading]);

    const clearInsight = useCallback(() => {
        setNodeInsight(null);
    }, [setNodeInsight]);

    return {
        generateInsights,
        clearInsight,
    };
};

export default useInsights;
