/**
 * useApiSync - Hook for syncing data from API
 * Extracted from App.tsx syncDataFromApi function
 */
import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

export const useApiSync = () => {
    const {
        setIsDataSyncing,
        setSyncError,
        setAvailableProjects,
        setSelectedProjectId,
        setCurrentProject,
        setSandboxFiles,
        setAstData,
        setFileScopedNodes,
        setFileScopedLinks,
        setViewMode,
        enableAutoClustering,
    } = useAppContext();

    const syncDataFromApi = useCallback(async (
        baseUrl: string,
        projectId?: string,
        onComplete?: () => void
    ) => {
        if (!baseUrl) return;
        setIsDataSyncing(true);
        setSyncError(null);
        // Reset View Mode to default (Discovery) initially, UNLESS we are already in a specific mode?
        // Actually best to leave it, but we might want to ensure we don't get stuck in Flow mode on project switch.
        // For now, let's just handle the "Explosion" case.

        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        try {
            // Fetch all projects
            const projectsRes = await fetch(`${cleanBase}/v1/projects`);
            if (!projectsRes.ok) {
                setSyncError('Failed to fetch projects');
                setIsDataSyncing(false);
                return;
            }

            const projects = await projectsRes.json() as Array<{ id: string; name: string; description?: string }>;
            setAvailableProjects(projects);

            // Require project selection
            if (!projectId && projects.length > 0) {
                projectId = projects[0].id;
                setSelectedProjectId(projectId);
            }

            if (!projectId) {
                setSyncError('No projects available');
                setIsDataSyncing(false);
                return;
            }

            setCurrentProject(projects.find(p => p.id === projectId)?.name || projectId);

            // Fetch files for the project
            const filesUrl = `${cleanBase}/v1/files?project=${encodeURIComponent(projectId)}`;
            const filesRes = await fetch(filesUrl);
            if (!filesRes.ok) {
                setSyncError(`Failed to fetch files: ${filesRes.statusText}`);
                setIsDataSyncing(false);
                return;
            }

            const filesData = await filesRes.json();
            const filesList = Array.isArray(filesData) ? filesData : (filesData.files || []);
            setSandboxFiles(prev => ({ ...prev, 'files.json': filesList }));

            // Build AST from files list
            if (filesList.length > 0) {
                const astNodes: any[] = [];
                const astLinks: any[] = [];

                filesList.forEach((filePath: string) => {
                    const fileName = filePath.split('/').pop() || filePath;
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    const kind = ['py', 'ts', 'js', 'go', 'rs'].includes(ext || '') ? 'function' : 'file';

                    astNodes.push({
                        id: filePath,
                        name: fileName,
                        type: kind,
                        kind: kind,
                        start_line: 1,
                        end_line: 100,
                        code: '',
                        _filePath: filePath,
                        _project: projectId
                    });
                });

                // ENFORCE CLUSTERING FOR LARGE GRAPHS BEFORE SETTING DATA
                // If we have > 300 nodes, default to "Map" mode to prevent graph explosion
                if (astNodes.length > 300 && enableAutoClustering) {
                    console.warn(`[Performance] Node count ${astNodes.length} > 300. Forcing Map View.`);
                    setViewMode('map');
                }

                setAstData({ nodes: astNodes, links: astLinks });
            }

            // Fetch enriched AST from query endpoint
            try {
                // Change query to 'imports' to get file-to-file dependencies
                const queryRes = await fetch(`${cleanBase}/v1/query?project=${encodeURIComponent(projectId)}&hydrate=true`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'triples(?s, "imports", ?o)' })
                });

                if (queryRes.ok) {
                    const ast = await queryRes.json();
                    if (ast && ast.nodes && ast.nodes.length > 0) {
                        // If the response is clustered, use it for Graph View (fileScopedNodes)
                        // but KEEP the file list for Navigator (astData)
                        const isClustered = ast.nodes.some((n: any) => n.kind === 'cluster' || n.id.startsWith('cluster_'));

                        if (isClustered) {
                            console.log('[ApiSync] Received clustered graph. Updating Visualizer only.');
                            // Clustered graphs usually work best in Map or Architecture mode
                            setViewMode('map');
                            setFileScopedNodes(ast.nodes.map((n: any) => ({ ...n, _project: projectId })));
                            setFileScopedLinks(ast.links || []);
                            // Do NOT update astData (keep files for navigator)
                        } else {
                            // ENFORCE CLUSTERING if new enriched data is large
                            if (ast.nodes.length > 300 && enableAutoClustering) {
                                setViewMode('map');
                            }

                            // Otherwise, enrich existing file nodes (keep graph focused on file list)
                            setAstData(prev => {
                                const enrichedNodes = prev.nodes.map(node => {
                                    const enrichedNode = ast.nodes.find((n: any) => n.id === node.id || n.id === node._filePath);
                                    return enrichedNode ? { ...node, ...enrichedNode, _project: projectId } : { ...node, _project: projectId };
                                });
                                return { nodes: enrichedNodes, links: ast.links || prev.links };
                            });
                        }
                    }
                }
            } catch (queryErr) {
                console.log('Query endpoint not available, using file-based AST');
            }

            if (onComplete) onComplete();
        } catch (err: any) {
            console.error("API Sync Error:", err);
            setSyncError(err.message || 'Unknown error during sync');
        } finally {
            setIsDataSyncing(false);
        }
    }, [setIsDataSyncing, setSyncError, setAvailableProjects, setSelectedProjectId, setCurrentProject, setSandboxFiles, setAstData]);

    return { syncDataFromApi };
};

export default useApiSync;
