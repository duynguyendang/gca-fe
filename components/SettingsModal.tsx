import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataApiBase: string;
  onDataApiBaseChange: (url: string) => void;
  enableAutoClustering: boolean;
  onAutoClusteringToggle: () => void;
  syncError: string | null;
  isDataSyncing: boolean;
  availableProjects: any[];
  onConnect: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dataApiBase,
  onDataApiBaseChange,
  enableAutoClustering,
  onAutoClusteringToggle,
  syncError,
  isDataSyncing,
  availableProjects,
  onConnect,
}) => {
  if (!isOpen) return null;

  const isValidUrl = (url: string) => {
    try {
      new URL(url, window.location.origin);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={() => {}}>
      <div className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">System Configuration</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* API URL Input */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Data API Base URL
            </label>
            <input
              type="text"
              value={dataApiBase}
              onChange={(e) => {
                onDataApiBaseChange(e.target.value);
              }}
              placeholder="https://gca-be-180036253374.us-central1.run.app"
              className={`w-full bg-[var(--bg-main)] border rounded px-4 py-2.5 text-xs text-white focus:outline-none font-mono ${dataApiBase && isValidUrl(dataApiBase) ? 'border-white/10 focus:border-[var(--accent-teal)]/50' : 'border-red-500/50 focus:border-red-500'}`}
            />
            {dataApiBase && !isValidUrl(dataApiBase) && (
              <p className="mt-2 text-[9px] text-red-400">
                <i className="fas fa-exclamation-circle mr-1"></i>
                Invalid URL format.
              </p>
            )}
            <p className="mt-2 text-[9px] text-slate-600 leading-normal">
              This endpoint will be used to fetch /v1/projects, /v1/files, and /v1/query.
              <br />After connecting, select a project from the sidebar dropdown.
            </p>
          </div>

          {/* Auto-Cluster Toggle */}
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Auto-Cluster Large Graphs
              </label>
              <div
                className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${enableAutoClustering ? 'bg-[#10b981]' : 'bg-slate-700'}`}
                onClick={onAutoClusteringToggle}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enableAutoClustering ? 'left-4.5' : 'left-0.5'}`} style={{ left: enableAutoClustering ? '18px' : '2px' }}></div>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 leading-normal">
              Automatically switch to <strong>Map View</strong> (Clustered) when a project has more than 300 nodes to prevent performance issues.
            </p>
          </div>

          {/* Status Messages */}
          {syncError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {syncError}
            </div>
          )}

          {isDataSyncing && (
            <div className="p-3 bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/30 rounded flex items-center gap-2 text-[10px] text-[var(--accent-teal)]">
              <i className="fas fa-sync fa-spin"></i>
              Connecting to API...
            </div>
          )}

          {!isDataSyncing && availableProjects.length > 0 && (
            <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded text-[10px] text-[#10b981]">
              <i className="fas fa-check-circle mr-2"></i>
              Connected! Found {availableProjects.length} project(s). Select one from the sidebar.
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end gap-3">
          <button
            onClick={onConnect}
            className="px-6 py-2 bg-[#10b981] text-[var(--bg-main)] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            Connect & Fetch Projects
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
