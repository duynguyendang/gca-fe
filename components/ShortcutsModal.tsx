import React, { useEffect, useRef } from 'react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '?', action: 'Open shortcuts' },
  { key: 'Esc', action: 'Clear selection / close modal' },
  { key: 'Cmd+K', action: 'Focus search' },
  { key: 'Cmd+B', action: 'Toggle code panel' },
  { key: 'Cmd+1', action: 'Narrative view' },
  { key: 'Cmd+2', action: 'Discovery view' },
  { key: 'Cmd+3', action: 'Architecture view' },
  { key: 'Cmd+4', action: 'Map view' },
  { key: 'Cmd+5', action: 'Test generation' },
  { key: 'Cmd+6', action: 'Dashboard' },
  { key: '1-6', action: 'Switch view (bare keys)' },
];

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === '?' && e.shiftKey)) {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[var(--bg-surface)] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Keyboard Shortcuts</h3>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close shortcuts" className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
              <kbd className="px-2.5 py-1 bg-[#0a0e14] border border-white/10 rounded text-[10px] font-mono text-white shrink-0">
                {s.key}
              </kbd>
              <span className="text-[11px] text-slate-300">{s.action}</span>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[var(--bg-main)]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;