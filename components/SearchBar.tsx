import React, { useState, useRef, useEffect } from 'react';
import { UI_CONFIG } from '../constants';

interface SearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearch: (term: string) => void;
  isSearching: boolean;
  searchStatus: string | null;
  searchError: string | null;
  queryResults: any;
  setCtxSearchError: (error: string | null) => void;
  viewMode: string;
  lastExecutedQuery: string;
  dataApiBase: string;
  selectedProjectId: string;
  setCtxSearchStatus: (status: string | null) => void;
  setCtxIsSearching: (searching: boolean) => void;
  setFileScopedNodes: (nodes: any[]) => void;
  setFileScopedLinks: (links: any[]) => void;
  setIsClustered: (clustered: boolean) => void;
  setNodeInsight: (insight: string | null) => void;
  setSearchTerm: (term: string) => void;
  setQueryResultsNull: () => void;
  setFileScopedNodesEmpty: () => void;
  setFileScopedLinksEmpty: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  isSearching,
  searchStatus,
  searchError,
  queryResults,
  setCtxSearchError,
  viewMode,
  lastExecutedQuery,
  dataApiBase,
  selectedProjectId,
  setCtxSearchStatus,
  setCtxIsSearching,
  setFileScopedNodes,
  setFileScopedLinks,
  setIsClustered,
  setNodeInsight,
  setSearchTerm,
  setQueryResultsNull,
  setFileScopedNodesEmpty,
  setFileScopedLinksEmpty,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('queryHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = (query: string) => {
    if (!query || !query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, UI_CONFIG.HISTORY_LIMIT);
    setSearchHistory(newHistory);
    localStorage.setItem('queryHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('queryHistory');
  };

  const runSearch = () => {
    if (searchTerm) {
      onSearch(searchTerm);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setQueryResultsNull();
    setCtxSearchError(null);
    setNodeInsight(null);
    setFileScopedNodesEmpty();
    setFileScopedLinksEmpty();
  };

  const handleClustering = async () => {
    try {
      const queryToUse = lastExecutedQuery || 'query(?x) :- triples(?x, "defines", ?y)';
      setCtxIsSearching(true);
      setCtxSearchStatus('Applying Leiden clustering...');
      const { getClusteredGraph } = await import('../services/graphService');
      const clusteredData = await getClusteredGraph(dataApiBase, selectedProjectId, queryToUse);
      setFileScopedNodes(clusteredData.nodes);
      setFileScopedLinks(clusteredData.links);
      setIsClustered(true);
      setCtxSearchStatus(null);
      setCtxIsSearching(false);
    } catch (err: any) {
      setCtxSearchError(err.message || 'Clustering failed');
      setCtxSearchStatus(null);
      setCtxIsSearching(false);
    }
  };

  return (
    <div className={`flex items-center bg-[#16222a] border ${isSearching ? 'border-[var(--accent-teal)] shadow-[0_0_15px_-3px_rgba(45,212,191,0.3)]' : 'border-white/10 hover:border-white/20'} rounded-full px-1.5 py-1.5 w-full max-w-2xl shadow-xl transition-all relative group`}>
      <div className="flex items-center justify-center w-10 h-8 text-slate-500">
        <i className={`fas ${viewMode === 'narrative' ? 'fa-bolt text-[var(--accent-blue)]' : 'fa-magnifying-glass'} text-xs`}></i>
      </div>
      <input
        type="text"
        placeholder={viewMode === 'narrative' ? 'Ask me to explain a logic flow or predict a bottleneck...' : 'Ask a question (e.g. "How does Auth work?") or search symbols...'}
        value={searchTerm}
        onChange={(e) => {
          onSearchTermChange(e.target.value);
          setCtxSearchError(null);
          if (e.target.value.length > UI_CONFIG.MIN_SEARCH_LENGTH) {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => {
              // Auto-search disabled for cleaner experience
            }, UI_CONFIG.DEBOUNCE_DELAY);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && searchTerm) {
            addToHistory(searchTerm);
            setShowHistory(false);
            onSearch(searchTerm);
          }
        }}
        className="bg-transparent border-none flex-1 px-2 text-xs focus:outline-none text-white font-medium placeholder-slate-500 h-8"
        onFocus={() => setShowHistory(true)}
        onBlur={() => {
          if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = setTimeout(() => setShowHistory(false), UI_CONFIG.BLUR_DELAY);
        }}
      />

      {searchStatus && (
        <div className="absolute top-[80%] right-4 text-[10px] text-[var(--accent-teal)] font-mono animate-pulse bg-[var(--bg-main)]/80 px-2 py-1 rounded">
          <i className="fas fa-circle-notch animate-spin mr-2"></i>
          {searchStatus}
        </div>
      )}

      {showHistory && searchHistory.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[#0d171d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recent Queries</span>
            <button onClick={clearHistory} className="text-[9px] text-slate-500 hover:text-white transition-colors">Clear</button>
          </div>
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {searchHistory.map((q, i) => (
              <div
                key={i}
                className="px-4 py-2.5 text-[11px] text-slate-300 hover:bg-[var(--accent-teal)]/10 hover:text-[var(--accent-teal)] cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
                onClick={() => {
                  onSearchTermChange(q);
                  onSearch(q);
                  setShowHistory(false);
                }}
              >
                <i className="fas fa-history text-slate-600 text-[10px]"></i>
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSearching && <i className="fas fa-circle-notch fa-spin text-[var(--accent-teal)] text-xs absolute right-12"></i>}

      {(queryResults || searchError) && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--accent-teal)]/30 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between">
            {searchError ? (
              <div className="text-[11px] text-red-400 font-bold flex items-start gap-2">
                <i className="fas fa-exclamation-triangle mt-0.5"></i>
                <span>{searchError}</span>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--accent-teal)] font-bold flex items-center gap-2">
                <i className="fas fa-check-circle"></i>
                Found {queryResults.nodes?.length || 0} symbols.
                <span className="text-slate-500 font-normal ml-1">AI Context Loaded.</span>
              </div>
            )}
            <button
              onClick={handleClearSearch}
              className="text-slate-500 hover:text-white ml-4 px-2 py-0.5 text-[9px] border border-white/10 rounded hover:bg-white/10 transition-colors uppercase tracking-wider"
              title="Clear Search & Reset Graph"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <button
        onClick={runSearch}
        disabled={!searchTerm || isSearching}
        className="w-8 h-8 rounded-full bg-[var(--accent-teal)] flex items-center justify-center text-[#0a1118] text-[10px] disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(45,212,191,0.4)] ml-1"
      >
        <i className="fas fa-arrow-right"></i>
      </button>
    </div>
  );
};

export default SearchBar;
