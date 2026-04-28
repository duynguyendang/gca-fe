import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ViewMode = 'map' | 'discovery' | 'architecture' | 'narrative' | 'dashboard';
export type SubMode = 'NARRATIVE' | 'ARCHITECTURE' | 'ENTROPY';

interface UIState {
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  activeSubMode: SubMode;
  setActiveSubMode: React.Dispatch<React.SetStateAction<SubMode>>;
  isDrawerOpen: boolean;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNarrativeOpen: boolean;
  setIsNarrativeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBottomDrawerOpen: boolean;
  setIsBottomDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  isCodeCollapsed: boolean;
  setIsCodeCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isSynthesisCollapsed: boolean;
  setIsSynthesisCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isLandingView: boolean;
  setIsLandingView: React.Dispatch<React.SetStateAction<boolean>>;
  isChatDrawerOpen: boolean;
  setIsChatDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  initialChatPrompt: string;
  setInitialChatPrompt: React.Dispatch<React.SetStateAction<string>>;
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNarrativeOpen, setIsNarrativeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(false);
  const [isSynthesisCollapsed, setIsSynthesisCollapsed] = useState(false);
  const [isLandingView, setIsLandingView] = useState<boolean>(() => {
    return !sessionStorage.getItem('gca_selected_project_v2');
  });
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [initialChatPrompt, setInitialChatPrompt] = useState('');

  return (
    <UIContext.Provider value={{
      viewMode, setViewMode,
      activeSubMode, setActiveSubMode,
      isDrawerOpen, setIsDrawerOpen,
      isNarrativeOpen, setIsNarrativeOpen,
      isSettingsOpen, setIsSettingsOpen,
      isLeftSidebarOpen, setIsLeftSidebarOpen,
      isRightSidebarOpen, setIsRightSidebarOpen,
      isBottomDrawerOpen, setIsBottomDrawerOpen,
      isFullScreen, setIsFullScreen,
      isCodeCollapsed, setIsCodeCollapsed,
      isSynthesisCollapsed, setIsSynthesisCollapsed,
      isLandingView, setIsLandingView,
      isChatDrawerOpen, setIsChatDrawerOpen,
      initialChatPrompt, setInitialChatPrompt,
    }}>
      {children}
    </UIContext.Provider>
  );
};