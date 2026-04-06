import React from 'react';

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
  id?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onToggle, label, id }) => {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${enabled ? 'bg-[#10b981]' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform`}
        style={{ left: enabled ? '18px' : '2px' }}
      />
    </button>
  );
};

export default ToggleSwitch;
