import React, { useState } from 'react';
import { useSearchContext } from '../context/SearchContext';
import { ConversationTurn } from '../services/geminiService';

interface ConversationHistoryProps {
  accentColor?: 'blue' | 'teal';
  maxItems?: number;
  onRerunQuery?: (query: string) => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  accentColor = 'teal',
  maxItems = 10,
  onRerunQuery,
}) => {
  const { conversationHistory, clearConversationHistory } = useSearchContext();
  const [isExpanded, setIsExpanded] = useState(false);

  if (conversationHistory.length === 0) return null;

  const displayHistory = conversationHistory.slice(-maxItems);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mb-2">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium
          ${accentColor === 'teal'
            ? 'text-teal-400 hover:text-teal-300'
            : 'text-blue-400 hover:text-blue-300'
          }
          transition-colors`}
      >
        <span className="flex items-center gap-2">
          <i className="fas fa-history text-[10px]"></i>
          Conversation History ({conversationHistory.length})
        </span>
        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px]`}></i>
      </button>

      {/* History List */}
      {isExpanded && (
        <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
          {displayHistory.map((turn, idx) => (
            <div
              key={turn.timestamp + idx}
              className="group px-3 py-2 bg-[#16222a] rounded-lg border border-white/5
                hover:border-white/10 transition-colors cursor-pointer"
              onClick={() => onRerunQuery?.(turn.user_input)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-300 truncate flex-1 mr-2">
                  {turn.user_input}
                </span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {formatTime(turn.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  turn.intent === 'search'
                    ? 'bg-teal-500/20 text-teal-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {turn.intent}
                </span>
                <span className="text-[10px] text-slate-500">
                  {turn.result_count} results
                </span>
              </div>
            </div>
          ))}

          {/* Clear Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearConversationHistory();
            }}
            className="w-full px-3 py-1.5 text-[10px] text-red-400 hover:text-red-300
              hover:bg-red-500/10 rounded transition-colors"
          >
            <i className="fas fa-trash mr-1"></i>
            Clear History
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationHistory;