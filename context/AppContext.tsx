/**
 * App Context - Shared state for GCA Explorer
 */
import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { FlatGraph, ASTNode } from '../types';
import { FileDetailsResponse } from '../services/graphService';

// Sample data for initial state
const SAMPLE_DATA: FlatGraph = {
    nodes: [
        { id: "src/main.go:main", name: "main", type: "func", kind: "func", start_line: 1, end_line: 5, code: "func main() {\n\tfmt.Println(\"Hello GCA\")\n\t// Analyzer Entry Point\n\tinitialize()\n}" },
    ],
    links: []
};

interface ProjectInfo {
    id: string;
    name: string;
    description?: string;
}

export type ViewMode = 'flow' | 'map' | 'discovery' | 'backbone' | 'architecture';

interface AppState {
    // Core data
    astData: ASTNode | FlatGraph;
    setAstData: React.Dispatch<React.SetStateAction<ASTNode | FlatGraph>>;
    sandboxFiles: Record<string, any>;
    setSandboxFiles: React.Dispatch<React.SetStateAction<Record<string, any>>>;

    // API configuration
    dataApiBase: string;
    setDataApiBase: React.Dispatch<React.SetStateAction<string>>;


    // Projects
    currentProject: string;
    setCurrentProject: React.Dispatch<React.SetStateAction<string>>;
    availableProjects: ProjectInfo[];
    setAvailableProjects: React.Dispatch<React.SetStateAction<ProjectInfo[]>>;
    selectedProjectId: string;
    setSelectedProjectId: React.Dispatch<React.SetStateAction<string>>;

    // Sync state
    isDataSyncing: boolean;
    setIsDataSyncing: React.Dispatch<React.SetStateAction<boolean>>;
    syncError: string | null;
    setSyncError: React.Dispatch<React.SetStateAction<string | null>>;

    // Node selection
    selectedNode: any;
    setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
    hydratingNodeId: string | null;
    setHydratingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
    symbolCache: Map<string, any>;
    setSymbolCache: React.Dispatch<React.SetStateAction<Map<string, any>>>;

    // Insights
    nodeInsight: string | null;
    setNodeInsight: React.Dispatch<React.SetStateAction<string | null>>;
    isInsightLoading: boolean;
    setIsInsightLoading: React.Dispatch<React.SetStateAction<boolean>>;

    // Search
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    queryResults: any;
    setQueryResults: React.Dispatch<React.SetStateAction<any>>;
    isSearching: boolean;
    setIsSearching: React.Dispatch<React.SetStateAction<boolean>>;
    searchError: string | null;
    setSearchError: React.Dispatch<React.SetStateAction<string | null>>;
    searchStatus: string | null;
    setSearchStatus: React.Dispatch<React.SetStateAction<string | null>>;

    // View mode
    viewMode: ViewMode;
    setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
    isFlowLoading: boolean;
    setIsFlowLoading: React.Dispatch<React.SetStateAction<boolean>>;

    // File scoped data (for architecture view)
    fileScopedNodes: any[];
    setFileScopedNodes: React.Dispatch<React.SetStateAction<any[]>>;
    fileScopedLinks: any[];
    setFileScopedLinks: React.Dispatch<React.SetStateAction<any[]>>;
    currentFlowFileRef: React.MutableRefObject<string | null>;
    skipFlowZoom: boolean;
    setSkipFlowZoom: React.Dispatch<React.SetStateAction<boolean>>;

    // Progressive expansion
    expandedFileIds: Set<string>;
    setExpandedFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    fileDetailsCache: Map<string, FileDetailsResponse>;
    setFileDetailsCache: React.Dispatch<React.SetStateAction<Map<string, FileDetailsResponse>>>;
    expandingFileId: string | null;
    setExpandingFileId: React.Dispatch<React.SetStateAction<string | null>>;

    // Settings
    isSettingsOpen: boolean;
    setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    availablePredicates: string[];
    setAvailablePredicates: React.Dispatch<React.SetStateAction<string[]>>;
}

const AppContext = createContext<AppState | null>(null);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    // Core data
    const [astData, setAstData] = useState<ASTNode | FlatGraph>(() => {
        try {
            const saved = sessionStorage.getItem('gca_ast_data');
            return saved ? JSON.parse(saved) : SAMPLE_DATA;
        } catch (e) { return SAMPLE_DATA; }
    });

    const [sandboxFiles, setSandboxFiles] = useState<Record<string, any>>(() => {
        try {
            const saved = sessionStorage.getItem('gca_sandbox_files');
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });

    // API configuration
    const [dataApiBase, setDataApiBase] = useState<string>(() => sessionStorage.getItem('gca_api_base') || import.meta.env.GCA_API_BASE_URL || "http://localhost:8080");


    // Projects
    const [currentProject, setCurrentProject] = useState<string>("GCA-Sandbox-Default");
    const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Sync state
    const [isDataSyncing, setIsDataSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Node selection
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [hydratingNodeId, setHydratingNodeId] = useState<string | null>(null);
    const [symbolCache, setSymbolCache] = useState<Map<string, any>>(new Map());

    // Insights
    const [nodeInsight, setNodeInsight] = useState<string | null>(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState("");
    const [queryResults, setQueryResults] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<string | null>(null);

    // View mode
    const [viewMode, setViewMode] = useState<ViewMode>('discovery');
    const [isFlowLoading, setIsFlowLoading] = useState(false);

    // File scoped data
    const [fileScopedNodes, setFileScopedNodes] = useState<any[]>([]);
    const [fileScopedLinks, setFileScopedLinks] = useState<any[]>([]);
    const currentFlowFileRef = useRef<string | null>(null);
    const [skipFlowZoom, setSkipFlowZoom] = useState(false);

    // Progressive expansion
    const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
    const [fileDetailsCache, setFileDetailsCache] = useState<Map<string, FileDetailsResponse>>(new Map());
    const [expandingFileId, setExpandingFileId] = useState<string | null>(null);

    // Settings
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [availablePredicates, setAvailablePredicates] = useState<string[]>([]);

    const value: AppState = {
        astData, setAstData,
        sandboxFiles, setSandboxFiles,
        dataApiBase, setDataApiBase,

        currentProject, setCurrentProject,
        availableProjects, setAvailableProjects,
        selectedProjectId, setSelectedProjectId,
        isDataSyncing, setIsDataSyncing,
        syncError, setSyncError,
        selectedNode, setSelectedNode,
        hydratingNodeId, setHydratingNodeId,
        symbolCache, setSymbolCache,
        nodeInsight, setNodeInsight,
        isInsightLoading, setIsInsightLoading,
        searchTerm, setSearchTerm,
        queryResults, setQueryResults,
        isSearching, setIsSearching,
        searchError, setSearchError,
        searchStatus, setSearchStatus,
        viewMode, setViewMode,
        isFlowLoading, setIsFlowLoading,
        fileScopedNodes, setFileScopedNodes,
        fileScopedLinks, setFileScopedLinks,
        currentFlowFileRef,
        skipFlowZoom, setSkipFlowZoom,
        expandedFileIds, setExpandedFileIds,
        fileDetailsCache, setFileDetailsCache,
        expandingFileId, setExpandingFileId,
        isSettingsOpen, setIsSettingsOpen,
        availablePredicates, setAvailablePredicates,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
