import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface MetricsRadarProps {
  totalSmells: number;
  totalHubs: number;
  totalEntryPoints: number;
}

interface RadarData {
  metric: string;
  value: number;
  raw: number;
  color: string;
}

const METRIC_CONFIG = {
  smells: { color: '#2DD4BF', label: 'Smells' },
  hubs: { color: '#3B82F6', label: 'Hubs' },
  entryPoints: { color: '#A855F7', label: 'Entry Points' },
} as const;

export const MetricsRadar: React.FC<MetricsRadarProps> = ({
  totalSmells,
  totalHubs,
  totalEntryPoints,
}) => {
  const rawData = useMemo(() => [
    { key: 'smells', value: totalSmells, ...METRIC_CONFIG.smells },
    { key: 'hubs', value: totalHubs, ...METRIC_CONFIG.hubs },
    { key: 'entryPoints', value: totalEntryPoints, ...METRIC_CONFIG.entryPoints },
  ] as const, [totalSmells, totalHubs, totalEntryPoints]);

  const maxVal = useMemo(
    () => Math.max(totalSmells, totalHubs, totalEntryPoints, 1),
    [totalSmells, totalHubs, totalEntryPoints]
  );

  const normalizedData: RadarData[] = useMemo(
    () => rawData.map(item => ({
      metric: item.label,
      value: item.value / maxVal,
      raw: item.value,
      color: item.color,
    })),
    [rawData, maxVal]
  );

  const hasAnyData = totalSmells > 0 || totalHubs > 0 || totalEntryPoints > 0;

  return (
    <div className="flex flex-col p-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Metrics Breakdown</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={normalizedData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Radar
              name="Metrics"
              dataKey="value"
              stroke="#2DD4BF"
              fill="#2DD4BF"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Raw values display */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--border)]">
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: METRIC_CONFIG.smells.color }}>{totalSmells}</div>
          <div className="text-xs text-slate-500">Smells</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: METRIC_CONFIG.hubs.color }}>{totalHubs}</div>
          <div className="text-xs text-slate-500">Hubs</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: METRIC_CONFIG.entryPoints.color }}>{totalEntryPoints}</div>
          <div className="text-xs text-slate-500">Entry Points</div>
        </div>
      </div>

      {/* Empty state message */}
      {!hasAnyData && (
        <div className="text-center py-4 text-slate-500 text-sm">
          No metrics data available
        </div>
      )}
    </div>
  );
};

export default MetricsRadar;