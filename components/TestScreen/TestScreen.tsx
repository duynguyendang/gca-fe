import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fetchSymbols, fetchWhatCalls, generateTests } from '../../services/graphService';
import { useSettingsContext } from '../../context/SettingsContext';
import HighlightedCode from '../HighlightedCode';
import { logger } from '../../logger';

interface TestScreenProps {
  preSelectedNodeId?: string | null;
}

interface SymbolResult {
  id: string;
  name: string;
  kind: string;
  package?: string;
  role?: string;
}

interface DownstreamNode {
  id: string;
  name: string;
  kind: string;
  role?: string;
}

interface GeneratedTest {
  code: string;
  language: string;
}

const TestScreen: React.FC<TestScreenProps> = ({ preSelectedNodeId }) => {
  const { dataApiBase, selectedProjectId } = useSettingsContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SymbolResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [selectedTarget, setSelectedTarget] = useState<SymbolResult | null>(null);
  const [downstreamNodes, setDownstreamNodes] = useState<DownstreamNode[]>([]);
  const [loadingChain, setLoadingChain] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preSelectedNodeId && !selectedTarget) {
      const name = preSelectedNodeId.split(':').pop() || preSelectedNodeId;
      setSelectedTarget({ id: preSelectedNodeId, name, kind: '', package: '', role: '' });
      setSearchQuery(name);
    }
  }, [preSelectedNodeId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = useCallback(async (query: string) => {
    setSearchQuery(query);
    setError(null);

    if (!dataApiBase || !selectedProjectId) return;

    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await fetchSymbols(dataApiBase, selectedProjectId, query);
      const formatted = results.map((id: string) => ({
        id,
        name: id.includes(':') ? id.split(':').pop()! : id,
        kind: '',
        package: id.includes(':') ? id.split(':')[0] : '',
      }));
      setSearchResults(formatted.slice(0, 20));
      setShowDropdown(true);
    } catch (err: any) {
      logger.warn('[TestScreen] Symbol search failed:', err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [dataApiBase, selectedProjectId]);

  const handleSelectResult = useCallback((result: SymbolResult) => {
    setSelectedTarget(result);
    setSearchQuery(result.name);
    setShowDropdown(false);
    setDownstreamNodes([]);
    setGeneratedTest(null);
    setError(null);
  }, []);

  const handleGenerateTests = useCallback(async () => {
    if (!selectedTarget || !dataApiBase || !selectedProjectId) return;

    setGenerating(true);
    setError(null);
    setGeneratedTest(null);

    try {
      const result = await generateTests(dataApiBase, selectedProjectId, selectedTarget.id);
      setGeneratedTest(result.answer);
    } catch (err: any) {
      setError(`Failed to generate tests: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedTarget, dataApiBase, selectedProjectId]);

  useEffect(() => {
    if (!selectedTarget || !dataApiBase || !selectedProjectId) return;

    const loadCallChain = async () => {
      setLoadingChain(true);
      setDownstreamNodes([]);
      try {
        const result = await fetchWhatCalls(dataApiBase, selectedProjectId, selectedTarget.id, 3, true);
        if (result && result.nodes) {
          const callees = result.nodes
            .filter((n: any) => n.id !== selectedTarget.id)
            .map((n: any) => ({
              id: n.id,
              name: n.name || n.id.split(':').pop(),
              kind: n.kind || 'func',
              role: n.role || '',
            }));
          setDownstreamNodes(callees);
        }
      } catch (err: any) {
        logger.warn('[TestScreen] Failed to load call chain:', err.message);
      } finally {
        setLoadingChain(false);
      }
    };

    loadCallChain();
  }, [selectedTarget, dataApiBase, selectedProjectId]);

  const getLanguage = (code: string): string => {
    const lower = code.toLowerCase();
    if (lower.includes('func test') || lower.includes('testing.')) return 'go';
    if (lower.includes('describe(') || lower.includes('it(') || lower.includes('expect(')) return 'javascript';
    if (lower.includes('def test_') || lower.includes('pytest')) return 'python';
    return 'go';
  };

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-main)]">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
            <i className="fas fa-vial mr-3 text-[var(--accent-purple)]"></i>
            Integration Test Generator
          </h1>
          <p className="text-slate-400 text-sm">
            Select a handler or function to generate comprehensive integration tests with full call chain context.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </div>
        )}

        <div className="mb-6" ref={searchRef}>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Target Handler / Function
          </label>
          <div className="relative">
            <div className="flex items-center gap-3 w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg focus-within:border-[var(--accent-purple)] transition-colors">
              <i className="fas fa-search text-slate-500 text-sm"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search for a handler or function (e.g. GetUser, CreateSession)..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
              />
              {isSearching && <i className="fas fa-circle-notch fa-spin text-[var(--accent-purple)] text-sm"></i>}
              {selectedTarget && (
                <button
                  onClick={() => { setSelectedTarget(null); setSearchQuery(''); setDownstreamNodes([]); setGeneratedTest(null); }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl z-50 max-h-64 overflow-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
                  >
                    <i className="fas fa-cube text-slate-500 text-xs w-4"></i>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-mono truncate">{result.name}</div>
                      {result.package && (
                        <div className="text-xs text-slate-500 truncate">{result.package}</div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">{result.kind}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedTarget && (
          <>
            <div className="mb-6 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-purple)] to-[#9333ea] flex items-center justify-center">
                  <i className="fas fa-cube text-white text-xs"></i>
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{selectedTarget.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{selectedTarget.id}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider">Kind</span>
                  <div className="text-slate-300 mt-1">{selectedTarget.kind || 'func'}</div>
                </div>
                {selectedTarget.package && (
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider">Package</span>
                    <div className="text-slate-300 mt-1 font-mono truncate">{selectedTarget.package}</div>
                  </div>
                )}
                {selectedTarget.role && (
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider">Role</span>
                    <div className="text-slate-300 mt-1">{selectedTarget.role}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-arrow-down text-[var(--accent-teal)] text-xs"></i>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Downstream Call Chain {downstreamNodes.length > 0 && `(${downstreamNodes.length} functions)`}
                </span>
                {loadingChain && <i className="fas fa-circle-notch fa-spin text-[var(--accent-teal)] text-xs ml-2"></i>}
              </div>

              {downstreamNodes.length > 0 ? (
                <div className="space-y-1">
                  {downstreamNodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-main)] rounded border border-white/5"
                    >
                      <span className="text-[9px] text-slate-500 font-mono w-16 truncate">{node.kind}</span>
                      <span className="text-xs text-slate-300 font-mono flex-1 truncate">{node.name}</span>
                      {node.role && (
                        <span className="text-[9px] text-slate-600 bg-white/5 px-2 py-0.5 rounded">{node.role}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : !loadingChain && (
                <div className="text-xs text-slate-500 py-2">
                  <i className="fas fa-info-circle mr-1"></i>
                  No downstream callees found or symbol is a leaf node
                </div>
              )}
            </div>

            <div className="mb-6">
              <button
                onClick={handleGenerateTests}
                disabled={generating}
                className={`w-full py-3 px-6 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                  generating
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--accent-purple)] to-[#9333ea] text-white hover:opacity-90 shadow-lg shadow-purple-500/20'
                }`}
              >
                {generating ? (
                  <span><i className="fas fa-circle-notch fa-spin mr-2"></i>Generating Tests...</span>
                ) : (
                  <span><i className="fas fa-vial mr-2"></i>Generate Integration Tests</span>
                )}
              </button>
            </div>

            {generatedTest && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20">
                  <i className="fas fa-check-circle text-green-400 text-xs"></i>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-400">Generated Test Code</span>
                </div>
                <HighlightedCode
                  code={generatedTest}
                  language={getLanguage(generatedTest)}
                  startLine={1}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TestScreen;