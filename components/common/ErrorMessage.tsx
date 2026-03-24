import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

/**
 * An error message component with optional retry button.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div
      className="error-message"
      style={{
        padding: '12px 16px',
        background: '#fee',
        border: '1px solid #fcc',
        borderRadius: '4px',
        color: '#c33',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 12px',
            background: '#c33',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
};
