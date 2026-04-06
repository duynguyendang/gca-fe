import { useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

interface Suggestion {
  text: string;
  icon: string;
}

export const useContextualSuggestions = () => {
  const {
    astData,
    sandboxFiles,
    dataApiBase,
    selectedProjectId,
    viewMode,
    searchTerm,
    selectedNode,
    fileScopedNodes,
    fileScopedLinks,
  } = useAppContext();

  const generateSuggestions = useCallback((): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const filesList = Array.isArray(sandboxFiles['files.json'])
      ? sandboxFiles['files.json']
      : [];
    const nodes = Array.isArray(astData?.nodes) ? astData.nodes as any[] : [];

    // For non-Narrative modes, always suggest "Explain this code" first
    if (viewMode !== 'narrative') {
      suggestions.push({ text: 'Explain this code', icon: 'fa-lightbulb' });
    }

    // File-specific suggestions based on selected node
    if (selectedNode) {
      const fileName = (selectedNode.name || '').toLowerCase();
      const filePath = ((selectedNode as any)._filePath || selectedNode.id || '').toLowerCase();
      const nodeKind = (selectedNode.kind || selectedNode.type || '').toLowerCase();
      const isFile = selectedNode._isFile || nodeKind === 'file';

      // Detect file characteristics from name/path
      const isTestFile = fileName.includes('_test.') || fileName.includes('.test.') || fileName.includes('.spec.');
      const isAuthFile = fileName.includes('auth') || fileName.includes('login') || fileName.includes('token') || fileName.includes('session') || fileName.includes('middleware');
      const isAPIFile = fileName.includes('handler') || fileName.includes('controller') || fileName.includes('api') || fileName.includes('endpoint') || fileName.includes('route') || fileName.includes('server');
      const isDBFile = fileName.includes('db') || fileName.includes('database') || fileName.includes('sql') || fileName.includes('model') || fileName.includes('repository') || fileName.includes('store');
      const isConfigFile = fileName.includes('config') || fileName.includes('env') || fileName.includes('setting');
      const isUtilFile = fileName.includes('util') || fileName.includes('helper') || fileName.includes('common') || fileName.includes('shared');
      const isServiceFile = fileName.includes('service') || fileName.includes('business') || fileName.includes('logic');
      const isMainFile = fileName.includes('main') || fileName.includes('entry') || fileName.includes('app.');

      // Detect from file-scoped data (architecture view)
      const scopedLinks = fileScopedLinks || [];
      const scopedNodes = fileScopedNodes || [];
      const hasOutgoingCalls = scopedLinks.some((l: any) => l.source?.includes(fileName) || l.source?.includes(filePath));
      const hasIncomingCalls = scopedLinks.some((l: any) => l.target?.includes(fileName) || l.target?.includes(filePath));
      const callCount = scopedLinks.filter((l: any) => l.source?.includes(fileName) || l.source?.includes(filePath)).length;

      if (isFile) {
        // File-specific suggestions
        if (isAPIFile) {
          suggestions.push({ text: 'List all API endpoints', icon: 'fa-plug' });
          suggestions.push({ text: 'Trace the API request flow', icon: 'fa-route' });
        }

        if (isAuthFile) {
          suggestions.push({ text: 'Explain authentication flow', icon: 'fa-lock' });
        }

        if (isTestFile) {
          suggestions.push({ text: 'Show test coverage', icon: 'fa-vial' });
          suggestions.push({ text: 'Find all test files', icon: 'fa-flask' });
        }

        if (isDBFile) {
          suggestions.push({ text: 'Show database schema', icon: 'fa-database' });
          suggestions.push({ text: 'Trace data flow', icon: 'fa-exchange-alt' });
        }

        if (isConfigFile) {
          suggestions.push({ text: 'Show configuration dependencies', icon: 'fa-cog' });
        }

        if (isServiceFile) {
          suggestions.push({ text: 'Show service dependencies', icon: 'fa-project-diagram' });
          suggestions.push({ text: 'Trace the business logic flow', icon: 'fa-route' });
        }

        if (isMainFile) {
          suggestions.push({ text: 'Show application entry points', icon: 'fa-sign-in-alt' });
          suggestions.push({ text: 'Trace initialization flow', icon: 'fa-play' });
        }

        if (isUtilFile) {
          suggestions.push({ text: 'Show where this is used', icon: 'fa-code-branch' });
        }

        // Dependency-based suggestions
        if (hasOutgoingCalls && callCount > 0) {
          suggestions.push({ text: `Show ${callCount} file dependencies`, icon: 'fa-arrow-right' });
        }

        if (hasIncomingCalls) {
          suggestions.push({ text: 'Show files that depend on this', icon: 'fa-arrow-left' });
        }

        if (hasOutgoingCalls && hasIncomingCalls) {
          suggestions.push({ text: 'Show full dependency graph', icon: 'fa-project-diagram' });
        }

        // Language-specific suggestions
        const isGo = fileName.endsWith('.go');
        const isPython = fileName.endsWith('.py');
        const isTS = fileName.endsWith('.ts') || fileName.endsWith('.tsx');

        if (isGo) {
          suggestions.push({ text: 'Analyze Go package structure', icon: 'fa-box' });
          suggestions.push({ text: 'Show exported symbols', icon: 'fa-export' });
        }

        if (isPython) {
          suggestions.push({ text: 'Explain Python modules', icon: 'fa-python' });
        }

        if (isTS) {
          suggestions.push({ text: 'Show component hierarchy', icon: 'fa-sitemap' });
        }
      } else {
        // Symbol-specific suggestions (function, struct, etc.)
        if (nodeKind === 'function' || nodeKind === 'func' || nodeKind === 'method') {
          suggestions.push({ text: 'Show callers of this function', icon: 'fa-code-branch' });
          suggestions.push({ text: 'Trace execution flow', icon: 'fa-route' });
        }

        if (nodeKind === 'struct' || nodeKind === 'class' || nodeKind === 'interface') {
          suggestions.push({ text: 'Show where this type is used', icon: 'fa-code-branch' });
          suggestions.push({ text: 'Show type hierarchy', icon: 'fa-sitemap' });
        }

        if (nodeKind === 'variable' || nodeKind === 'const') {
          suggestions.push({ text: 'Find all references', icon: 'fa-search' });
        }
      }
    }

    // Project-level fallback suggestions (only if no selected node)
    if (!selectedNode) {
      const hasTests = filesList.some((f: string) =>
        f.includes('_test.') || f.includes('.test.') || f.includes('.spec.')
      );

      const hasAPI = nodes.some((n: any) =>
        n.kind === 'function' && (
          n.name?.toLowerCase().includes('handler') ||
          n.name?.toLowerCase().includes('controller') ||
          n.name?.toLowerCase().includes('api') ||
          n.name?.toLowerCase().includes('endpoint')
        )
      );

      const hasAuth = nodes.some((n: any) =>
        n.name?.toLowerCase().includes('auth') ||
        n.name?.toLowerCase().includes('login') ||
        n.name?.toLowerCase().includes('token') ||
        n.name?.toLowerCase().includes('session')
      );

      const hasDB = filesList.some((f: string) =>
        f.toLowerCase().includes('db') ||
        f.toLowerCase().includes('database') ||
        f.toLowerCase().includes('sql') ||
        f.endsWith('.sql')
      );

      const hasGoFiles = filesList.some((f: string) => f.endsWith('.go'));
      const hasPythonFiles = filesList.some((f: string) => f.endsWith('.py'));
      const hasJSFiles = filesList.some((f: string) =>
        f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx')
      );

      if (hasAPI) {
        suggestions.push({ text: 'List all API endpoints', icon: 'fa-plug' });
        suggestions.push({ text: 'Trace the API request flow', icon: 'fa-route' });
      }

      if (hasAuth) {
        suggestions.push({ text: 'Explain authentication flow', icon: 'fa-lock' });
      }

      if (hasTests) {
        suggestions.push({ text: 'Show test coverage', icon: 'fa-vial' });
        suggestions.push({ text: 'Find all test files', icon: 'fa-flask' });
      }

      if (hasDB) {
        suggestions.push({ text: 'Show database schema', icon: 'fa-database' });
      }

      if (hasGoFiles) {
        suggestions.push({ text: 'Analyze Go package structure', icon: 'fa-box' });
      }

      if (hasPythonFiles) {
        suggestions.push({ text: 'Explain Python modules', icon: 'fa-python' });
      }

      if (hasJSFiles) {
        suggestions.push({ text: 'Show component hierarchy', icon: 'fa-sitemap' });
      }
    }

    // View mode suggestions
    switch (viewMode) {
      case 'architecture':
        if (!selectedNode) {
          suggestions.push({ text: 'Analyze the module structure', icon: 'fa-diagram-project' });
        }
        suggestions.push({ text: 'Show dependencies', icon: 'fa-project-diagram' });
        break;
      case 'discovery':
        suggestions.push({ text: 'Find entry points', icon: 'fa-sign-in-alt' });
        suggestions.push({ text: 'Show main functions', icon: 'fa-code' });
        break;
      case 'map':
        suggestions.push({ text: 'Show file relationships', icon: 'fa-project-diagram' });
        suggestions.push({ text: 'Display call graph', icon: 'fa-sitemap' });
        break;
    }

    // Search-based suggestions
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (searchLower.includes('auth')) {
        suggestions.push({ text: 'How does authentication work?', icon: 'fa-question-circle' });
      }
      if (searchLower.includes('api')) {
        suggestions.push({ text: 'What are the API endpoints?', icon: 'fa-question-circle' });
      }
    }

    // Always include a few helpful suggestions
    if (suggestions.length < 3) {
      suggestions.push({ text: 'Analyze the module structure', icon: 'fa-diagram-project' });
      suggestions.push({ text: 'Find entry points', icon: 'fa-sign-in-alt' });
    }

    // Limit to 5 suggestions
    return suggestions.slice(0, 5);
  }, [astData, sandboxFiles, viewMode, searchTerm, selectedNode, fileScopedNodes, fileScopedLinks]);

  const suggestions = useMemo(() => generateSuggestions(), [generateSuggestions]);

  return { suggestions };
};

export default useContextualSuggestions;
