import React, { useState, useMemo } from 'react';

export interface SmellItem {
  id: string;
  file: string;
  smell_type: string;
  severity: 'High' | 'Medium' | 'Low';
}

interface SmellsListProps {
  smells: SmellItem[];
}

const PAGE_SIZE = 50;

type SortKey = 'file' | 'smell_type' | 'severity';
type SortDirection = 'asc' | 'desc';

const severityOrder = { High: 3, Medium: 2, Low: 1 };

export const SmellsList: React.FC<SmellsListProps> = ({ smells }) => {
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(0); // Reset to first page on sort change
  };

  const sortedSmells = useMemo(() => {
    return [...smells].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'severity') {
        cmp = severityOrder[a.severity] - severityOrder[b.severity];
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [smells, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedSmells.length / PAGE_SIZE);
  const paginatedSmells = useMemo(
    () => sortedSmells.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedSmells, page]
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const SortIcon = ({ active, direction }: { active: boolean; direction: SortDirection }) => (
    <i className={`fas fa-sort-${active ? (direction === 'asc' ? 'up' : 'down') : 'none'} ml-1 text-xs`}></i>
  );

  return (
    <div className="flex flex-col p-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Code Smells ({smells.length})
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('file')}
              >
                File <SortIcon active={sortKey === 'file'} direction={sortDirection} />
              </th>
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('smell_type')}
              >
                Smell Type <SortIcon active={sortKey === 'smell_type'} direction={sortDirection} />
              </th>
              <th
                className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('severity')}
              >
                Severity <SortIcon active={sortKey === 'severity'} direction={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedSmells.map((smell) => (
              <tr
                key={smell.id}
                className="border-b border-[var(--border)]/50 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-2 font-mono text-xs text-slate-300 max-w-[200px] truncate">
                  {smell.file}
                </td>
                <td className="py-3 px-2 text-slate-200">
                  {smell.smell_type}
                </td>
                <td className="py-3 px-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(
                      smell.severity
                    )}`}
                  >
                    {smell.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {smells.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <i className="fas fa-check-circle text-2xl mb-2 text-emerald-500"></i>
          <p>No code smells detected</p>
        </div>
      )}

      {smells.length > PAGE_SIZE && (
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

export default SmellsList;