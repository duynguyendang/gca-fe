import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface MetricsRadarProps {
  totalSmells: number;
  totalHubs: number;
  totalEntryPoints: number;
}

export const MetricsRadar: React.FC<MetricsRadarProps> = ({
  totalSmells,
  totalHubs,
  totalEntryPoints,
}) => {
  const data = [
    { metric: 'Smells', value: totalSmells, fullMark: 1 },
    { metric: 'Hubs', value: totalHubs, fullMark: 1 },
    { metric: 'Entry Points', value: totalEntryPoints, fullMark: 1 },
  ];

  // Normalize values to 0-1 range for radar (use max as reference)
  const maxVal = Math.max(totalSmells, totalHubs, totalEntryPoints, 1);

  const normalizedData = data.map(item => ({
    ...item,
    value: item.value / maxVal,
    raw: item.value,
  }));

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
          <div className="text-xl font-bold text-[#2DD4BF]">{totalSmells}</div>
          <div className="text-xs text-slate-500">Smells</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-[#3B82F6]">{totalHubs}</div>
          <div className="text-xs text-slate-500">Hubs</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-[#A855F7]">{totalEntryPoints}</div>
          <div className="text-xs text-slate-500">Entry Points</div>
        </div>
      </div>
    </div>
  );
};

export default MetricsRadar;