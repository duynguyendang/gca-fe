import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSettingsContext } from '../context/SettingsContext';
import { ingestOKFBundle } from '../services/graphService';
import type { OKFIngestReport } from '../types';

interface OKFIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const OKFIngestModal: React.FC<OKFIngestModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { dataApiBase, selectedProjectId, availableProjects } = useSettingsContext();
  const [bundleDir, setBundleDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OKFIngestReport | null>(null);
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

  const handleIngest = useCallback(async () => {
    if (!dataApiBase || !selectedProjectId || !bundleDir.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const report = await ingestOKFBundle(dataApiBase, selectedProjectId, bundleDir.trim());
      setResult(report);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dataApiBase, selectedProjectId, bundleDir, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ingest OKF Bundle"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            <i className="fas fa-upload mr-2 text-green-400"></i>
            Ingest OKF Bundle
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Project selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Target Project
            </label>
            <div className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono">
              {selectedProjectId || 'No project selected'}
            </div>
          </div>

          {/* Bundle directory */}
          <div>
            <label htmlFor="bundle-dir" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Bundle Directory (absolute path)
            </label>
            <input
              id="bundle-dir"
              type="text"
              value={bundleDir}
              onChange={e => setBundleDir(e.target.value)}
              placeholder="/path/to/okf-bundle"
              className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-green-500/50"
            />
            <p className="mt-1 text-[9px] text-slate-600">
              Absolute path to a directory containing OKF markdown bundle files.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
                <i className="fas fa-check-circle"></i> Ingest Complete
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mt-3">
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-lg font-bold text-white">{result.concepts}</div>
                  <div className="text-[9px] text-slate-500">Concepts</div>
                </div>
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-lg font-bold text-white">{result.links}</div>
                  <div className="text-[9px] text-slate-500">Links</div>
                </div>
                <div className="bg-[var(--bg-main)] rounded p-2">
                  <div className="text-lg font-bold text-white">{result.bridges}</div>
                  <div className="text-[9px] text-slate-500">Bridges</div>
                </div>
              </div>
              {result.conformant && (
                <div className="flex items-center gap-1 text-[10px] text-green-400 mt-2">
                  <i className="fas fa-badge-check"></i> Bundle is conformant
                </div>
              )}
              {result.bridge_misses > 0 && (
                <div className="text-[10px] text-amber-400">
                  <i className="fas fa-link-slash mr-1"></i>{result.bridge_misses} bridge miss(es)
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto">
                  <div className="text-[10px] text-red-400 font-bold mb-1">Errors:</div>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[9px] text-red-400/80 font-mono">{e.file}: {e.reason}</div>
                  ))}
                </div>
              )}
              <div className="text-[9px] text-slate-600">Duration: {result.duration}</div>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end gap-3">
          <button
            onClick={handleIngest}
            disabled={loading || !bundleDir.trim() || !selectedProjectId}
            className="px-6 py-2 bg-green-600 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Ingesting...</>
            ) : (
              <><i className="fas fa-upload mr-2"></i>Ingest</>
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

export default OKFIngestModal;
