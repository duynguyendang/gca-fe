import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface SuspenseFallbackProps {
  /**
   * Friendly label shown under the spinner (e.g. "Loading Dashboard…").
   * Kept short so it fits in panel headers.
   */
  label?: string;

  /**
   * Layout mode:
   *  - "panel"  (default): centered spinner that fills its container.
   *    Use when the lazy component fills an entire view (Dashboard, Narrative).
   *  - "inline": small inline spinner for modals / code panels where the
   *    spinner should not steal the viewport.
   */
  variant?: 'panel' | 'inline';
}

/**
 * Default fallback for <React.Suspense> wrapping lazy-loaded views.
 *
 * Why a dedicated component:
 *  - Single source of truth for the loading look & feel.
 *  - Keeps the lazy boundary declarative in App.tsx (no inline JSX).
 *  - Avoids flash-of-empty-content for slow networks.
 */
export const SuspenseFallback: React.FC<SuspenseFallbackProps> = ({
  label = 'Loading…',
  variant = 'panel',
}) => {
  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-500">
        <LoadingSpinner size={14} color="var(--accent-teal, #1f77b4)" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center bg-[var(--bg-main,#0a1118)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/20 flex items-center justify-center mx-auto mb-3">
          <LoadingSpinner size={22} color="var(--accent-teal, #1f77b4)" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {label}
        </p>
      </div>
    </div>
  );
};

export default SuspenseFallback;