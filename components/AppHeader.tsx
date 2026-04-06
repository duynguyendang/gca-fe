import React from 'react';
import { ViewMode } from '../context/AppContext';
import ViewModeSwitcher from './ViewModeSwitcher';

interface AppHeaderProps {
  currentProject: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isSubModeSwitching: boolean;
  openSettings: () => void;
  isSearching: boolean;
  isConnected: boolean;
  isDataSyncing: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  currentProject,
  viewMode,
  onViewModeChange,
  isSubModeSwitching,
  openSettings,
  isSearching,
  isConnected,
  isDataSyncing,
}) => {
  const getStatus = () => {
    if (isDataSyncing) return { text: 'SYNCING...', color: 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]', textColor: 'text-amber-500' };
    if (isSubModeSwitching || isSearching) return { text: 'PROCESSING...', color: 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]', textColor: 'text-amber-500' };
    if (isConnected) return { text: 'CONNECTED', color: 'bg-[#10b981]', textColor: 'text-[#10b981]' };
    return { text: 'OFFLINE', color: 'bg-slate-600', textColor: 'text-slate-500' };
  };

  const status = getStatus();

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
            <p className="text-[10px] text-[var(--accent-teal)] font-mono tracking-widest uppercase line-clamp-1">
              {currentProject || "NO PROJECT"}
            </p>
          </div>
        </div>
      </div>

      {/* Spacer */}<div className="flex-1"></div>

      {/* Connection Status & View Switcher */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-white/5 rounded-full">
        <div className={`w-1.5 h-1.5 rounded-full ${status.color}`}></div>
        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${status.textColor}`}>
          {status.text}
        </span>
      </div>

      <div className="ml-auto flex items-center">
        <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
        <div className="h-8 w-px bg-white/10 mx-5 rounded"></div>
        <button
          aria-label="Open settings"
          className="text-slate-500 hover:text-white cursor-pointer transition-colors text-sm bg-transparent border-none p-1"
          onClick={openSettings}
        >
          <i className="fas fa-cog"></i>
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
