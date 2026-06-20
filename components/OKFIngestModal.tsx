/**
 * OKFIngestModal — Modal for ingesting OKF bundles.
 * Project selector + bundle directory input + Ingest button + result display.
 */
import React, { useState, useEffect, useRef } from 'react';
import { ingestOKFBundle } from '../services/graphService';
import { OKF_COLORS } from '../theme';
import type { OKFIngestReport } from '../types';

interface OKFIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataApiBase: string;
  selectedProjectId: string;
  availableProjects: Array<{ id: string; name: string; description?: string }>;
  onSuccess?: () => void;
}

export const OKFIngestModal: React.FC<OKFIngestModalProps> = ({
  isOpen,
  onClose,
  dataApiBase,
  selectedProjectId,
  availableProjects,
  onSuccess,
}) => {
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [bundleDir, setBundleDir] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [report, setReport] = useState<OKFIngestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectId(selectedProjectId);
      setBundleDir('');
      setReport(null);
      setError(null);
      closeButtonRef.current?.focus();
    }
  }, [isOpen, selectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleIngest = async () => {
    if (!projectId || !bundleDir.trim()) return;
    setIngesting(true);
    setError(null);
    setReport(null);
    try {
      const result = await ingestOKFBundle(dataApiBase, projectId, bundleDir.trim());
      setReport(result);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Ingest failed');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ingest OKF Bundle"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            <i className="fas fa-upload mr-2" style={{ color: OKF_COLORS.NODE }}></i>
            Ingest OKF Bundle
          </h3>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--accent-teal)]/50"
            >
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name || p.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Bundle Directory</label>
            <input
              type="text"
              value={bundleDir}
              onChange={e => setBundleDir(e.target.value)}
              placeholder="/path/to/bundle"
              className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--accent-teal)]/50"
            />
            <p className="mt-1 text-[9px] text-slate-600">Absolute path to the OKF bundle directory on the server.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {report && (
            <div className="space-y-2 p-3 bg-[var(--bg-main)] rounded border border-white/5">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-[var(--accent-teal)]">{report.concepts}</span> <span className="text-slate-500">concepts</span></div>
                <div><span className="text-[var(--accent-teal)]">{report.links}</span> <span className="text-slate-500">links</span></div>
                <div><span className="text-[var(--accent-teal)]">{report.bridges}</span> <span className="text-slate-500">bridges</span></div>
                <div><span className="text-[var(--accent-teal)]">{report.bridge_misses}</span> <span className="text-slate-500">bridge misses</span></div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${report.conformant ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {report.conformant ? '✓ CONFORMANT' : '✗ NON-CONFORMANT'}
                </span>
                <span className="text-[9px] text-slate-600">{report.duration}</span>
              </div>
              {report.errors.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto custom-scrollbar">
                  <p className="text-[9px] text-red-400 font-bold mb-1">Errors:</p>
                  {report.errors.map((e, i) => (
                    <p key={i} className="text-[9px] text-red-400/70 font-mono">{e.file}: {e.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end gap-3">
          <button
            onClick={handleIngest}
            disabled={ingesting || !projectId || !bundleDir.trim()}
            className="px-6 py-2 bg-[var(--accent-teal)] text-[var(--bg-main)] rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ingesting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Ingesting...</> : 'Ingest'}
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Close</button>
        </div>
      </div>
    </div>
  );
};

export default OKFIngestModal;