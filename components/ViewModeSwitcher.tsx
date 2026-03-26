import React from 'react';

type ViewMode = 'flow' | 'map' | 'discovery' | 'backbone' | 'architecture' | 'narrative';

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
      default: return 'var(--accent-teal)';
    }
  };

  return (
    <div className="view-switcher" style={{ '--glow-color': getGlowColor() } as any}>
      <button
        className={viewMode === 'narrative' ? 'active' : ''}
        onClick={() => onViewModeChange('narrative')}
      >
        <i className="fas fa-brain mr-1.5 opacity-80"></i>
        NARRATIVE
      </button>
      <button
        className={viewMode === 'architecture' ? 'active' : ''}
        onClick={() => onViewModeChange('architecture')}
      >
        ARCHITECTURE
      </button>
      <button
        className={viewMode === 'discovery' ? 'active' : ''}
        onClick={() => onViewModeChange('discovery')}
      >
        DISCOVERY
      </button>
      <button
        className={viewMode === 'map' ? 'active' : ''}
        onClick={() => onViewModeChange('map')}
      >
        MAP
      </button>
    </div>
  );
};

export default ViewModeSwitcher;
