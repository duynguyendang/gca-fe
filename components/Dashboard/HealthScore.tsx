import React from 'react';

interface HealthScoreProps {
  score: number;
}

export const HealthScore: React.FC<HealthScoreProps> = ({ score }) => {
  // Score is 0-100, map to degrees (270 degree arc)
  const rotation = (score / 100) * 270 - 135; // -135 to 135 degrees

  const getScoreColor = () => {
    if (score >= 80) return '#2DD4BF'; // teal - good
    if (score >= 50) return '#F59E0B'; // amber - warning
    return '#EF4444'; // red - critical
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Healthy';
    if (score >= 50) return 'Warning';
    return 'Critical';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Health Score</h3>

      <div className="relative w-48 h-48">
        {/* Background arc */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
            strokeDasharray="188.5 62.8"
            strokeDashoffset="47"
            strokeLinecap="round"
            transform="rotate(135 50 50)"
          />
          {/* Score arc */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={getScoreColor()}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 188.5} 251.3`}
            strokeDashoffset="47"
            strokeLinecap="round"
            transform="rotate(135 50 50)"
            style={{
              filter: `drop-shadow(0 0 8px ${getScoreColor()})`,
              transition: 'stroke-dasharray 0.5s ease'
            }}
          />
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold"
            style={{ color: getScoreColor(), textShadow: `0 0 20px ${getScoreColor()}40` }}
          >
            {score}
          </span>
          <span className="text-xs uppercase tracking-wider text-slate-400 mt-1">{getScoreLabel()}</span>
        </div>
      </div>
    </div>
  );
};

export default HealthScore;