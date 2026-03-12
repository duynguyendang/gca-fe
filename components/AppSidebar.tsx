import React from 'react';
import { FlatGraph, ASTNode } from '../types';
import FileTreeItem from './FileTreeItem';
import { stratifyPaths } from '../utils/graphUtils';

interface AppSidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  currentProject: string;
  availableProjects: Array<{ id: string; name: string; description?: string }>;
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  dataApiBase: string;
  isDataSyncing: boolean;
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
          ) : (
            <div className="w-full bg-[#16222a] border border-white/5 rounded px-3 py-2 text-[11px] text-white truncate font-medium flex items-center gap-2">
              <i className="fas fa-cube text-[var(--accent-teal)] text-[10px]"></i>
              {currentProject}
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
                No files indexed.<br />Upload AST or configure API.
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
