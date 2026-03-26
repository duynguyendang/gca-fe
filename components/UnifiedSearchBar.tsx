import React from 'react';
import { useAppContext } from '../context/AppContext';

interface Suggestion {
  text: string;
  icon: string;
}

interface UnifiedSearchBarProps {
  accentColor?: 'blue' | 'teal';
  suggestions: Suggestion[];
  onSubmit?: (query: string) => void;
}

const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  accentColor = 'teal',
  suggestions,
  onSubmit,
}) => {
  const {
    searchTerm,
    setSearchTerm,
  } = useAppContext();

  const isBlue = accentColor === 'blue';
  const accentVar = isBlue ? '[var(--accent-blue)]' : '[var(--accent-teal)]';
  const focusBorder = isBlue ? 'focus:border-[var(--accent-blue)]/50' : 'focus:border-[var(--accent-teal)]/50';
  const hoverBorder = isBlue ? 'hover:border-[var(--accent-blue)]/30' : 'hover:border-[var(--accent-teal)]/30';
  const hoverColor = isBlue ? 'hover:text-[var(--accent-blue)]' : 'hover:text-[var(--accent-teal)]';
  const shadowClass = isBlue ? 'shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'shadow-[0_0_20px_rgba(45,212,191,0.3)]';

  const handleSubmit = () => {
    if (searchTerm.trim() && onSubmit) {
      onSubmit(searchTerm);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      handleSubmit();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setSearchTerm(text);
    if (onSubmit) {
      onSubmit(text);
    }
  };

  return (
    <div className="shrink-0 bg-[var(--bg-main)]/95 backdrop-blur-xl border-t border-[var(--border)] px-6 py-4">
      {/* Input Area */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Ask about your codebase..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={false}
            className={`w-full px-4 py-3 bg-[#16222a] border border-white/10 rounded-xl text-[13px] text-white placeholder-slate-500 focus:outline-none ${focusBorder} disabled:opacity-50 transition-all`}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!searchTerm.trim()}
          className={`px-6 py-3 bg-[${accentVar}] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${shadowClass} active:scale-95`}
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>

      {/* Quick Suggestions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handleSuggestionClick(suggestion.text)}
            className={`px-3 py-1.5 bg-[#16222a] border border-white/10 rounded text-[9px] font-bold text-slate-400 ${hoverColor} ${hoverBorder} disabled:opacity-30 transition-all flex items-center gap-2`}
          >
            <i className={`fas ${suggestion.icon} text-[8px] opacity-50`}></i>
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default UnifiedSearchBar;
