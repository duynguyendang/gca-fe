
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import TreeVisualizer from './components/TreeVisualizer/index';
import { ASTNode, FlatGraph } from './types';
import { getGeminiInsight } from './services/geminiService';

// Ensure Prism is available for highlighting
declare var Prism: any;

const SAMPLE_DATA: FlatGraph = {
  nodes: [
    { id: "src/main.go:main", name: "main", type: "func", kind: "func", start_line: 1, end_line: 5, code: "func main() {\n\tfmt.Println(\"Hello GCA\")\n\t// Analyzer Entry Point\n\tinitialize()\n}" },
  ],
  links: []
};

const stratifyPaths = (nodes: any[], filePaths: string[] = []) => {
  const root: any = { _isFolder: true, children: {} };
  
  if (Array.isArray(filePaths)) {
    filePaths.forEach(path => {
      if (typeof path !== 'string') return;
      const parts = path.split('/');
      let current = root;
      parts.forEach((part, i) => {
        const isLastPart = i === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = { 
            _isFolder: !isLastPart, 
            _isFile: isLastPart,
            children: {},
            _symbols: []
          };
        }
        current = current.children[part];
      });
    });
  }

  if (Array.isArray(nodes)) {
    nodes.forEach(node => {
      if (!node || !node.id) return;
      const [filePath, symbol] = node.id.split(':');
      if (!filePath) return;

      const parts = filePath.split('/');
      let current = root;
      
      parts.forEach((part, i) => {
        const isLastPart = i === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = { 
            _isFolder: !isLastPart, 
            _isFile: isLastPart,
            children: {},
            _symbols: []
          };
        }
        if (isLastPart && symbol) {
          if (!current.children[part]._symbols.find((s: any) => s.node.id === node.id)) {
            current.children[part]._symbols.push({ name: symbol, node });
          }
        }
        current = current.children[part];
      });
    });
  }
  
  return root.children;
};

const HighlightedCode = ({ code, language, startLine }: { code: string, language: string, startLine: number }) => {
  const codeRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (codeRef.current && typeof Prism !== 'undefined') {
      try { Prism.highlightElement(codeRef.current); } catch (e) {}
    }
  }, [code, language]);
  
  const lines = (code || "").split('\n');
  return (
    <div className="flex bg-[#0d171d] min-h-full font-mono text-[11px]">
      <div className="bg-[#0a1118] text-slate-700 text-right pr-3 pl-2 select-none border-r border-white/5 py-4 min-w-[3.5rem]">
        {lines.map((_, i) => <div key={i} className="leading-5 h-5">{startLine + i}</div>)}
      </div>
      <div className="flex-1 overflow-x-auto py-4 px-4 relative">
        <pre className="m-0 p-0 bg-transparent">
          <code ref={codeRef} className={`language-${language} leading-5 block`}>{code}</code>
        </pre>
      </div>
    </div>
  );
};

interface FileTreeItemProps {
  name: string;
  node: any;
  depth?: number;
  fullPath?: string;
  onNodeSelect: (node: any) => void;
  astData: any;
  selectedNode: any;
}

