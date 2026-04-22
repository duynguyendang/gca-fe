import React, { useState, useMemo } from 'react';
import { FileHealth } from '../../types';

interface RiskLeaderboardProps {
  files: FileHealth[] | null | undefined;
  onAskAI: (file: FileHealth) => void;
}

const PAGE_SIZE = 50;

export const RiskLeaderboard: React.FC<RiskLeaderboardProps> = ({ files, onAskAI }) => {
  const [sortKey, setSortKey] = useState<'total_debt_score' | 'file_name' | 'security_issues'>('total_debt_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const handleSort = (key: 'total_debt_score' | 'file_name' | 'security_issues') => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
    setPage(0);
  };

  const sortedFiles = useMemo(() => {
    if (!files || files.length === 0) return [];
    return [...files].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'total_debt_score' || sortKey === 'security_issues') {
        cmp = a[sortKey] - b[sortKey];
      } else {
        cmp = a.file_name.localeCompare(b.file_name);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [files, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedFiles.length / PAGE_SIZE);
  const paginatedFiles = useMemo(
    () => sortedFiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedFiles, page]
  );

  const getDebtColor = (score: number) => {
    if (score > 20) return 'text-red-400';
    if (score > 10) return 'text-orange-400';
    return 'text-slate-400';
  };

  const getDebtBgColor = (score: number) => {
    if (score > 20) return 'bg-red-500/20';
    if (score > 10) return 'bg-orange-500/20';
    return 'bg-slate-500/20';
  };

  const getDebtBarWidth = (score: number) => {
    // Cap visual width at 100% for scores > 50
    const maxDisplay = 50;
    return Math.min((score / maxDisplay) * 100, 100);
  };

  const SortIcon = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => (
    <i className={`fas fa-sort-${active ? (direction === 'asc' ? 'up' : 'down') : 'none'} ml-1 text-xs`}></i>
  );

  return (
    <div className="flex flex-col p-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Risk Leaderboard ({(files?.length ?? 0)} files)
        </h3>
        <span className="text-[10px] text-slate-600">Sorted by {sortKey} ({sortDirection})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('file_name')}
              >
                File Path <SortIcon active={sortKey === 'file_name'} direction={sortDirection} />
              </th>
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('total_debt_score')}
              >
                Debt Score <SortIcon active={sortKey === 'total_debt_score'} direction={sortDirection} />
              </th>
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('security_issues')}
              >
                Issues <SortIcon active={sortKey === 'security_issues'} direction={sortDirection} />
              </th>
              <th className="text-left py-3 px-2 text-slate-400 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFiles.map((file, idx) => (
              <tr
                key={idx}
                className="border-b border-[var(--border)]/50 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-2 font-mono text-xs text-slate-300 max-w-xs truncate" title={file.file_name}>
                  {file.file_name}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${getDebtColor(file.total_debt_score)}`}>
                      {file.total_debt_score}
                    </span>
                    <div className={`w-16 h-1.5 rounded-full ${getDebtBgColor(file.total_debt_score)} overflow-hidden`}>
                      <div
                        className={`h-full rounded-full ${file.total_debt_score > 20 ? 'bg-red-500' : file.total_debt_score > 10 ? 'bg-orange-500' : 'bg-slate-500'}`}
                        style={{ width: `${getDebtBarWidth(file.total_debt_score)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-1">
                    {file.security_issues > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">Security</span>
                    )}
                    {file.arch_smells.slice(0, 3).map((smell, si) => (
                      <span key={si} className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">{smell}</span>
                    ))}
                    {file.arch_smells.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">+{file.arch_smells.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <button
                    onClick={() => onAskAI(file)}
                    className="px-3 py-1.5 text-xs bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 rounded-lg text-[var(--accent-blue)] transition-colors flex items-center gap-1.5"
                  >
                    <i className="fas fa-wand-magic-sparkles text-[8px]"></i>
                    Ask AI
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(files?.length ?? 0) === 0 && (
        <div className="text-center py-8 text-slate-500">
          <i className="fas fa-check-circle text-2xl mb-2 text-emerald-500"></i>
          <p>No risk files detected</p>
          <p className="text-xs mt-1">Your codebase looks healthy</p>
        </div>
      )}

      {(files?.length ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i className="fas fa-chevron-left mr-1"></i>Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next<i className="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default RiskLeaderboard;