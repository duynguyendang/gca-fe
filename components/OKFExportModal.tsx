/**
 * OKFExportModal — Modal for exporting OKF bundles.
 * Project selector + scope selector + output directory + Export button + result.
 */
import React, { useState, useEffect, useRef } from 'react';
import { exportOKFBundle } from '../services/graphService';
import { OKF_COLORS } from '../theme';
import type { OKFExportReport } from '../types';

interface OKFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataApiBase: string;
  selectedProjectId: string;
  availableProjects: Array<{ id: string; name: string; description?: string }>;
}

export const OKFExportModal: React.FC<OKFExportModalProps> = ({
  isOpen,
  onClose,
  dataApiBase,
  selectedProjectId,
  availableProjects,
}) => {
  const [projectId, setProjectId] = useState(selectedProjectId);
  const [scope, setScope] = useState<'file' | 'package' | 'cluster'>('file');
  const [outDir, setOutDir] = useState('');
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<OKFExportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectId(selectedProjectId);
      setScope('file');
      setOutDir(`./data/exports/${selectedProjectId}`);
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

  const handleExport = async () => {
    if (!projectId) return;
    setExporting(true);
    setError(null);
    setReport(null);
    try {
      const result = await exportOKFBundle(dataApiBase, projectId, scope, outDir || `./data/exports/${projectId}`);
      setReport(result);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
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
        aria-label="Export OKF Bundle"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            <i className="fas fa-download mr-2" style={{ color: OKF_COLORS.BRIDGE_EDGE }}></i>
            Export OKF Bundle
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
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Scope</label>
            <div className="flex gap-3">
              {(['file', 'package', 'cluster'] as const).map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === s}
                    onChange={() => setScope(s)}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span className="text-xs text-slate-300 capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Output Directory</label>
            <input
              type="text"
              value={outDir}
              onChange={e => setOutDir(e.target.value)}
              placeholder={`./data/exports/${projectId}`}
              className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[var(--accent-teal)]/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {report && (
            <div className="space-y-2 p-3 bg-[var(--bg-main)] rounded border border-white/5">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-[var(--accent-teal)]">{report.concepts_written}</span> <span className="text-slate-500">concepts written</span></div>
                <div><span className="text-[var(--accent-teal)]">{report.files_written}</span> <span className="text-slate-500">files written</span></div>
              </div>
              <div className="text-[9px] text-slate-600">{report.duration}</div>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || !projectId}
            className="px-6 py-2 bg-purple-600 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Exporting...</> : 'Export'}
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Close</button>
        </div>
      </div>
    </div>
  );
};

export default OKFExportModal;