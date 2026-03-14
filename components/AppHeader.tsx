import React from 'react';
import { ViewMode } from './ViewModeSwitcher';
import SearchBar from './SearchBar';
import ViewModeSwitcher from './ViewModeSwitcher';

interface AppHeaderProps {
  currentProject: string;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearch: (term: string) => void;
  isSearching: boolean;
  searchStatus: string | null;
  searchError: string | null;
  queryResults: any;
  setCtxSearchError: (error: string | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isSubModeSwitching: boolean;
  openSettings: () => void;
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

const AppHeader: React.FC<AppHeaderProps> = ({
  currentProject,
  searchTerm,
  onSearchTermChange,
  onSearch,
  isSearching,
  searchStatus,
  searchError,
  queryResults,
  setCtxSearchError,
  viewMode,
  onViewModeChange,
  isSubModeSwitching,
  openSettings,
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
  return (
    <header className="h-14 border-b border-white/5 flex items-center px-6 gap-6 bg-[var(--bg-main)]/90 backdrop-blur-md z-20 shrink-0">
      {/* Logo & Project Section */}
      <div className="flex flex-col shrink-0 min-w-[180px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--accent-teal)] flex items-center justify-center text-[var(--bg-main)] font-black shadow-[0_0_15px_rgba(45,212,191,0.4)]">
            G
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight uppercase italic line-clamp-1">
              GCA EXPLORER
            </h1>
            <p className="text-[9px] text-[var(--accent-teal)] font-mono tracking-widest uppercase line-clamp-1 opacity-80">
              {currentProject || "NO PROJECT"}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 flex items-center justify-center">
        <SearchBar
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          onSearch={onSearch}
          isSearching={isSearching}
          searchStatus={searchStatus}
          searchError={searchError}
          queryResults={queryResults}
          setCtxSearchError={setCtxSearchError}
          viewMode={viewMode}
          lastExecutedQuery={lastExecutedQuery}
          dataApiBase={dataApiBase}
          selectedProjectId={selectedProjectId}
          setCtxSearchStatus={setCtxSearchStatus}
          setCtxIsSearching={setCtxIsSearching}
          setFileScopedNodes={setFileScopedNodes}
          setFileScopedLinks={setFileScopedLinks}
          setIsClustered={setIsClustered}
          setNodeInsight={setNodeInsight}
          setSearchTerm={setSearchTerm}
          setQueryResultsNull={setQueryResultsNull}
          setFileScopedNodesEmpty={setFileScopedNodesEmpty}
          setFileScopedLinksEmpty={setFileScopedLinksEmpty}
        />
      </div>

      {/* Model Status & View Switcher */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-white/5 rounded-full">
        <div className={`w-1.5 h-1.5 rounded-full ${isSubModeSwitching || isSearching ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-[#10b981]'}`}></div>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
          {isSubModeSwitching || isSearching ? 'PROCESSING...' : 'MODEL: READY'}
        </span>
      </div>

      <div className="ml-auto flex items-center">
        <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
        <div className="h-8 w-px bg-white/10 mx-5 rounded"></div>
        <i
          className="fas fa-cog text-slate-500 hover:text-white cursor-pointer transition-colors text-sm"
          onClick={openSettings}
        ></i>
      </div>
    </header>
  );
};

export default AppHeader;