const FileTreeItem = ({ name, node, depth = 0, fullPath = "", onNodeSelect, astData, selectedNode }: FileTreeItemProps) => {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const currentPath = fullPath ? `${fullPath}/${name}` : name;

  const children = Object.entries(node.children || {});
  const symbols = (node._symbols as any[]) || [];
  const hasChildren = children.length > 0 || symbols.length > 0;
  
  const isSelected = selectedNode?.id === currentPath || selectedNode?.id?.startsWith(currentPath + ':');

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'go': return 'fa-brands fa-golang text-cyan-500';
      case 'ts':
      case 'tsx': return 'fa-brands fa-js text-blue-400';
      case 'py': return 'fa-brands fa-python text-yellow-500';
      case 'json': return 'fa-file-lines text-slate-400';
      default: return 'fa-file-code text-slate-500';
    }
  };

  const handleFileClick = () => {
    setIsOpen(!isOpen);
    if (node._isFile) {
      const flatNodes = (astData as FlatGraph)?.nodes || [];
      const astNode = flatNodes.find(n => n.id === currentPath);
      if (astNode) {
        onNodeSelect(astNode);
      } else {
        onNodeSelect({ id: currentPath, _isMissingCode: true });
      }
    }
  };

  return (
    <div className="select-none">
      <div 
        onClick={handleFileClick}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-white/5 group transition-colors ${isSelected ? 'bg-[#00f2ff]/10 text-[#00f2ff]' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <i className={`fas ${node._isFile ? getFileIcon(name) : (isOpen ? 'fa-folder-open text-slate-400' : 'fa-folder text-slate-600')} text-[10px]`}></i>
        <span className={`truncate ${node._isFile ? 'text-[11px] font-medium' : 'text-slate-500 font-bold uppercase text-[8px] tracking-[0.1em]'}`}>
          {name}
        </span>
        {hasChildren && !node._isFile && <i className={`fas fa-chevron-right ml-auto text-[7px] transition-transform ${isOpen ? 'rotate-90' : ''} opacity-20 group-hover:opacity-100`}></i>}
      </div>

      {isOpen && (
        <div>
          {children.map(([childName, childNode]) => (
            <FileTreeItem 
              key={childName} 
              name={childName} 
              node={childNode as any} 
              depth={depth + 1} 
              fullPath={currentPath} 
              onNodeSelect={onNodeSelect}
              astData={astData}
              selectedNode={selectedNode}
            />
          ))}
          {symbols.map((symbol: any, idx: number) => {
            const isActive = selectedNode?.id === symbol.node.id;
            return (
              <div 
                key={`${symbol.name}-${idx}`}
                onClick={() => onNodeSelect(symbol.node)}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#00f2ff]/10 transition-all group ${isActive ? 'bg-[#00f2ff]/20 text-[#00f2ff] font-bold border-r-2 border-[#00f2ff]' : 'text-slate-600'}`}
                style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
              >
                <i className={`fas ${symbol.node.kind === 'struct' ? 'fa-cube' : 'fa-bolt'} text-[8px] opacity-40`}></i>
                <span className="truncate text-[10px] font-mono group-hover:text-slate-300">
                  {symbol.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
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

  const [dataApiBase, setDataApiBase] = useState<string>(() => {
    return sessionStorage.getItem('gca_data_api_base') || '';
  });

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nodeInsight, setNodeInsight] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<string>("GCA-Sandbox-Default");
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string; name: string; description?: string}>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<'symbol' | 'query'>('symbol');
  const [symbolSearchResults, setSymbolSearchResults] = useState<string[]>([]);
  const [queryResults, setQueryResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // View Modes: force, dagre, radial, circlePacking
  const [viewMode, setViewMode] = useState<'force' | 'dagre' | 'radial' | 'circlePacking'>('force');

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [codePanelWidth, setCodePanelWidth] = useState(500);
  const isResizingSidebar = useRef(false);
  const isResizingCode = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionStorage.setItem('gca_ast_data', JSON.stringify(astData));
  }, [astData]);

  useEffect(() => {
    sessionStorage.setItem('gca_sandbox_files', JSON.stringify(sandboxFiles));
  }, [sandboxFiles]);

  useEffect(() => {
    sessionStorage.setItem('gca_data_api_base', dataApiBase);
  }, [dataApiBase]);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
    script.onload = () => {
      ['go', 'typescript', 'javascript', 'python', 'json', 'rust', 'cpp', 'css', 'html'].forEach(lang => {
        const langScript = document.createElement('script');
        langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
        document.head.appendChild(langScript);
      });
    };
    document.head.appendChild(script);

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX)));
      if (isResizingCode.current) setCodePanelWidth(Math.max(300, Math.min(window.innerWidth * 0.7, window.innerWidth - e.clientX)));
    };

    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      isResizingCode.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const syncDataFromApi = async (baseUrl: string, projectId?: string) => {
    if (!baseUrl) return;
    setIsDataSyncing(true);
    setSyncError(null);
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    try {
      // Fetch all projects
      const projectsRes = await fetch(`${cleanBase}/v1/projects`);
      if (!projectsRes.ok) {
        setSyncError('Failed to fetch projects');
        return;
      }
      
      const projects = await projectsRes.json() as Array<{id: string; name: string; description?: string}>;
      setAvailableProjects(projects);
      
      // Require project selection
      if (!projectId && projects.length > 0) {
        // Auto-select first project if none selected
        projectId = projects[0].id;
        setSelectedProjectId(projectId);
      }
      
      if (!projectId) {
        setSyncError('No projects available');
        return;
      }
      
      setCurrentProject(projects.find(p => p.id === projectId)?.name || projectId);

      // Fetch files for the project
      const filesUrl = `${cleanBase}/v1/files?project=${encodeURIComponent(projectId)}`;
      const filesRes = await fetch(filesUrl);
      if (!filesRes.ok) {
        setSyncError(`Failed to fetch files: ${filesRes.statusText}`);
        return;
      }
      
      const filesData = await filesRes.json();
      const filesList = Array.isArray(filesData) ? filesData : (filesData.files || []);
      setSandboxFiles(prev => ({ ...prev, 'files.json': filesList }));
      
      // Build AST from files list
      if (filesList.length > 0) {
        const astNodes: any[] = [];
        const astLinks: any[] = [];
        
        filesList.forEach((filePath: string) => {
          const fileName = filePath.split('/').pop() || filePath;
          const ext = fileName.split('.').pop()?.toLowerCase();
          const kind = ['py', 'ts', 'js', 'go', 'rs'].includes(ext || '') ? 'function' : 'file';
          
          astNodes.push({
            id: filePath,
            name: fileName,
            type: kind,
            kind: kind,
            start_line: 1,
            end_line: 100,
            code: '',
            _filePath: filePath,
            _project: projectId
          });
        });
        
        setAstData({ nodes: astNodes, links: astLinks });
      }

      // Fetch enriched AST from query endpoint (POST with body)
      try {
        const queryRes = await fetch(`${cleanBase}/v1/query?project=${encodeURIComponent(projectId)}&hydrate=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'triples(?s, "defines", ?o)' })
        });
        
        if (queryRes.ok) {
          const ast = await queryRes.json();
          if (ast && ast.nodes && ast.nodes.length > 0) {
            // Enrich existing nodes with code from query response
            setAstData(prev => {
              const enrichedNodes = prev.nodes.map(node => {
                const enrichedNode = ast.nodes.find((n: any) => n.id === node.id || n.id === node._filePath);
                return enrichedNode ? { ...node, ...enrichedNode, _project: projectId } : { ...node, _project: projectId };
              });
              return { nodes: enrichedNodes, links: ast.links || prev.links };
            });
          }
        }
      } catch (queryErr) {
        console.log('Query endpoint not available, using file-based AST');
      }
    } catch (err: any) {
      console.error("API Sync Error:", err);
      setSyncError(err.message || 'Unknown error during sync');
    } finally {
      setIsDataSyncing(false);
    }
  };

  // Search symbols or run Datalog query via API
  const searchSymbols = useCallback(async (query: string) => {
    if (!dataApiBase || !selectedProjectId || !query || query.length < 1) {
      setSymbolSearchResults([]);
      setQueryResults(null);
      return;
    }
    
    setIsSearching(true);
    setQueryResults(null);
    const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
    
    try {
      if (searchMode === 'query') {
        // POST to /v1/query for Datalog queries
        const res = await fetch(`${cleanBase}/v1/query?project=${encodeURIComponent(selectedProjectId)}&hydrate=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        if (res.ok) {
          const data = await res.json();
          setQueryResults(data);
          if (data.nodes && data.nodes.length > 0) {
            // Update AST with query results
            setAstData(prev => ({
              nodes: data.nodes.map((n: any) => ({ ...n, _project: selectedProjectId })),
              links: data.links || []
            }));
          }
        }
      } else {
        // GET to /v1/symbols for fuzzy search
        const res = await fetch(`${cleanBase}/v1/symbols?project=${encodeURIComponent(selectedProjectId)}&q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSymbolSearchResults(data.symbols || []);
        }
      }
    } catch (e) {
      console.error("Search error:", e);
      setSymbolSearchResults([]);
      setQueryResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [dataApiBase, selectedProjectId, searchMode]);

  const handleNodeSelect = useCallback(async (node: any) => {
    setSelectedNode(node);
    setNodeInsight(null);
    
    const projectId = node._project || selectedProjectId;
    
    if (dataApiBase && projectId && !node.code && node.id) {
      const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
      try {
        const res = await fetch(`${cleanBase}/v1/source?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(node.id)}`);
        if (res.ok) {
          const sourceCode = await res.text();
          setSelectedNode((prev: any) => ({ ...prev, code: sourceCode, _project: projectId }));
        }
      } catch (e) { 
        console.error("Source fetch error:", e); 
      }
    }
  }, [dataApiBase, selectedProjectId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const newSandbox = { ...sandboxFiles };
    const fileList = Array.from(files);
    
    for (const file of fileList) {
      try {
        const text = await (file as File).text();
        let content: any = text;
        const fileName = (file as File).name;
        if (fileName.endsWith('.json')) {
            try {
                content = JSON.parse(text);
            } catch(e) {
                console.warn("Invalid JSON upload", fileName);
                continue;
            }
        }
        const fileNameLower = fileName.toLowerCase();
        
        if (fileNameLower.includes('query') || fileNameLower.includes('symbols') || fileNameLower.includes('nodes')) {
          if (content && typeof content === 'object' && 'nodes' in content) {
            setAstData(content as FlatGraph);
          }
        }
        
        if (fileNameLower.includes('project')) {
          const projectContent = content as any[];
          if (Array.isArray(projectContent) && projectContent[0] && projectContent[0].name) {
            setCurrentProject(projectContent[0].name);
          }
        }

        newSandbox[fileName] = content;
      } catch (err) { console.error(`Error processing file`, err); }
    }
    setSandboxFiles(newSandbox);
    event.target.value = '';
  };

  const sourceTree = useMemo(() => {
    const nodes = (astData as FlatGraph)?.nodes || [];
    const filesJson = sandboxFiles['files.json'];
    const explicitPaths = Array.isArray(filesJson) ? filesJson : [];
    return stratifyPaths(nodes, explicitPaths);
  }, [astData, sandboxFiles]);

  const renderCode = () => {
    if (!selectedNode) return (
      <div className="h-full flex items-center justify-center flex-col gap-4 grayscale opacity-20">
        <i className="fas fa-microchip text-5xl"></i>
        <p className="text-[9px] uppercase font-black tracking-[0.2em]">Select an Asset to Inspect</p>
      </div>
    );

    let code = selectedNode.code;
    if (!code && (selectedNode._isMissingCode || !selectedNode.code)) {
      return (
        <div className="h-full flex items-center justify-center flex-col gap-3 opacity-30 italic">
          <i className="fas fa-file-invoice text-3xl"></i>
          <p className="text-[10px] uppercase font-bold tracking-widest">Source Buffer Unavailable</p>
        </div>
      );
    }
    
    let language = 'go';
    const id = (selectedNode.id || "").toLowerCase();
    if (id.endsWith('.ts') || id.endsWith('.tsx')) language = 'typescript';
    else if (id.endsWith('.js') || id.endsWith('.jsx')) language = 'javascript';
    else if (id.endsWith('.py')) language = 'python';
    else if (id.endsWith('.rs')) language = 'rust';
    else if (id.endsWith('.cpp')) language = 'cpp';

    return <HighlightedCode code={code || "// Code snippet missing."} language={language} startLine={selectedNode.start_line || 1} />;
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a1118] text-slate-400 overflow-hidden font-sans">
      <aside 
        style={{ width: sidebarWidth }}
        className="glass-sidebar flex flex-col z-30 shrink-0 shadow-2xl relative"
      >
        <div className="p-6 border-b border-white/5 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-[#00f2ff] flex items-center justify-center text-[#0a1118] font-black shadow-[0_0_15px_rgba(0,242,255,0.4)]">G</div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight uppercase italic">GCA EXPLORER</h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-tighter">PROJECT ANALYZER</p>
          </div>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2 flex justify-between">
              <span>ACTIVE PROJECT</span>
              {dataApiBase && <i className={`fas fa-plug text-[8px] ${isDataSyncing ? 'text-[#00f2ff] animate-pulse' : 'text-[#10b981]'}`}></i>}
            </h2>
            <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-2 text-[11px] text-white truncate font-medium flex items-center gap-2">
              <i className="fas fa-cube text-[#00f2ff] text-[10px]"></i> {currentProject}
            </div>
          </div>

          <div>
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">SOURCE NAVIGATOR</h2>
            <div className="space-y-0.5 border-l border-white/5 ml-2">
              {Object.entries(sourceTree).map(([name, node]) => (
                <FileTreeItem 
                  key={name} 
                  name={name} 
                  node={node as any} 
                  depth={0} 
                  onNodeSelect={handleNodeSelect}
                  astData={astData}
                  selectedNode={selectedNode}
                />
              ))}
              {Object.keys(sourceTree).length === 0 && (
                <div className="px-4 py-8 text-center text-[10px] text-slate-700 italic border border-dashed border-white/5 rounded mx-2">
                  No files indexed.<br/>Upload AST or configure API.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 bg-[#0d171d] space-y-2">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 bg-[#00f2ff]/5 hover:bg-[#00f2ff]/10 border border-[#00f2ff]/20 rounded text-[9px] font-black uppercase tracking-[0.3em] text-[#00f2ff] transition-all shadow-inner"
          >
            <i className="fas fa-file-import mr-2"></i> Local Import
          </button>
          {dataApiBase && (
            <button 
                onClick={() => syncDataFromApi(dataApiBase)}
                className="w-full py-2 bg-[#10b981]/5 hover:bg-[#10b981]/10 border border-[#10b981]/20 rounded text-[9px] font-black uppercase tracking-[0.3em] text-[#10b981] transition-all shadow-inner"
            >
                <i className="fas fa-sync-alt mr-2"></i> Sync API
            </button>
          )}
        </div>

        <div 
          onMouseDown={() => {
            isResizingSidebar.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center px-6 gap-6 bg-[#0a1118]/90 backdrop-blur-md z-20 shrink-0">
           <div className="flex-1 flex items-center bg-[#16222a] border border-white/5 rounded-full px-1 py-1 max-w-xl shadow-inner relative">
              <button
                onClick={() => setSearchMode(searchMode === 'symbol' ? 'query' : 'symbol')}
                className={`px-3 py-1 rounded-full text-[9px] font-black border transition-all mr-2 uppercase ${
                  searchMode === 'query' 
                    ? 'bg-[#f59e0b] text-[#0a1118] border-[#f59e0b]' 
                    : 'bg-[#0a1118] text-[#00f2ff] border-[#00f2ff]/20'
                }`}
              >
                {searchMode === 'query' ? 'Query' : 'Symbol'}
              </button>
              <input 
               type="text" 
               placeholder={searchMode === 'query' ? 'Datalog query (e.g., triples(?s, \"calls\", ?o))...' : 'Search symbols...'} 
               value={searchTerm}
               onChange={(e) => {
                 setSearchTerm(e.target.value);
                 // Debounce search
                 clearTimeout((e.target as any)._searchTimeout);
                 (e.target as any)._searchTimeout = setTimeout(() => {
                   searchSymbols(e.target.value);
                 }, searchMode === 'query' ? 500 : 300);
               }}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && searchMode === 'query' && searchTerm) {
                   searchSymbols(searchTerm);
                 }
               }}
               className="bg-transparent border-none flex-1 px-4 text-[11px] focus:outline-none text-white font-mono placeholder-slate-700" 
              />
              {isSearching && <i className="fas fa-circle-notch fa-spin text-[#00f2ff] text-[10px] absolute right-12"></i>}
              
              {/* Symbol search results dropdown */}
              {searchMode === 'symbol' && symbolSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d171d] border border-white/10 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
                  {symbolSearchResults.map((symbol, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const node = (astData as FlatGraph)?.nodes?.find((n: any) => n.id === symbol);
                        if (node) handleNodeSelect(node);
                        setSymbolSearchResults([]);
                        setSearchTerm('');
                      }}
                      className="w-full px-4 py-2 text-left text-[10px] font-mono text-slate-300 hover:bg-[#00f2ff]/10 hover:text-[#00f2ff] border-b border-white/5 last:border-0"
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Query results summary */}
              {searchMode === 'query' && queryResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d171d] border border-[#f59e0b]/30 rounded-lg shadow-2xl z-50 p-3">
                  <div className="text-[10px] text-[#f59e0b] font-black uppercase tracking-widest mb-2">
                    Query Results: {queryResults.nodes?.length || 0} nodes, {queryResults.links?.length || 0} links
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setQueryResults(null);
                    }}
                    className="text-[9px] text-slate-500 hover:text-white"
                  >
                    Clear results
                  </button>
                </div>
              )}
              
              {/* Run query button */}
              {searchMode === 'query' && (
                <button
                  onClick={() => searchTerm && searchSymbols(searchTerm)}
                  disabled={!searchTerm || isSearching}
                  className="w-8 h-8 rounded-full bg-[#f59e0b] flex items-center justify-center text-[#0a1118] text-[10px] disabled:opacity-50"
                >
                  <i className="fas fa-play"></i>
                </button>
              )}
              {searchMode === 'symbol' && <button className="w-8 h-8 rounded-full bg-[#00f2ff] flex items-center justify-center text-[#0a1118] text-[10px] shadow-lg shadow-[#00f2ff]/20"><i className="fas fa-filter"></i></button>}
           </div>
          
          <div className="flex items-center bg-[#16222a] border border-white/5 rounded px-2 gap-1">
             {(['force', 'dagre', 'radial', 'circlePacking'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all rounded ${viewMode === mode ? 'bg-[#00f2ff] text-[#0a1118] shadow-[0_0_10px_#00f2ff]' : 'hover:bg-white/5'}`}
                >
                  {mode.replace(/([A-Z])/g, ' $1')}
                </button>
             ))}
          </div>

          <div className="ml-auto flex gap-5 items-center">
             <div className="flex flex-col items-end">
                <span className="text-[10px] text-white font-bold leading-none">Graph Mode</span>
                <span className="text-[8px] text-[#10b981] font-black uppercase tracking-widest">{viewMode.toUpperCase()}_v4</span>
             </div>
             <div className="h-8 w-px bg-white/5"></div>
             <i 
                className="fas fa-cog text-slate-600 hover:text-white cursor-pointer transition-colors text-xs"
                onClick={() => setIsSettingsOpen(true)}
             ></i>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative dot-grid overflow-hidden bg-[#0a1118]">
            <div className="absolute top-4 left-4 z-10 p-3 bg-[#0d171d]/95 backdrop-blur-xl border border-white/10 rounded shadow-2xl min-w-[160px]">
              <h3 className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center justify-between">
                <span>MOUNTED ASSETS</span>
                <span className="text-[#00f2ff]">{Object.keys(sandboxFiles).length}</span>
              </h3>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                 {Object.keys(sandboxFiles).map(f => (
                   <div key={f} className="text-[9px] font-mono text-[#00f2ff]/70 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#00f2ff]/40 shadow-[0_0_5px_#00f2ff]"></div> {f}
                   </div>
                 ))}
                 {Object.keys(sandboxFiles).length === 0 && <span className="text-[9px] text-slate-700 italic">Local cache empty</span>}
              </div>
            </div>
            <TreeVisualizer 
              data={astData} 
              onNodeSelect={handleNodeSelect} 
              onNodeHover={() => {}} 
              mode={viewMode} 
              layoutStyle="organic" 
              selectedId={selectedNode?.id} 
            />
          </div>

          <aside 
            style={{ width: codePanelWidth }}
            className="code-panel flex flex-col shrink-0 border-l border-white/10 shadow-2xl z-10 relative bg-[#0d171d]"
          >
            <div 
              onMouseDown={() => {
                isResizingCode.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
            />

            <header className="h-12 px-5 border-b border-white/5 flex items-center justify-between bg-[#0a1118] shrink-0">
              <div className="flex items-center gap-3 overflow-hidden mr-4">
                 <i className="fas fa-terminal text-[#00f2ff] text-[12px]"></i>
                 <span className="text-[10px] font-mono text-slate-300 truncate uppercase tracking-tighter">{selectedNode?.id || "IDLE"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                 <div className="text-[8px] font-black px-2 py-0.5 rounded bg-[#00f2ff]/5 border border-[#00f2ff]/20 text-[#00f2ff] uppercase tracking-widest">
                    {selectedNode?.kind || "raw"}
                 </div>
              </div>
            </header>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
               {renderCode()}
            </div>

            <div className="h-64 border-t border-white/10 p-5 bg-[#0a1118] shadow-2xl flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                   <div className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse shadow-[0_0_8px_#00f2ff]"></div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">GenAI SYNTHESIS</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsInsightLoading(true);
                    getGeminiInsight(selectedNode).then(i => {
                      setNodeInsight(i);
                      setIsInsightLoading(false);
                    }).catch(() => {
                      setIsInsightLoading(false);
                      setNodeInsight("Analysis connection failed.");
                    });
                  }}
                  disabled={isInsightLoading || !selectedNode}
                  className="px-4 py-2 bg-[#00f2ff] text-[#0a1118] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-20 transition-all shadow-[0_4px_15_rgba(0,242,255,0.2)]"
                >
                  {isInsightLoading ? <i className="fas fa-circle-notch animate-spin"></i> : "Generate Insights"}
                </button>
              </div>
              <div className="flex-1 bg-[#0d171d] p-4 rounded border border-white/5 text-[11px] text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar font-mono">
                {nodeInsight ? nodeInsight : (
                  <div className="flex flex-col items-center justify-center h-full opacity-10 gap-3 grayscale">
                    <i className="fas fa-brain text-4xl"></i>
                    <p className="text-[10px] uppercase font-black tracking-[0.4em]">Inference Engine Standby</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <footer className="h-10 border-t border-white/5 flex items-center px-6 gap-8 bg-[#0a1118] text-[9px] shrink-0 font-mono tracking-widest">
          <div className="text-slate-600">ARTIFACTS: <span className="text-[#00f2ff] font-bold">{(astData as FlatGraph)?.nodes?.length || 0}</span></div>
          <div className="text-slate-600">RELATIONS: <span className="text-[#00f2ff] font-bold">{(astData as FlatGraph)?.links?.length || 0}</span></div>
          <div className="text-slate-600">ENDPOINT: <span className="text-[#10b981] font-bold uppercase truncate max-w-[100px]">{dataApiBase ? new URL(dataApiBase).hostname : 'NONE'}</span></div>
          <div className="ml-auto flex items-center gap-3 text-slate-700">
             <span className="uppercase tracking-tighter font-black italic">Gem-Code-V2.1</span>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
          </div>
        </footer>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4">
          <div className="bg-[#0d171d] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-sm font-black uppercase tracking-widest text-white">System Configuration</h3>
               <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-6 space-y-4">
                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Data API Base URL</label>
                   <input 
                     type="text" 
                     value={dataApiBase}
                     onChange={(e) => {
                       setDataApiBase(e.target.value);
                       setAvailableProjects([]);
                       setSelectedProjectId('');
                     }}
                     placeholder="http://localhost:8080"
                     className="w-full bg-[#0a1118] border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f2ff]/50 font-mono"
                   />
                    <p className="mt-2 text-[9px] text-slate-600 leading-normal">
                      This endpoint will be used to fetch /v1/projects, /v1/files, and optionally /v1/query.
                    </p>
                 </div>
                 
                 {availableProjects.length > 0 && (
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Select Project</label>
                     <select 
                       value={selectedProjectId}
                       onChange={(e) => {
                         setSelectedProjectId(e.target.value);
                         setCurrentProject(availableProjects.find(p => p.id === e.target.value)?.name || e.target.value);
                       }}
                       className="w-full bg-[#0a1118] border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f2ff]/50"
                     >
                       <option value="">-- Select a project --</option>
                       {availableProjects.map((project) => (
                         <option key={project.id} value={project.id}>
                           {project.name} {project.description ? `- ${project.description}` : ''}
                         </option>
                       ))}
                     </select>
                     <p className="mt-2 text-[9px] text-slate-600 leading-normal">
                       Choose which project to load from the API.
                     </p>
                   </div>
                 )}
                
                {syncError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    {syncError}
                  </div>
                )}
                
                {isDataSyncing && (
                  <div className="p-3 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded flex items-center gap-2 text-[10px] text-[#00f2ff]">
                    <i className="fas fa-sync fa-spin"></i>
                    Syncing with API...
                  </div>
                )}
             </div>
             <div className="p-6 bg-[#0a1118]/50 flex justify-end gap-3">
                 <button 
                   onClick={() => syncDataFromApi(dataApiBase, selectedProjectId || undefined)}
                   className="px-6 py-2 bg-[#10b981] text-[#0a1118] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                 >
                  Save & Sync
                </button>
               <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;