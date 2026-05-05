import React, { useState, useMemo } from 'react';
import { SurpriseEdge } from '../../types';

interface SurprisePanelProps {
  edges: SurpriseEdge[];
  onEdgeClick?: (edge: SurpriseEdge) => void;
}

const PAGE_SIZE = 50;

type SortKey = 'score' | 'source' | 'target';
type SortDirection = 'asc' | 'desc';

const factorColors: Record<string, string> = {
  surprise_cross_community: '#8b5cf6',
  surprise_cross_language: '#06b6d4',
  surprise_peripheral_hub: '#f59e0b',
  surprise_cross_test_boundary: '#ef4444',
};

export const SurprisePanel: React.FC<SurprisePanelProps> = ({ edges, onEdgeClick }) => {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
    setPage(0);
  };

  const filteredEdges = useMemo(() => {
    if (filter === 'all') return edges;
    return edges.filter(e => e.factors.some(f => f.type === filter));
  }, [edges, filter]);

  const sortedEdges = useMemo(() => {
    return [...filteredEdges].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'score') {
        cmp = a.score - b.score;
      } else if (sortKey === 'source') {
        cmp = a.source.localeCompare(b.source);
      } else {
        cmp = a.target.localeCompare(b.target);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredEdges, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedEdges.length / PAGE_SIZE);
  const paginatedEdges = useMemo(
    () => sortedEdges.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedEdges, page]
  );

  const uniqueFactors = useMemo(() => {
    const factors = new Set<string>();
    edges.forEach(e => e.factors.forEach(f => factors.add(f.type)));
    return Array.from(factors);
  }, [edges]);

  const SortIcon = ({ active, direction }: { active: boolean; direction: SortDirection }) => (
    <span className="ml-1 text-xs opacity-60">{active ? (direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
  );

  if (edges.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="mb-2 text-2xl">🔍</div>
        <div>No surprising edges detected</div>
        <div className="text-sm mt-1">Your code looks clean!</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700 text-sm">
        <span className="font-medium">{edges.length} surprising edges</span>
        <span className="text-amber-400">⚠ {edges.filter(e => e.score >= 0.5).length} high</span>
        <span className="text-yellow-400">⚡ {edges.filter(e => e.score >= 0.2 && e.score < 0.5).length} medium</span>
        <span className="text-gray-400">○ {edges.filter(e => e.score < 0.2).length} low</span>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-700 overflow-x-auto">
        <button
          onClick={() => { setFilter('all'); setPage(0); }}
          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          All
        </button>
        {uniqueFactors.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            style={{ borderLeft: `3px solid ${factorColors[f] || '#888'}` }}
          >
            {f.replace('surprise_', '')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-white" onClick={() => handleSort('source')}>
                Source <SortIcon active={sortKey === 'source'} direction={sortDirection} />
              </th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-white" onClick={() => handleSort('target')}>
                Target <SortIcon active={sortKey === 'target'} direction={sortDirection} />
              </th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-white w-32" onClick={() => handleSort('score')}>
                Score <SortIcon active={sortKey === 'score'} direction={sortDirection} />
              </th>
              <th className="px-3 py-2 text-left">Factors</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEdges.map((edge, i) => (
              <tr
                key={`${edge.source}-${edge.target}-${i}`}
                className="border-t border-gray-700 hover:bg-gray-750 cursor-pointer"
                onClick={() => onEdgeClick?.(edge)}
              >
                <td className="px-3 py-2 font-mono text-xs max-w-[200px] truncate" title={edge.source}>
                  {edge.source}
                </td>
                <td className="px-3 py-2 font-mono text-xs max-w-[200px] truncate" title={edge.target}>
                  {edge.target}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(edge.score * 100)}%`,
                          backgroundColor: edge.score >= 0.5 ? '#ef4444' : edge.score >= 0.2 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{edge.score.toFixed(2)}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {edge.factors.map((f, j) => (
                      <span
                        key={j}
                        className="px-1.5 py-0.5 rounded text-xs text-white"
                        style={{ backgroundColor: factorColors[f.type] || '#6b7280' }}
                        title={`${f.type}: ${f.score}`}
                      >
                        {f.type.replace('surprise_', '')}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 rounded bg-gray-700 text-sm disabled:opacity-40 hover:bg-gray-600"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded bg-gray-700 text-sm disabled:opacity-40 hover:bg-gray-600"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default SurprisePanel;