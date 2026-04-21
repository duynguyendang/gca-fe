import React, { useState, useMemo } from 'react';

export interface SmellItem {
  file: string;
  smell_type: string;
  severity: 'High' | 'Medium' | 'Low';
}

interface SmellsListProps {
  smells: SmellItem[];
}

type SortKey = 'file' | 'smell_type' | 'severity';
type SortDirection = 'asc' | 'desc';

const severityOrder = { High: 3, Medium: 2, Low: 1 };

export const SmellsList: React.FC<SmellsListProps> = ({ smells }) => {
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
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
            {sortedSmells.map((smell, idx) => (
              <tr
                key={idx}
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
    </div>
  );
};

export default SmellsList;