import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GraphProvider } from './GraphContext';
import { SearchProvider } from './SearchContext';
import { NarrativeProvider } from './NarrativeContext';
import { SettingsProvider, useSettingsContext } from './SettingsContext';
import { UIProvider } from './UIContext';
import { ToastProvider } from './ToastContext';

interface ProjectContextValue {
  currentProjectId: string | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export const useProjectContext = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within AppProviders');
  return ctx;
};

interface AppProvidersProps {
  children: ReactNode;
}

const AppProvidersContent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectedProjectId } = useSettingsContext();
  const [currentProjectId] = useState<string | null>(selectedProjectId || null);

  return (
    <ProjectContext.Provider value={{ currentProjectId }}>
      <ToastProvider>
        <UIProvider>
          <GraphProvider>
            <SearchProvider projectId={currentProjectId}>
              <NarrativeProvider>
                {children}
              </NarrativeProvider>
            </SearchProvider>
          </GraphProvider>
        </UIProvider>
      </ToastProvider>
    </ProjectContext.Provider>
  );
};

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <SettingsProvider>
    <AppProvidersContent>{children}</AppProvidersContent>
  </SettingsProvider>
);

export { AppProviders as default };