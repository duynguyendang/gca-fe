import React, { useState, useMemo } from 'react';
import type { OKFSmellItem } from '../../types';
import { OKF_COLORS } from '../../theme';

interface OKFSmellTabProps {
  items: OKFSmellItem[];
  smellCategory: 'orphans' | 'stale' | 'bridge_break' | 'hub_anomaly';
  onConceptClick?: (conceptId: string) => void;
}

const smellLabels: Record<string, string> = {
  okf_orphan_concept: 'Orphan',
  okf_stale_concept: 'Stale',
  okf_bridge_break: 'Bridge Break',
  okf_hub_anomaly: 'Hub Anomaly',
};

const smellIcons: Record<string, string> = {
  okf_orphan_concept: '🔗',
  okf_stale_concept: '⏳',
  okf_bridge_break: '💔',
  okf_hub_anomaly: '🔥',
};

const smellColorMap: Record<string, string> = {
  okf_orphan_concept: OKF_COLORS.SMELL.orphan,
  okf_stale_concept: OKF_COLORS.SMELL.stale,
  okf_bridge_break: OKF_COLORS.SMELL.bridge_break,
  okf_hub_anomaly: OKF_COLORS.SMELL.hub_anomaly,
};

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: 'bg-red-900/30', border: 'border-red-500/50', text: 'text-red-400' },
  medium: { bg: 'bg-amber-900/30', border: 'border-amber-500/50', text: 'text-amber-400' },
  low: { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-400' },
};

const PAGE_SIZE = 20;

export const OKFSmellTab: React.FC<OKFSmellTabProps> = ({ items, smellCategory, onConceptClick }) => {
  const [page, setPage] = useState(0);

  const pagedItems = useMemo(() => items.slice(0, (page + 1) * PAGE_SIZE), [items, page]);
  const hasMore = pagedItems.length < items.length;

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No {smellLabels[smellCategory]?.toLowerCase()} smells detected
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pagedItems.map((item, i) => {
        const sev = item.severity || 'medium';
        const styles = severityStyles[sev] || severityStyles.medium;
        const color = smellColorMap[item.smell_type] || '#94a3b8';

        return (
          <div
            key={`${item.concept_id}-${i}`}
            className={`p-3 rounded-lg border ${styles.bg} ${styles.border} hover:brightness-110 cursor-pointer transition-all`}
            onClick={() => onConceptClick?.(item.concept_id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{smellIcons[item.smell_type] || '⚠️'}</span>
                  <span className="font-mono text-xs text-white truncate">{item.concept_id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs bg-white/5 ${styles.text}`}>
                    {item.severity || 'medium'}
                  </span>
                </div>
                {item.description && (
                  <div className="text-xs text-gray-400 mt-1">{item.description}</div>
                )}
                {item.detail && (
                  <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{item.detail}</div>
                )}
              </div>
              <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: color }} />
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full py-2 text-xs text-slate-400 hover:text-white bg-[var(--bg-main)] rounded transition-colors"
        >
          Show more ({pagedItems.length} / {items.length})
        </button>
      )}
    </div>
  );
};

export default OKFSmellTab;
