import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNarrativeContext, NarrativeMessage } from '../../context/NarrativeContext';
import { useSettingsContext } from '../../context/SettingsContext';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { askAI } from '../../services/geminiService';
import { useQueryContext } from '../../hooks/useQueryContext';
import { logger } from '../../logger';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose, initialPrompt }) => {
  const { dataApiBase, selectedProjectId } = useSettingsContext();
  const { narrativeMessages, setNarrativeMessages, isNarrativeLoading, setIsNarrativeLoading } = useNarrativeContext();

  const { buildContext } = useQueryContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-submit initial prompt when drawer opens with a prompt
  useEffect(() => {
    if (isOpen && initialPrompt && narrativeMessages.length === 0) {
      handleSubmit(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrativeMessages, isNarrativeLoading]);

  const handleSubmit = useCallback(async (query: string) => {
    if (!query.trim() || isNarrativeLoading || !dataApiBase || !selectedProjectId) return;

    const { enhancedQuery, contextData } = await buildContext(query);

    let fullQuery = query;
    if (narrativeMessages.length > 0) {
      const lastUserMessage = [...narrativeMessages].reverse().find(m => m.role === 'user');
      if (lastUserMessage && lastUserMessage.displayContent !== query) {
        fullQuery = `Follow-up: ${query}`;
      }
    }

    fullQuery += `\n\n${enhancedQuery}`;

    const MAX_QUERY_LENGTH = 9500;
    if (fullQuery.length > MAX_QUERY_LENGTH) {
      fullQuery = fullQuery.substring(0, MAX_QUERY_LENGTH) + '\n...[query shortened]';
    }

    const userMsg: NarrativeMessage = {
      role: 'user',
      content: fullQuery,
      displayContent: query,
      timestamp: Date.now(),
    };

    setNarrativeMessages(prev => [...prev, userMsg]);
    setIsNarrativeLoading(true);

    try {
      const aiResponse = await askAI(dataApiBase, selectedProjectId, {
        task: 'chat',
        query: fullQuery,
        data: contextData.length > 0 ? contextData : undefined,
      });

      const aiMsg: NarrativeMessage = {
        role: 'ai',
        content: aiResponse,
        timestamp: Date.now(),
      };

      setNarrativeMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      logger.error('[AIChatDrawer] AI Chat Error:', error);
      let userMessage = 'Something went wrong. Please try again.';
      const errorMsg = error.message || '';
      if (errorMsg.includes('aborted') || errorMsg.includes('cancelled')) {
        userMessage = 'Request was cancelled.';
      } else if (errorMsg.includes('timed out')) {
        userMessage = 'The request took too long. The backend might be busy.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage = 'Could not connect to the backend. Please check your connection.';
      }

      const errorResponseMsg: NarrativeMessage = {
        role: 'ai',
        content: `I encountered an issue: ${userMessage}`,
        timestamp: Date.now(),
      };
      setNarrativeMessages(prev => [...prev, errorResponseMsg]);
    } finally {
      setIsNarrativeLoading(false);
    }
  }, [isNarrativeLoading, dataApiBase, selectedProjectId, narrativeMessages, buildContext, setNarrativeMessages, setIsNarrativeLoading]);

  const handleSend = () => {
    if (inputValue.trim()) {
      handleSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#0a1118] border-l border-[var(--border)] flex flex-col z-50 transform transition-transform">
      {/* Header */}
      <div className="h-14 border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0 bg-[#0a1118]/90 backdrop-blur-md">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center">
          <i className="fas fa-wand-magic-sparkles text-white text-sm"></i>
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-white">AI Analysis</h2>
          <p className="text-[9px] text-slate-500 font-mono">
            {selectedProjectId ? `Project: ${selectedProjectId}` : 'No project'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          aria-label="Close drawer"
        >
          <i className="fas fa-xmark text-sm"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
        {narrativeMessages.length === 0 && !isNarrativeLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center mb-4">
              <i className="fas fa-brain text-2xl text-[var(--accent-blue)]"></i>
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Ready to Analyze</h3>
            <p className="text-[11px] text-slate-500 max-w-[200px]">
              Ask me anything about the selected file's architecture, security, or refactoring needs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {narrativeMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const displayText = isUser ? (msg.displayContent || msg.content) : msg.content;

              return (
                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] ${isUser ? 'order-2' : 'order-1'}`}>
                    {!isUser && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                          <i className="fas fa-robot text-[var(--accent-blue)] text-[8px]"></i>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">AI</span>
                      </div>
                    )}
                    <div className={`rounded-xl px-4 py-3 ${
                      isUser
                        ? 'bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20'
                        : 'bg-[#16222a] border border-white/5'
                    }`}>
                      {isUser ? (
                        <p className="text-[12px] text-white leading-relaxed">{displayText}</p>
                      ) : (
                        <div className="text-[11px] text-slate-300 leading-relaxed">
                          <MarkdownRenderer content={displayText} />
                        </div>
                      )}
                    </div>
                    <div className={`text-[8px] text-slate-600 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}

            {isNarrativeLoading && (
              <div className="flex justify-start">
                <div className="max-w-[90%]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                      <i className="fas fa-robot text-[var(--accent-blue)] text-[8px] animate-pulse"></i>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">AI</span>
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-[#16222a] border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-[10px] text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border)] shrink-0">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this file..."
            className="flex-1 bg-[#16222a] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-white placeholder-slate-600 resize-none focus:outline-none focus:border-[var(--accent-blue)]/50"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isNarrativeLoading}
            className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-[11px] font-medium transition-colors"
          >
            <i className="fas fa-paper-plane text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatDrawer;