import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchSource, fetchSummary, fetchFiles } from '../services/graphService';
import { detectLanguage } from '../utils/languageUtils';
import { GraphNode } from '../types';

interface ContextNode {
  id: string;
  name: string;
  kind: string;
  code: string;
  filePath: string;
  start_line?: number;
  end_line?: number;
  language?: string;
  _isFullFile?: boolean;
}

const getNodeProp = (node: GraphNode, key: string, fallback: string = ''): string => {
  const val = (node as any)[key];
  return typeof val === 'string' ? val : fallback;
};

const runWithConcurrencyLimit = async <T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> => {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = task().then(result => {
      results[i] = result;
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing.filter(Boolean));
      executing.splice(executing.findIndex(Boolean), 1);
    }
  }

  await Promise.all(executing);
  return results;
};

export const useQueryContext = () => {
  const {
    selectedNode,
    fileScopedNodes,
    astData,
    dataApiBase,
    selectedProjectId,
    currentProject,
    viewMode,
    narrativeMessages,
    sandboxFiles,
  } = useAppContext();

  const buildContext = useCallback(async (userQuery?: string): Promise<{ enhancedQuery: string; contextData: ContextNode[] }> => {
    const contextData: ContextNode[] = [];
    const contextParts: string[] = [];

    if (currentProject) {
      contextParts.push(`[Project: ${currentProject}]`);
    }

    // Include full project file list when query is about project structure
    const queryLower = (userQuery || '').toLowerCase();
    const isProjectStructureQuery = queryLower.includes('all test') ||
      queryLower.includes('test file') ||
      queryLower.includes('list all') ||
      queryLower.includes('project structure') ||
      queryLower.includes('file list') ||
      queryLower.includes('all file') ||
      queryLower.includes('find all') ||
      queryLower.includes('how many file');

    if (isProjectStructureQuery && dataApiBase && selectedProjectId) {
      try {
        const files = await fetchFiles(dataApiBase, selectedProjectId);
        const fileList = Array.isArray(files) ? files : [];
        contextParts.push(`[Project has ${fileList.length} files]`);
        if (fileList.length > 0 && fileList.length <= 500) {
          contextParts.push(`[All files: ${fileList.join(', ')}]`);
        } else if (fileList.length > 500) {
          contextParts.push(`[First 100 files: ${fileList.slice(0, 100).join(', ')}]`);
        }
      } catch (e) {
        // Use sandbox files as fallback
        const sandboxFileList = Array.isArray(sandboxFiles['files.json']) ? sandboxFiles['files.json'] : [];
        if (sandboxFileList.length > 0) {
          contextParts.push(`[Project has ${sandboxFileList.length} files]`);
          contextParts.push(`[Files: ${sandboxFileList.join(', ')}]`);
        }
      }
    }

    if (selectedNode) {
      const nodeId = getNodeProp(selectedNode, 'id');
      const nodeFilePath = getNodeProp(selectedNode, '_filePath') || getNodeProp(selectedNode, 'filePath') || nodeId;
      let nodeCode = getNodeProp(selectedNode, 'code');

      if ((!nodeCode || nodeCode.trim() === '') && nodeId && dataApiBase && selectedProjectId) {
        try {
          nodeCode = await fetchSource(dataApiBase, selectedProjectId, nodeFilePath) || '';
        } catch (e) {
          // Silently continue without code
        }
      }

      const startLine = typeof selectedNode.start_line === 'number' ? selectedNode.start_line : 1;
      const endLine = typeof selectedNode.end_line === 'number' ? selectedNode.end_line : 100;

      contextData.push({
        id: nodeId,
        name: getNodeProp(selectedNode, 'name'),
        kind: getNodeProp(selectedNode, 'kind') || getNodeProp(selectedNode, 'type') || 'unknown',
        code: nodeCode,
        filePath: nodeFilePath,
        start_line: startLine,
        end_line: endLine,
        language: getNodeProp(selectedNode, 'language') || detectLanguage(nodeFilePath),
        _isFullFile: true,
      });

      contextParts.push(`Selected: ${getNodeProp(selectedNode, 'name')} (${getNodeProp(selectedNode, 'kind') || getNodeProp(selectedNode, 'type')})`);
    }

    if (fileScopedNodes && fileScopedNodes.length > 0) {
      const relevantNodes = fileScopedNodes.slice(0, 20);
      const fetchTasks: (() => Promise<void>)[] = [];

      for (const node of relevantNodes) {
        const nodeId = getNodeProp(node, 'id');
        if (nodeId !== selectedNode?.id && contextData.length < 40) {
          const nodeFilePath = getNodeProp(node, '_filePath') || getNodeProp(node, 'filePath') || nodeId;
          let nodeCode = getNodeProp(node, 'code');

          if ((!nodeCode || nodeCode.trim() === '') && nodeId && dataApiBase && selectedProjectId) {
            fetchTasks.push(
              () => fetchSource(dataApiBase, selectedProjectId, nodeFilePath)
                .then(code => {
                  if (code) nodeCode = code;
                })
                .catch(() => {})
            );
          }

          contextData.push({
            id: nodeId,
            name: getNodeProp(node, 'name') || nodeId,
            kind: getNodeProp(node, 'kind') || getNodeProp(node, 'type') || 'unknown',
            code: nodeCode,
            filePath: nodeFilePath,
            language: getNodeProp(node, 'language') || detectLanguage(nodeFilePath),
            _isFullFile: true,
          });
        }
      }

      if (fetchTasks.length > 0) {
        await runWithConcurrencyLimit(fetchTasks, 5);
      }

      contextParts.push(`Viewing ${fileScopedNodes.length} elements in ${viewMode} mode`);
    }

    if (contextData.length === 0 && astData && 'nodes' in astData) {
      const totalNodes = (astData.nodes as any[]).length;
      contextParts.push(`Project contains ${totalNodes} analyzed elements`);

      const sampleNodes = (astData.nodes as any[]).slice(0, 5);
      for (const node of sampleNodes) {
        if (contextData.length < 10) {
          contextData.push({
            id: String(node.id || ''),
            name: String(node.name || node.id || ''),
            kind: String(node.kind || node.type || 'unknown'),
            code: String(node.code || ''),
            filePath: String(node._filePath || node.filePath || node.id || ''),
            language: String(node.language || detectLanguage(String(node._filePath || node.id || ''))),
          });
        }
      }
    }

    if (dataApiBase && selectedProjectId) {
      try {
        const freshSummary = await fetchSummary(dataApiBase, selectedProjectId);
        if (freshSummary?.top_symbols) {
          const existingIds = new Set(contextData.map(n => n.id));
          const selectedNodeId = selectedNode?.id;

          for (const symbol of freshSummary.top_symbols.slice(0, 10)) {
            if (symbol.id !== selectedNodeId && !existingIds.has(symbol.id) && contextData.length < 50) {
              let symbolCode = symbol.code || '';

              if ((!symbolCode || symbolCode.trim() === '') && symbol.id) {
                try {
                  symbolCode = await fetchSource(dataApiBase, selectedProjectId, symbol.id) || '';
                } catch (e) {
                  // Continue without code
                }
              }

              contextData.push({
                id: symbol.id,
                name: symbol.name,
                kind: symbol.kind || symbol.type || 'unknown',
                code: symbolCode,
                filePath: symbol._filePath || symbol.filePath || symbol.id,
                _isFullFile: true,
              });
            }
          }
        }
      } catch (e) {
        // Summary fetch failed, continue without it
      }
    }

    if (narrativeMessages.length > 0) {
      contextParts.push(`[Continuing conversation - ${narrativeMessages.length} messages]`);
    }

    let enhancedQuery = contextParts.join('\n');
    const MAX_QUERY_LENGTH = 8000;
    if (enhancedQuery.length > MAX_QUERY_LENGTH) {
      enhancedQuery = enhancedQuery.substring(0, MAX_QUERY_LENGTH) + '\n...[shortened]';
    }

    for (const node of contextData) {
      if (node.code && node.code.length > 2000) {
        node.code = node.code.substring(0, 2000) + '\n...[shortened]';
      }
    }

    return {
      enhancedQuery,
      contextData,
    };
  }, [selectedNode, fileScopedNodes, astData, dataApiBase, selectedProjectId, currentProject, viewMode, narrativeMessages, sandboxFiles]);

  return { buildContext };
};
