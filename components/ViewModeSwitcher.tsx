import React from 'react';

type ViewMode = 'map' | 'discovery' | 'architecture' | 'narrative' | 'test' | 'dashboard';

interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const MODE_CONFIG: Record<ViewMode, { label: string; icon: string; tooltip: string }> = {
  narrative: {
    label: 'NARRATIVE',
    icon: 'fa-brain',
    tooltip: 'AI chat & code explanation (1)',
  },
  discovery: {
    label: 'DISCOVERY',
    icon: 'fa-circle-nodes',
    tooltip: 'Graph exploration & traversal (2)',
  },
  architecture: {
    label: 'ARCHITECTURE',
    icon: 'fa-sitemap',
    tooltip: 'Hierarchical class/file diagrams (3)',
  },
  map: {
    label: 'MAP',
    icon: 'fa-layer-group',
    tooltip: 'Treemap & cluster overview (4)',
  },
  test: {
    label: 'TEST',
    icon: 'fa-vial',
    tooltip: 'Integration test generation (5)',
  },
  dashboard: {
    label: 'DASHBOARD',
    icon: 'fa-chart-pie',
    tooltip: 'Health metrics & risk leaderboard (6)',
  },
};

const VIEW_MODES: ViewMode[] = [
  'narrative',
  'discovery',
  'architecture',
  'map',
  'test',
  'dashboard',
];

const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="view-switcher flex items-center gap-1 bg-slate-900/50 border border-white/5 rounded-full p-1" role="tablist" aria-label="View mode">
      {VIEW_MODES.map((mode) => {
        const config = MODE_CONFIG[mode];
        const isActive = viewMode === mode;
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={isActive}
            aria-label={config.tooltip}
            title={config.tooltip}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-full transition-all ${
              isActive
                ? 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] border border-[var(--accent-teal)]/30 shadow-[0_0_8px_rgba(45,212,191,0.2)]'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
            onClick={() => onViewModeChange(mode)}
          >
            <i className={`fas ${config.icon} text-[9px]`} aria-hidden="true"></i>
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeSwitcher;