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
  } = useAppContext();

  const generateSuggestions = useCallback((): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const filesList = Array.isArray(sandboxFiles['files.json'])
      ? sandboxFiles['files.json']
      : [];
    const nodes = astData?.nodes || [];

    // For non-Narrative modes, always suggest "Explain this code" first
    if (viewMode !== 'narrative') {
      suggestions.push({ text: 'Explain this code', icon: 'fa-lightbulb' });
    }

    // Analyze project characteristics
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

    // Context-aware suggestions
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

    // Generic suggestions based on view mode
    switch (viewMode) {
      case 'architecture':
        suggestions.push({ text: 'Analyze the module structure', icon: 'fa-diagram-project' });
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

    // If we have selected node, add context-specific suggestions
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
  }, [astData, sandboxFiles, viewMode, searchTerm]);

  const suggestions = useMemo(() => generateSuggestions(), [generateSuggestions]);

  return { suggestions };
};

export default useContextualSuggestions;
