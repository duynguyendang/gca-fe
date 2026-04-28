import React from 'react';
import { FlatGraph, ASTNode } from '../types';
import FileTreeItem from './FileTreeItem';
import { stratifyPaths } from '../utils/graphUtils';
import { CUSTOM_EVENTS } from '../constants';

interface AppSidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  currentProject: string;
  availableProjects: Array<{ id: string; name: string; description?: string }>;
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  dataApiBase: string;
  isDataSyncing: boolean;
  syncError: string | null;
  astData: FlatGraph | null;
  sandboxFiles: Record<string, any>;
  onNodeSelect: (node: any, isNavigation?: boolean) => void;
  selectedNode: ASTNode | null;
  onSyncApi: () => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
  width,
  onResizeStart,
  currentProject,
  availableProjects,
  selectedProjectId,
  onProjectChange,
  dataApiBase,
  isDataSyncing,
  syncError,
  astData,
  sandboxFiles,
  onNodeSelect,
  selectedNode,
  onSyncApi,
}) => {
  const sourceTree = React.useMemo(() => {
    const nodes = astData?.nodes || [];
    const filesJson = sandboxFiles['files.json'];
    const explicitPaths = Array.isArray(filesJson) ? filesJson : [];
    return stratifyPaths(nodes, explicitPaths);
  }, [astData, sandboxFiles]);

  return (
    <aside
      style={{ width }}
      className="glass-sidebar flex flex-col z-30 shrink-0 shadow-2xl relative"
    >
      <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        <div>
          <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2 flex justify-between">
            <span>ACTIVE PROJECT</span>
            {dataApiBase && (
              <i className={`fas fa-plug text-[8px] ${isDataSyncing ? 'text-[var(--accent-teal)] animate-pulse' : 'text-[#10b981]'}`}></i>
            )}
          </h2>

          {availableProjects.length > 0 ? (
            <select
              value={selectedProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-2 text-[11px] text-white focus:outline-none focus:border-[var(--accent-teal)]/50 font-mono"
            >
              <option value="">-- Select a project --</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.description ? `- ${project.description}` : ''}
                </option>
              ))}
            </select>
          ) : isDataSyncing ? (
            <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-3 text-[11px] text-slate-400 font-medium flex items-center gap-2">
              <i className="fas fa-spinner fa-spin text-[var(--accent-teal)] text-[10px]"></i>
              Connecting to backend...
            </div>
          ) : !dataApiBase ? (
            <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-3 text-[10px] text-slate-500 font-medium space-y-2">
              <div className="flex items-center gap-2">
                <i className="fas fa-info-circle text-[var(--accent-teal)] text-[10px]"></i>
                <span className="font-bold text-slate-400">No Backend Connected</span>
              </div>
              <p className="text-[9px] leading-relaxed">
                Open Settings (⚙) to configure the API URL, or run:<br/>
                <code className="bg-black/30 px-1 rounded text-[var(--accent-teal)]">gca server</code>
              </p>
            </div>
          ) : (
            <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-3 text-[10px] text-slate-500 font-medium space-y-2">
              <div className="flex items-center gap-2">
                <i className="fas fa-database text-amber-500 text-[10px]"></i>
                <span className="font-bold text-slate-400">No Projects Found</span>
              </div>
              <p className="text-[9px] leading-relaxed">
                Index a codebase with:<br/>
                <code className="bg-black/30 px-1 rounded text-[var(--accent-teal)]">gca ingest ./repo ./data</code>
              </p>
            </div>
          )}

          {syncError && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-400 space-y-2">
              <div className="flex items-start gap-2">
                <i className="fas fa-exclamation-circle text-[10px] mt-0.5 shrink-0"></i>
                <span className="leading-relaxed flex-1 break-all">{syncError}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onSyncApi}
                  className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-[8px] font-black uppercase tracking-widest text-red-400 transition-all"
                >
                  <i className="fas fa-redo mr-1.5"></i>Retry
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_SETTINGS));
                  }}
                  className="flex-1 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded text-[8px] font-black uppercase tracking-widest text-slate-400 transition-all"
                >
                  <i className="fas fa-cog mr-1.5"></i>Settings
                </button>
              </div>
            </div>
          )}
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
                onNodeSelect={onNodeSelect}
                astData={astData}
                selectedNode={selectedNode}
              />
            ))}
            {Object.keys(sourceTree).length === 0 && (
              <div className="px-4 py-8 text-center text-[10px] text-slate-700 italic border border-dashed border-white/5 rounded mx-2">
                No files found.<br />Connect to a backend and ingest a project.
                {!dataApiBase && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_SETTINGS));
                    }}
                    className="block mx-auto mt-2 px-3 py-1 text-[9px] text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 rounded hover:bg-[var(--accent-teal)]/10 transition-colors"
                  >
                    Configure API
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 shrink-0 bg-[var(--bg-surface)] space-y-2">
        {dataApiBase && (
          <button
            onClick={onSyncApi}
            className="w-full py-2 bg-[#10b981]/5 hover:bg-[#10b981]/10 border border-[#10b981]/20 rounded text-[9px] font-black uppercase tracking-[0.3em] text-[#10b981] transition-all shadow-inner"
          >
            <i className="fas fa-sync-alt mr-2"></i> Sync API
          </button>
        )}
      </div>

      <div
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent-teal)]/20 active:bg-[var(--accent-teal)]/50 transition-colors z-40"
      />
    </aside>
  );
};

export default AppSidebar;
