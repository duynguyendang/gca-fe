import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export type ViewMode = 'map' | 'discovery' | 'architecture' | 'narrative' | 'test' | 'dashboard';
export type SubMode = 'NARRATIVE' | 'ARCHITECTURE' | 'ENTROPY';

interface UIState {
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  activeSubMode: SubMode;
  setActiveSubMode: React.Dispatch<React.SetStateAction<SubMode>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCodeCollapsed: boolean;
  setIsCodeCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isLandingView: boolean;
  setIsLandingView: React.Dispatch<React.SetStateAction<boolean>>;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const UIContext = createContext<UIState | null>(null);

export const useUIContext = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUIContext must be used within UIProvider');
  return ctx;
};

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('narrative');
  const [activeSubMode, setActiveSubMode] = useState<SubMode>('NARRATIVE');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(false);
  const [isLandingView, setIsLandingView] = useState<boolean>(() => {
    return !sessionStorage.getItem('gca_selected_project_v2');
  });
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const value = useMemo(() => ({
    viewMode, setViewMode,
    activeSubMode, setActiveSubMode,
    isSettingsOpen, setIsSettingsOpen,
    isLeftSidebarOpen, setIsLeftSidebarOpen,
    isRightSidebarOpen, setIsRightSidebarOpen,
    isCodeCollapsed, setIsCodeCollapsed,
    isLandingView, setIsLandingView,
    isShortcutsOpen, setIsShortcutsOpen,
  }), [viewMode, activeSubMode, isSettingsOpen, isLeftSidebarOpen, isRightSidebarOpen, isCodeCollapsed, isLandingView, isShortcutsOpen]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};