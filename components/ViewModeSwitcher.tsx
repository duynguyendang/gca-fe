import React from 'react';

type ViewMode = 'map' | 'discovery' | 'architecture' | 'narrative' | 'dashboard';

interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({ viewMode, onViewModeChange }) => {
  const getGlowColor = () => {
    switch (viewMode) {
      case 'narrative': return 'var(--accent-blue)';
      case 'architecture': return 'var(--accent-purple)';
      case 'map': return '#f59e0b';
      case 'dashboard': return 'var(--accent-teal)';
      default: return 'var(--accent-teal)';
    }
  };

  return (
    <div className="view-switcher" role="tablist" aria-label="View mode" style={{ '--glow-color': getGlowColor() } as any}>
      <button
        role="tab"
        aria-selected={viewMode === 'dashboard'}
        aria-label="Dashboard view"
        className={viewMode === 'dashboard' ? 'active' : ''}
        onClick={() => onViewModeChange('dashboard')}
      >
        <i className="fas fa-chart-pie mr-1.5 opacity-80"></i>
        DASHBOARD
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'narrative'}
        aria-label="Narrative view"
        className={viewMode === 'narrative' ? 'active' : ''}
        onClick={() => onViewModeChange('narrative')}
      >
        <i className="fas fa-brain mr-1.5 opacity-80"></i>
        NARRATIVE
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'architecture'}
        aria-label="Architecture view"
        className={viewMode === 'architecture' ? 'active' : ''}
        onClick={() => onViewModeChange('architecture')}
      >
        ARCHITECTURE
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'discovery'}
        aria-label="Discovery view"
        className={viewMode === 'discovery' ? 'active' : ''}
        onClick={() => onViewModeChange('discovery')}
      >
        DISCOVERY
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'map'}
        aria-label="Map view"
        className={viewMode === 'map' ? 'active' : ''}
        onClick={() => onViewModeChange('map')}
      >
        MAP
      </button>
    </div>
  );
};

export default ViewModeSwitcher;
