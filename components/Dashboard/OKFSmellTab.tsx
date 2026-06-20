/**
 * OKFSmellTab — Shared tab component for OKF smell lists in KnowledgeGapPanel.
 * Reuses the same list/item UI pattern as the existing code-side tabs.
 */
import React, { useState } from 'react';
import { OKF_COLORS } from '../../theme';
import type { OKFSmellItem } from '../../types';

interface OKFSmellTabProps {
  items: OKFSmellItem[];
  smellCategory: 'orphans' | 'stale' | 'bridge_break' | 'hub_anomaly';
  onConceptClick?: (conceptId: string) => void;
}

const SMELL_COLOR_KEY: Record<string, keyof typeof OKF_COLORS.SMELL> = {
  orphans: 'orphan',
  stale: 'stale',
  bridge_break: 'bridge_break',
  hub_anomaly: 'hub_anomaly',
};

const SMELL_LABELS: Record<string, string> = {
  orphans: 'OKF Orphans',
  stale: 'OKF Stale',
  bridge_break: 'OKF Bridge Breaks',
  hub_anomaly: 'OKF Hub Anomalies',
};

const SMELL_ICONS: Record<string, string> = {
  orphans: '🔗',
  stale: '⏳',
  bridge_break: '💔',
  hub_anomaly: '🔀',
};

export const OKFSmellTab: React.FC<OKFSmellTabProps> = ({ items, smellCategory, onConceptClick }) => {
  if (items.length === 0) {
    return (
      <div className="text-center text-slate-600 py-8 text-xs">
        No {SMELL_LABELS[smellCategory]?.toLowerCase() || 'smells'} detected
      </div>
    );
  }

  const severityColors = {
    high: { bg: 'bg-red-900/30', border: 'border-red-500/50', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
    medium: { bg: 'bg-amber-900/30', border: 'border-amber-500/50', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
    low: { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  };

  const colorKey = SMELL_COLOR_KEY[smellCategory] || 'orphan';

  return (
    <div className="space-y-2 p-4">
      {items.map((item, i) => {
        const colors = severityColors[item.severity || 'medium'] || severityColors.medium;
        const smellColor = OKF_COLORS.SMELL[colorKey] || '#6b7280';
        return (
          <div
            key={`${item.concept_id}-${i}`}
            className={`p-3 rounded-lg border ${colors.bg} ${colors.border} hover:brightness-110 cursor-pointer transition-all`}
            onClick={() => onConceptClick?.(item.concept_id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: smellColor }} />
                  <span className="font-mono text-xs text-white truncate">{item.concept_id}</span>
                  {item.severity && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors.badge}`}>
                      {item.severity}
                    </span>
                  )}
                </div>
                {item.description && (
                  <div className="text-[11px] text-slate-400 mt-1">{item.description}</div>
                )}
                {item.detail && (
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.detail}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OKFSmellTab;