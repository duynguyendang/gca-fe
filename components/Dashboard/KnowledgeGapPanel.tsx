import React, { useState, useMemo } from 'react';
import { KnowledgeGapItem } from '../../types';

interface KnowledgeGapPanelProps {
  gaps: KnowledgeGapsResponse;
  onSymbolClick?: (symbol: string) => void;
}

interface KnowledgeGapsResponse {
  isolated_nodes: KnowledgeGapItem[];
  untested_hotspots: KnowledgeGapItem[];
  thin_communities: KnowledgeGapItem[];
  single_file_clusters: KnowledgeGapItem[];
  total_count: number;
}

const PAGE_SIZE = 20;

const severityColors = {
  high: { bg: 'bg-red-900/30', border: 'border-red-500/50', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
  medium: { bg: 'bg-amber-900/30', border: 'border-amber-500/50', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  low: { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
};

const gapTypeIcons: Record<string, string> = {
  isolated: '🔌',
  untested_hotspot: '⚠️',
  thin_community: '👥',
  single_file_community: '📦',
};

const gapTypeLabels: Record<string, string> = {
  isolated: 'Isolated Nodes',
  untested_hotspot: 'Untested Hotspots',
  thin_community: 'Thin Communities',
  single_file_community: 'Single-File Clusters',
};

export const KnowledgeGapPanel: React.FC<KnowledgeGapPanelProps> = ({ gaps, onSymbolClick }) => {
  const [activeTab, setActiveTab] = useState<string>('isolated');

  const tabs = useMemo(() => [
    { key: 'isolated', label: 'Isolated', count: gaps.isolated_nodes.length, icon: gapTypeIcons.isolated },
    { key: 'untested_hotspot', label: 'Untested', count: gaps.untested_hotspots.length, icon: gapTypeIcons.untested_hotspot },
    { key: 'thin_community', label: 'Thin Communities', count: gaps.thin_communities.length, icon: gapTypeIcons.thin_community },
    { key: 'single_file_community', label: 'Single-File', count: gaps.single_file_clusters.length, icon: gapTypeIcons.single_file_community },
  ], [gaps]);

  const activeItems = useMemo(() => {
    switch (activeTab) {
      case 'isolated': return gaps.isolated_nodes;
      case 'untested_hotspot': return gaps.untested_hotspots;
      case 'thin_community': return gaps.thin_communities;
      case 'single_file_community': return gaps.single_file_clusters;
      default: return [];
    }
  }, [activeTab, gaps]);

  if (gaps.total_count === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="mb-2 text-2xl">✅</div>
        <div>No knowledge gaps detected</div>
        <div className="text-sm mt-1">Your codebase has good coverage!</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary counts */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700 text-sm">
        <span className="font-medium">{gaps.total_count} total gaps</span>
        <span className="text-red-400">{gaps.untested_hotspots.length} untested</span>
        <span className="text-amber-400">{gaps.isolated_nodes.length} isolated</span>
        <span className="text-gray-400">{gaps.thin_communities.length + gaps.single_file_clusters.length} structural</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${
              activeTab === tab.key ? 'bg-purple-500/30' : 'bg-gray-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {activeItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No {gapTypeLabels[activeTab].toLowerCase()} found</div>
        ) : (
          activeItems.map((item, i) => {
            const colors = severityColors[item.severity] || severityColors.low;
            return (
              <div
                key={`${item.symbol}-${i}`}
                className={`p-3 rounded-lg border ${colors.bg} ${colors.border} hover:brightness-110 cursor-pointer transition-all`}
                onClick={() => onSymbolClick?.(item.symbol)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-white truncate">{item.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${colors.badge}`}>
                        {item.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{item.detail}</div>
                  </div>
                  {item.degree !== undefined && (
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums" style={{ color: colors.text.replace('text-', '') }}>
                        {item.degree}
                      </div>
                      <div className="text-xs text-gray-500">degree</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default KnowledgeGapPanel;