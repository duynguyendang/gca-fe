/**
 * ReviewSessionModal — Modal for creating and querying ephemeral review sessions.
 * Paste a git diff → create session → run Datalog queries against diff + project facts.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createReviewSession, queryReviewSession } from '../../services/reviewService';
import { logger } from '../../logger';
import type { ReviewSessionCreateResponse, ReviewSessionQueryResponse } from '../../types';

interface ReviewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataApiBase: string;
  selectedProjectId: string;
}

export const ReviewSessionModal: React.FC<ReviewSessionModalProps> = ({
  isOpen,
  onClose,
  dataApiBase,
  selectedProjectId,
}) => {
  const [diff, setDiff] = useState('');
  const [baseCommit, setBaseCommit] = useState('');
  const [headCommit, setHeadCommit] = useState('');
  const [session, setSession] = useState<ReviewSessionCreateResponse | null>(null);
  const [query, setQuery] = useState('triples(?S, ?P, ?O)');
  const [results, setResults] = useState<ReviewSessionQueryResponse | null>(null);
  const [loading, setLoading] = useState<'creating' | 'querying' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ephemeral: true,
    source: false,
    analytical: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDiff('');
      setBaseCommit('');
      setHeadCommit('');
      setSession(null);
      setQuery('triples(?S, ?P, ?O)');
      setResults(null);
      setError(null);
      setExpandedSections({ ephemeral: true, source: false, analytical: false });
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!diff.trim() || !selectedProjectId) return;
    setLoading('creating');
    setError(null);
    setSession(null);
    setResults(null);
    try {
      const result = await createReviewSession(
        dataApiBase,
        selectedProjectId,
        diff.trim(),
        baseCommit.trim() || undefined,
        headCommit.trim() || undefined,
      );
      setSession(result);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(null);
    }
  };

  const handleQuery = async () => {
    if (!session || !query.trim() || !selectedProjectId) return;
    setLoading('querying');
    setError(null);
    setResults(null);
    try {
      const result = await queryReviewSession(
        dataApiBase,
        session.session_id,
        query.trim(),
        selectedProjectId,
      );
      setResults(result);
    } catch (err: any) {
      setError(err.message || 'Query failed');
    } finally {
      setLoading(null);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTable = (rows: Array<Record<string, string>>, label: string) => {
    if (!rows || rows.length === 0) {
      return <div className="text-[10px] text-slate-600 py-2">No results</div>;
    }
    const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    return (
      <div className="overflow-auto max-h-48 custom-scrollbar">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-white/10">
              {keys.map(k => (
                <th key={k} className="text-left px-2 py-1 text-slate-500 font-bold uppercase">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                {keys.map(k => (
                  <td key={k} className="px-2 py-1 text-slate-300 max-w-[200px] truncate">{row[k] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 50 && (
          <div className="text-[9px] text-slate-600 py-1 px-2">Showing 50 of {rows.length} rows</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review Session"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            <i className="fas fa-code-compare mr-2 text-orange-400"></i>
            Review Session
          </h3>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!session ? (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Git Diff</label>
                <textarea
                  value={diff}
                  onChange={e => setDiff(e.target.value)}
                  placeholder="Paste your unified diff here..."
                  rows={10}
                  className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Base Commit (optional)</label>
                  <input
                    type="text"
                    value={baseCommit}
                    onChange={e => setBaseCommit(e.target.value)}
                    placeholder="abc1234"
                    className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Head Commit (optional)</label>
                  <input
                    type="text"
                    value={headCommit}
                    onChange={e => setHeadCommit(e.target.value)}
                    placeholder="def5678"
                    className="w-full bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-400 space-y-1">
                <div><span className="font-bold">Session:</span> <span className="font-mono">{session.session_id.slice(0, 16)}...</span></div>
                <div><span className="font-bold">Facts parsed:</span> {session.facts_parsed}</div>
                <div><span className="font-bold">Expires:</span> {new Date(session.expires_at).toLocaleTimeString()}</div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Datalog Query</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="triples(?S, ?P, ?O)"
                    className="flex-1 bg-[var(--bg-main)] border border-white/10 rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
                    onKeyDown={e => e.key === 'Enter' && handleQuery()}
                  />
                  <button
                    onClick={handleQuery}
                    disabled={loading === 'querying' || !query.trim()}
                    className="px-4 py-2 bg-orange-600 text-white rounded text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === 'querying' ? <i className="fas fa-spinner fa-spin"></i> : 'Run'}
                  </button>
                </div>
              </div>

              {results && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500">{results.total_facts} total facts across stores</div>

                  {(['ephemeral', 'source', 'analytical'] as const).map(key => (
                    <div key={key} className="border border-white/10 rounded overflow-hidden">
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-main)] hover:bg-white/5 transition-colors text-[10px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        <span>
                          <i className={`fas fa-chevron-${expandedSections[key] ? 'down' : 'right'} mr-2 text-[8px]`}></i>
                          {key} ({results[key]?.length || 0})
                        </span>
                      </button>
                      {expandedSections[key] && (
                        <div className="bg-[var(--bg-main)]/50">
                          {renderTable(results[key] || [], key)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}
        </div>

        <div className="p-4 bg-[var(--bg-main)]/50 flex justify-end gap-3 shrink-0 border-t border-white/5">
          {!session ? (
            <button
              onClick={handleCreate}
              disabled={loading === 'creating' || !diff.trim()}
              className="px-6 py-2 bg-orange-600 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'creating' ? <><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</> : 'Create Session'}
            </button>
          ) : (
            <button
              onClick={() => { setSession(null); setResults(null); setDiff(''); }}
              className="px-6 py-2 bg-slate-700 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-600 transition-all"
            >
              New Session
            </button>
          )}
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ReviewSessionModal;
