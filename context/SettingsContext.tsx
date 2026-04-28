import React, { createContext, useContext, useState, ReactNode } from 'react';
import { API_CONFIG } from '../constants';

interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
}

interface SettingsState {
  dataApiBase: string;
  setDataApiBase: React.Dispatch<React.SetStateAction<string>>;
  currentProject: string;
  setCurrentProject: React.Dispatch<React.SetStateAction<string>>;
  availableProjects: ProjectInfo[];
  setAvailableProjects: React.Dispatch<React.SetStateAction<ProjectInfo[]>>;
  selectedProjectId: string;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string>>;
  isDataSyncing: boolean;
  setIsDataSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  syncError: string | null;
  setSyncError: React.Dispatch<React.SetStateAction<string | null>>;
  availablePredicates: string[];
  setAvailablePredicates: React.Dispatch<React.SetStateAction<string[]>>;
  enableAutoClustering: boolean;
  setEnableAutoClustering: React.Dispatch<React.SetStateAction<boolean>>;
  sandboxFiles: Record<string, string[]>;
  setSandboxFiles: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

const SettingsContext = createContext<SettingsState | null>(null);

export const useSettingsContext = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dataApiBase, setDataApiBase] = useState<string>(() => {
    const envBase = import.meta.env.VITE_GCA_API_BASE_URL || import.meta.env.GCA_API_BASE_URL;
    if (envBase && !envBase.includes('localhost') && !envBase.includes('127.0.0.1')) {
      return envBase;
    }
    return sessionStorage.getItem('gca_api_base_v2') || envBase || API_CONFIG.DEFAULT_BASE_URL;
  });

  const [currentProject, setCurrentProject] = useState('GCA-Sandbox-Default');
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => sessionStorage.getItem('gca_selected_project_v2') || '');
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [availablePredicates, setAvailablePredicates] = useState<string[]>([]);
  const [enableAutoClustering, setEnableAutoClustering] = useState(true);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string[]>>(() => {
    try {
      const saved = sessionStorage.getItem('gca_sandbox_files');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  return (
    <SettingsContext.Provider value={{
      dataApiBase, setDataApiBase,
      currentProject, setCurrentProject,
      availableProjects, setAvailableProjects,
      selectedProjectId, setSelectedProjectId,
      isDataSyncing, setIsDataSyncing,
      syncError, setSyncError,
      availablePredicates, setAvailablePredicates,
      enableAutoClustering, setEnableAutoClustering,
      sandboxFiles, setSandboxFiles,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};