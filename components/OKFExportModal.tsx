import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSettingsContext } from '../context/SettingsContext';
import { exportOKFBundle } from '../services/graphService';
import type { OKFExportReport } from '../types';

interface OKFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OKFExportModal: React.FC<OKFExportModalProps> = ({ isOpen, onClose }) => {
  const { dataApiBase, selectedProjectId } = useSettingsContext();
  const [scope, setScope] = useState<'file' | 'package' | 'cluster'>('file');
  const [outDir, setOutDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OKFExportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleExport = useCallback(async () => {
    if (!dataApiBase || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const dir = outDir.trim() || `./data/exports/${selectedProjectId}`;

    try {
      const report = await exportOKFBundle(dataApiBase, selectedProjectId, scope, dir);
      setResult(report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dataApiBase, selectedProjectId, scope, outDir]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export OKF Bundle"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            <i className="fas fa-download mr-2 text-blue-400"></i>
            Export OKF Bundle
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Project */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Source Project</label>
            <div className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono">
              {selectedProjectId || 'No project selected'}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Export Scope</label>
            <div className="flex gap-2">
              {(['file', 'package', 'cluster'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-4 py-2 rounded text-xs font-medium transition-colors ${
                    scope === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--bg-main)] border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Output dir */}
          <div>
            <label htmlFor="out-dir" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Output Directory
            </label>
            <input
              id="out-dir"
              type="text"
              value={outDir}
              onChange={e => setOutDir(e.target.value)}
              placeholder={`./data/exports/${selectedProjectId || '<project>'}`}
              className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold mb-3">
                <i className="fas fa-check-circle"></i> Export Complete
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-lg font-bold text-white">{result.concepts_written}</div>
                  <div className="text-[9px] text-slate-500">Concepts</div>
                </div>
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-lg font-bold text-white">{result.files_written}</div>
                  <div className="text-[9px] text-slate-500">Files</div>
                </div>
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-sm font-bold text-white">{result.duration}</div>
                  <div className="text-[9px] text-slate-500">Duration</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end gap-3">
          <button
            onClick={handleExport}
            disabled={loading || !selectedProjectId}
            className="px-6 py-2 bg-blue-600 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Exporting...</>
            ) : (
              <><i className="fas fa-download mr-2"></i>Export</>
            )}
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

export default OKFExportModal;
