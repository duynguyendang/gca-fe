import { useCallback } from 'react';
import { useGraphContext } from '../context/GraphContext';
import { useSettingsContext } from '../context/SettingsContext';
import { fetchSource, fetchSummary } from '../services/graphService';
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
  const running = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;
    const p = task().then(result => {
      results[i] = result;
    });
    running.add(p);
    p.finally(() => running.delete(p));

    if (running.size >= limit) {
      await Promise.race(running);
    }
  }

  await Promise.all(running);
  return results;
};

export const useQueryContext = () => {
  const { selectedNode, fileScopedNodes, astData } = useGraphContext();
  const { dataApiBase, selectedProjectId } = useSettingsContext();

  const buildContext = useCallback(async (userQuery?: string): Promise<{ contextData: ContextNode[]; symbolId: string }> => {
    const contextData: ContextNode[] = [];
    const symbolId = selectedNode ? (getNodeProp(selectedNode, 'id') || '') : '';

    // File-scoped sibling nodes (backend can't know which ones the user is viewing)
    if (fileScopedNodes && fileScopedNodes.length > 0) {
      const relevantNodes = fileScopedNodes.slice(0, 20);
      const fetchTasks: (() => Promise<void>)[] = [];

      for (const node of relevantNodes) {
        const nodeId = getNodeProp(node, 'id');
        // Exclude selected node — backend handles it via symbol_id
        if (symbolId && nodeId === selectedNode?.id) continue;
        if (contextData.length >= 40) break;

        const nodeFilePath = getNodeProp(node, '_filePath') || getNodeProp(node, 'filePath') || nodeId;
        let nodeCode = getNodeProp(node, 'code');

        if ((!nodeCode || nodeCode.trim() === '') && nodeId && dataApiBase && selectedProjectId) {
          fetchTasks.push(
            () => fetchSource(dataApiBase, selectedProjectId, nodeFilePath)
              .then(code => { if (code) nodeCode = code; })
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

      if (fetchTasks.length > 0) {
        await runWithConcurrencyLimit(fetchTasks, 5);
      }
    }

    // AST fallback when no file-scoped nodes are available
    if (contextData.length === 0 && astData && 'nodes' in astData) {
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

    // Project summary symbols (top N, excluding the selected node)
    if (dataApiBase && selectedProjectId) {
      try {
        const freshSummary = await fetchSummary(dataApiBase, selectedProjectId);
        if (freshSummary?.top_symbols) {
          const existingIds = new Set(contextData.map(n => n.id));
          for (const symbol of freshSummary.top_symbols.slice(0, 5)) {
            if (symbol.id !== selectedNode?.id && !existingIds.has(symbol.id) && contextData.length < 50) {
              let symbolCode = symbol.code || '';
              if ((!symbolCode || symbolCode.trim() === '') && symbol.id) {
                try {
                  symbolCode = await fetchSource(dataApiBase, selectedProjectId, symbol.id) || '';
                } catch (e) {}
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
      } catch (e) {}
    }

    return { contextData, symbolId };
  }, [selectedNode, fileScopedNodes, astData, dataApiBase, selectedProjectId]);

  return { buildContext };
};
