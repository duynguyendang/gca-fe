import React, { useMemo } from 'react';

interface HealthScoreProps {
  score: number;
}

// Arc geometry constants
const RADIUS = 40;
const CENTER = 50;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_DASH = CIRCUMFERENCE * 0.75; // 270 degrees = 3/4 of circle

// Convert score (0-100) to rotation angle (-135 to 135 degrees, for 270 degree arc)
const scoreToRotation = (score: number): number => (score / 100) * 270 - 135;

// Calculate arc length based on score (0-100 maps to 0-270 degrees)
const scoreToArcLength = (score: number): number => (score / 100) * MAX_DASH;

export const HealthScore: React.FC<HealthScoreProps> = ({ score }) => {
  const rotation = useMemo(() => scoreToRotation(score), [score]);
  const arcLength = useMemo(() => scoreToArcLength(score), [score]);
  const backgroundArc = useMemo(() => MAX_DASH, []);
  const gapArc = useMemo(() => CIRCUMFERENCE - MAX_DASH, []);

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
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${backgroundArc} ${gapArc}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${rotation + 135} ${CENTER} ${CENTER})`}
          />
          {/* Score arc */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={getScoreColor()}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${rotation + 135} ${CENTER} ${CENTER})`}
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