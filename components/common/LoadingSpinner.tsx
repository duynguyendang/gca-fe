import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

/**
 * A simple loading spinner component.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  color = '#1f77b4'
}) => {
  return (
    <div className="loading-spinner" style={{ display: 'inline-block' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{ animation: 'spin 1s linear infinite' }}
      >
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray="32"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
