import React, { useState } from 'react';
import type { GraphDiff } from '../../types';

interface GraphDiffPanelProps {
  diff: GraphDiff;
  onNodeClick?: (nodeId: string) => void;
}

type TabKey = 'summary' | 'nodes' | 'edges' | 'communities';

export const GraphDiffPanel: React.FC<GraphDiffPanelProps> = ({ diff, onNodeClick }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const { summary } = diff;
  const hasChanges = summary.nodes_added > 0 || summary.nodes_removed > 0 ||
    summary.edges_added > 0 || summary.edges_removed > 0 || summary.community_moves > 0;

  if (!hasChanges) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="mb-2 text-2xl">✅</div>
        <div>No changes detected</div>
        <div className="text-sm mt-1">Graphs are identical</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Nodes Added', value: summary.nodes_added, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Nodes Removed', value: summary.nodes_removed, color: 'text-red-400', bg: 'bg-red-900/30' },
    { label: 'Edges Added', value: summary.edges_added, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Edges Removed', value: summary.edges_removed, color: 'text-red-400', bg: 'bg-red-900/30' },
    { label: 'Community Moves', value: summary.community_moves, color: 'text-purple-400', bg: 'bg-purple-900/30' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Summary stats */}
      <div className="grid grid-cols-5 gap-2 p-4 border-b border-gray-700">
        {statCards.map(card => (
          <div key={card.label} className={`p-3 rounded-lg ${card.bg} text-center`}>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['summary', 'nodes', 'edges', 'communities'] as TabKey[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400">Before Snapshot</div>
                <div className="text-xl font-bold">{summary.before_total_nodes} nodes</div>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400">After Snapshot</div>
                <div className="text-xl font-bold">{summary.after_total_nodes} nodes</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Net change: {summary.nodes_added - summary.nodes_removed > 0 ? '+' : ''}
              {summary.nodes_added - summary.nodes_removed} nodes,
              {' '}{summary.edges_added - summary.edges_removed > 0 ? '+' : ''}
              {summary.edges_added - summary.edges_removed} edges
            </div>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="space-y-4">
            {diff.new_nodes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-2">
                  + {diff.new_nodes.length} New Nodes
                </h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {diff.new_nodes.map(node => (
                    <div
                      key={node.id}
                      className="p-2 bg-gray-800 rounded text-sm font-mono cursor-pointer hover:bg-gray-700"
                      onClick={() => onNodeClick?.(node.id)}
                    >
                      <span className="text-green-400">+</span> {node.id}
                      <span className="text-gray-500 ml-2">[{node.kind}]</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {diff.removed_nodes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">
                  - {diff.removed_nodes.length} Removed Nodes
                </h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {diff.removed_nodes.map(id => (
                    <div
                      key={id}
                      className="p-2 bg-gray-800 rounded text-sm font-mono cursor-pointer hover:bg-gray-700"
                    >
                      <span className="text-red-400">-</span> {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'edges' && (
          <div className="space-y-4">
            {diff.new_edges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-2">
                  + {diff.new_edges.length} New Edges
                </h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {diff.new_edges.map(edge => (
                    <div key={edge.id} className="p-2 bg-gray-800 rounded text-sm font-mono">
                      <span className="text-green-400">+</span>{' '}
                      <span className="text-blue-300">{edge.source}</span>
                      <span className="text-gray-500"> → </span>
                      <span className="text-purple-300">{edge.target}</span>
                      <span className="text-gray-500 ml-2">({edge.predicate})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {diff.removed_edges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">
                  - {diff.removed_edges.length} Removed Edges
                </h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {diff.removed_edges.map(id => (
                    <div key={id} className="p-2 bg-gray-800 rounded text-sm font-mono">
                      <span className="text-red-400">-</span> {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'communities' && (
          <div className="space-y-4">
            {diff.community_changes.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No community changes</div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-purple-400 mb-2">
                  {diff.community_changes.length} Community Moves
                </h3>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {diff.community_changes.map((change, i) => (
                    <div key={`${change.node}-${i}`} className="p-2 bg-gray-800 rounded text-sm font-mono">
                      <span className="text-gray-400">{change.node}</span>
                      <span className="text-gray-500 mx-2">
                        cluster {change.before_cluster} → {change.after_cluster}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphDiffPanel;