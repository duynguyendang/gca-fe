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
    } = useAppContext();

    const syncDataFromApi = useCallback(async (
        baseUrl: string,
        projectId?: string,
        onComplete?: () => void
    ) => {
        if (!baseUrl) return;
        setIsDataSyncing(true);
        setSyncError(null);
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
                        setAstData(prev => {
                            // Only enrich existing file nodes, discard unknown nodes (packages/external)
                            // This keeps the graph focused on the file list we already fetched
                            const enrichedNodes = prev.nodes.map(node => {
                                const enrichedNode = ast.nodes.find((n: any) => n.id === node.id || n.id === node._filePath);
                                return enrichedNode ? { ...node, ...enrichedNode, _project: projectId } : { ...node, _project: projectId };
                            });
                            return { nodes: enrichedNodes, links: ast.links || prev.links };
                        });
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
