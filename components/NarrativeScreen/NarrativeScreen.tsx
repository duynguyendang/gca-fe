import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useSearchContext } from '../../context/SearchContext';
import { useNarrativeContext, NarrativeMessage } from '../../context/NarrativeContext';
import { useGraphContext } from '../../context/GraphContext';
import { useSettingsContext } from '../../context/SettingsContext';
import UnifiedSearchBar from '../UnifiedSearchBar';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { useContextualSuggestions } from '../../hooks/useContextualSuggestions';
import { useQueryContext } from '../../hooks/useQueryContext';
import { askAI } from '../../services/geminiService';
import { logger } from '../../logger';

interface NarrativeScreenProps {
    onNodeSelect: (node: any) => void;
    onSymbolClick?: (symbol: string) => void;
    onLinkClick?: (href: string) => void;
}

interface Suggestion {
    text: string;
    icon: string;
}

/**
 * Generate context-aware follow-up suggestions based on:
 * - Selected node in the graph
 * - Last AI message content
 * - Project context
 */
const generateFollowUpSuggestions = (
    selectedNode: any,
    lastAIMessage: string | null,
    contextualSuggestions: Suggestion[]
): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    // Get the first 3 contextual suggestions (already smart-filtered)
    const relevantSuggestions = contextualSuggestions.slice(0, 3);

    // If we have contextual suggestions from the hook, use them
    if (relevantSuggestions.length > 0) {
        // Add node-specific suggestions first
        if (selectedNode) {
            const nodeKind = (selectedNode.kind || selectedNode.type || '').toLowerCase();
            const isFile = selectedNode._isFile || nodeKind === 'file';

            if (isFile) {
                suggestions.push({ text: `Explain this file in detail`, icon: 'fa-file-code' });
                suggestions.push({ text: `Show all functions in this file`, icon: 'fa-code' });
            } else if (nodeKind === 'function' || nodeKind === 'func') {
                suggestions.push({ text: `Show callers of ${selectedNode.name}`, icon: 'fa-code-branch' });
                suggestions.push({ text: `Trace this function's execution`, icon: 'fa-route' });
            } else if (nodeKind === 'struct' || nodeKind === 'class') {
                suggestions.push({ text: `Show where this type is used`, icon: 'fa-search' });
                suggestions.push({ text: `Explain this type's methods`, icon: 'fa-info-circle' });
            }
        }

        // Add contextually relevant suggestions
        for (const s of relevantSuggestions) {
            if (suggestions.length >= 4) break;
            // Avoid duplicates
            if (!suggestions.some(existing => existing.text === s.text)) {
                suggestions.push(s);
            }
        }
    }

    // Add content-based suggestions if we have the last AI message
    if (lastAIMessage) {
        const msg = lastAIMessage.toLowerCase();

        // Detect topics in AI response and suggest relevant follow-ups
        if (msg.includes('auth') || msg.includes('login') || msg.includes('token')) {
            suggestions.push({ text: 'Show the authentication flow', icon: 'fa-lock' });
        }
        if (msg.includes('api') || msg.includes('endpoint') || msg.includes('handler')) {
            suggestions.push({ text: 'List all API endpoints', icon: 'fa-plug' });
        }
        if (msg.includes('database') || msg.includes('sql') || msg.includes('query')) {
            suggestions.push({ text: 'Show the database schema', icon: 'fa-database' });
        }
        if (msg.includes('error') || msg.includes('exception') || msg.includes('fail')) {
            suggestions.push({ text: 'What could go wrong here?', icon: 'fa-exclamation-triangle' });
        }
        if (msg.includes('depend') || msg.includes('import')) {
            suggestions.push({ text: 'Show full dependency graph', icon: 'fa-project-diagram' });
        }
    }

    // Always have a few diverse options
    if (suggestions.length < 3) {
        const fallbacks: Suggestion[] = [
            { text: 'Explain that in more detail', icon: 'fa-lightbulb' },
            { text: 'Show the related code', icon: 'fa-code' },
            { text: 'What are potential issues?', icon: 'fa-exclamation-triangle' },
            { text: 'Show entry points', icon: 'fa-sign-in-alt' },
        ];

        for (const f of fallbacks) {
            if (suggestions.length >= 4) break;
            if (!suggestions.some(existing => existing.text === f.text)) {
                suggestions.push(f);
            }
        }
    }

    return suggestions.slice(0, 4);
};

const NarrativeScreen: React.FC<NarrativeScreenProps> = ({
    onNodeSelect,
    onSymbolClick,
    onLinkClick,
}) => {
    const { selectedNode, setSelectedNode, setFileScopedNodes, setFileScopedLinks } = useGraphContext();
    const { narrativeMessages, isNarrativeLoading, setNarrativeMessages, setIsNarrativeLoading } = useNarrativeContext();
    const { selectedProjectId, dataApiBase } = useSettingsContext();

    const { suggestions: contextualSuggestions } = useContextualSuggestions();
    const { buildContext } = useQueryContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [narrativeMessages, isNarrativeLoading]);

    // Get the last AI message for context
    const lastAIMessage = useMemo(() => {
        const aiMessages = narrativeMessages.filter(m => m.role === 'ai');
        return aiMessages.length > 0 ? aiMessages[aiMessages.length - 1]!.content : null;
    }, [narrativeMessages]);

    // Generate context-aware follow-up suggestions
    const followUpSuggestions = useMemo(() => {
        if (isNarrativeLoading || narrativeMessages.length === 0) return [];
        return generateFollowUpSuggestions(selectedNode, lastAIMessage, contextualSuggestions);
    }, [selectedNode, lastAIMessage, contextualSuggestions, isNarrativeLoading, narrativeMessages.length]);

    const startNewConversation = useCallback(() => {
        setNarrativeMessages([]);
        setSelectedNode(null);
        setFileScopedNodes([]);
        setFileScopedLinks([]);
        setShowNewChatModal(false);
    }, [setNarrativeMessages, setSelectedNode, setFileScopedNodes, setFileScopedLinks]);

    const confirmNewChat = useCallback(() => {
        if (narrativeMessages.length > 0) {
            setShowNewChatModal(true);
        } else {
            startNewConversation();
        }
    }, [narrativeMessages.length, startNewConversation]);

    const submitNarrativeQuery = useCallback(async (query: string) => {
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
            logger.error('[NarrativeScreen] Narrative AI Error:', error);
            // Clean up error message for user
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
                sections: [{
                    type: 'inconsistency',
                    title: 'Issue',
                    content: 'Try rephrasing your question or ask about something else.',
                }],
            };
            setNarrativeMessages(prev => [...prev, errorResponseMsg]);
        } finally {
            setIsNarrativeLoading(false);
        }
    }, [isNarrativeLoading, dataApiBase, selectedProjectId, narrativeMessages, setNarrativeMessages, setIsNarrativeLoading, buildContext]);

    const getSectionIcon = (type: string) => {
        switch (type) {
            case 'summary': return { icon: '\u25CF', color: 'text-[#10b981]' };
            case 'inconsistency': return { icon: '\u26A0', color: 'text-[#f59e0b]' };
            case 'gravity': return { icon: '\u25CF', color: 'text-slate-500' };
            default: return { icon: '\u25CF', color: 'text-[var(--accent-blue)]' };
        }
    };

    const renderMessage = (msg: NarrativeMessage, idx: number) => {
        const isUser = msg.role === 'user';
        const displayText = isUser ? (msg.displayContent || msg.content) : msg.content;
        const isError = !isUser && (msg.sections?.some(s => s.type === 'inconsistency') || msg.content.startsWith('I apologize, but I encountered an error'));

        return (
            <div
                key={idx}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 section-slide-in`}
                style={{ animationDelay: `${idx * 80}ms` }}
            >
                <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isError ? 'bg-red-500/20 border border-red-500/30' : 'bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30'}`}>
                                <i className={`fas ${isError ? 'fa-exclamation-triangle' : 'fa-atom'} text-[8px] ${isError ? 'text-red-400' : 'text-[var(--accent-blue)]'}`}></i>
                            </div>
                        )}
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            {isUser ? 'You' : isError ? 'Error' : 'GCA Narrative'}
                        </span>
                        {isUser && (
                            <div className="w-6 h-6 rounded-full bg-[#10b981]/20 border border-[#10b981]/30 flex items-center justify-center">
                                <i className="fas fa-user text-[#10b981] text-[8px]"></i>
                            </div>
                        )}
                    </div>

                    <div className={`rounded-2xl px-5 py-4 ${
                        isUser
                            ? 'bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20'
                            : isError
                                ? 'bg-red-500/5 border border-red-500/20'
                                : 'bg-[#16222a] border border-white/5'
                    }`}>
                        {isUser ? (
                            <p className="text-[13px] text-white leading-relaxed">{displayText}</p>
                        ) : (
                            <>
                                {msg.sections && msg.sections.length > 0 ? (
                                    <div className="space-y-4">
                                        {msg.sections.map((section, sIdx) => {
                                            const { icon, color } = getSectionIcon(section.type);
                                            const isBgCard = section.type === 'inconsistency';

                                            return (
                                                <div
                                                    key={sIdx}
                                                    className={`${isBgCard
                                                        ? 'bg-[#1e293b] border border-red-500/20 rounded-lg p-4 relative overflow-hidden'
                                                        : ''
                                                    }`}
                                                >
                                                    {isBgCard && (
                                                        <div className="absolute top-2 right-2 text-white/5 text-3xl">
                                                            <i className="fas fa-cogs"></i>
                                                        </div>
                                                    )}

                                                    <div className={`text-[9px] font-black uppercase tracking-[0.25em] ${color} mb-2 flex items-center gap-2`}>
                                                        <span>{icon}</span>
                                                        {section.title}
                                                    </div>

                                                    <div className="text-[12px] text-slate-300 leading-relaxed">
                                                        <MarkdownRenderer
                                                            content={section.content}
                                                            onLinkClick={onLinkClick}
                                                            onSymbolClick={onSymbolClick}
                                                        />
                                                    </div>

                                                    {section.actionLabel && (
                                                        <button
                                                            aria-label={section.actionLabel}
                                                            className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors flex items-center gap-2 group"
                                                        >
                                                            {section.actionLabel}
                                                            <i className="fas fa-wand-magic-sparkles text-[8px] group-hover:rotate-12 transition-transform"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-[12px] text-slate-300 leading-relaxed">
                                        <MarkdownRenderer
                                            content={displayText}
                                            onLinkClick={onLinkClick}
                                            onSymbolClick={onSymbolClick}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className={`text-[9px] text-slate-600 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-main)]">
            {/* Header */}
            <div className="h-14 border-b border-[var(--border)] flex items-center px-6 gap-4 bg-[var(--bg-main)]/90 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center shadow-lg">
                        <i className="fas fa-comments text-white text-sm"></i>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white tracking-tight">Narrative Engine</h1>
                        <p className="text-[9px] text-slate-500 font-mono">
                            {selectedProjectId ? `Project: ${selectedProjectId}` : 'No project selected'}
                        </p>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    {narrativeMessages.length > 0 && !isNarrativeLoading && (
                        <button
                            onClick={confirmNewChat}
                            aria-label="Start new conversation"
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#16222a] border border-white/10 rounded-lg text-[9px] text-slate-400 hover:text-white hover:border-white/20 transition-all"
                            title="Start a new conversation"
                        >
                            <i className="fas fa-plus text-[8px]"></i>
                            <span className="hidden sm:inline">New</span>
                        </button>
                    )}

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                        isNarrativeLoading
                            ? 'bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30'
                            : 'bg-[#10b981]/10 border border-[#10b981]/30'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                            isNarrativeLoading
                                ? 'bg-[var(--accent-blue)] animate-pulse'
                                : 'bg-[#10b981]'
                        }`}></div>
                        <span className={`text-[8px] font-black uppercase tracking-wider ${
                            isNarrativeLoading ? 'text-[var(--accent-blue)]' : 'text-[#10b981]'
                        }`}>
                            {isNarrativeLoading ? 'Thinking...' : 'Ready'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
                {narrativeMessages.length === 0 && !isNarrativeLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-6 opacity-90">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20 border border-white/10 flex items-center justify-center">
                            <i className="fas fa-brain text-4xl text-[var(--accent-blue)]"></i>
                        </div>
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-white mb-2">Welcome to Narrative Engine</h2>
                            <p className="text-[12px] text-slate-400 max-w-md">
                                Ask me anything about your codebase. I can trace flows, explain architecture,
                                find patterns, and provide deep insights.
                            </p>
                        </div>

                        {/* Contextual quick-start suggestions */}
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {(contextualSuggestions.length > 0 ? contextualSuggestions : [
                                { text: 'Trace the authentication flow', icon: 'fa-route' },
                                { text: 'Explain the main entry point', icon: 'fa-door-open' },
                                { text: 'Find all API handlers', icon: 'fa-plug' },
                                { text: 'Show dependency graph', icon: 'fa-diagram-project' },
                            ]).map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => submitNarrativeQuery(suggestion.text)}
                                    disabled={isNarrativeLoading}
                                    className="px-4 py-2 bg-[#16222a] border border-white/10 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-[var(--accent-blue)]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <i className={`fas ${suggestion.icon} text-[9px] opacity-50`}></i>
                                    {suggestion.text}
                                </button>
                            ))}
                        </div>

                        {/* Help text */}
                        <p className="text-[10px] text-slate-600 mt-4">
                            Try clicking a file in the sidebar to get started
                        </p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        {narrativeMessages.map((msg, idx) => renderMessage(msg, idx))}

                        {/* Context-aware follow-up suggestions */}
                        {!isNarrativeLoading && followUpSuggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4 pl-4">
                                <span className="text-[9px] text-slate-600 self-center mr-2">Try:</span>
                                {followUpSuggestions.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => submitNarrativeQuery(suggestion.text)}
                                        className="px-3 py-1.5 bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/20 rounded-lg text-[9px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-all flex items-center gap-1.5"
                                    >
                                        <i className={`fas ${suggestion.icon} text-[8px]`}></i>
                                        {suggestion.text}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isNarrativeLoading && (
                            <div className="flex justify-start mb-6 section-slide-in">
                                <div className="max-w-[85%]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                                            <i className="fas fa-atom text-[var(--accent-blue)] text-[8px] animate-spin"></i>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                            GCA Narrative
                                        </span>
                                    </div>
                                    <div className="rounded-2xl px-5 py-4 bg-[#16222a] border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                            <span className="text-[11px] text-slate-400">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* New Chat Confirmation Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a2332] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center">
                                <i className="fas fa-comments text-[var(--accent-blue)]"></i>
                            </div>
                            <h3 className="text-base font-bold text-white">Start New Conversation?</h3>
                        </div>
                        <p className="text-[12px] text-slate-400 mb-6">
                            This will clear your current conversation. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowNewChatModal(false)}
                                className="flex-1 px-4 py-2.5 bg-[#16222a] border border-white/10 rounded-lg text-[11px] text-slate-400 hover:text-white hover:border-white/20 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={startNewConversation}
                                className="flex-1 px-4 py-2.5 bg-red-500/20 border border-red-500/30 rounded-lg text-[11px] text-red-400 hover:bg-red-500/30 transition-all"
                            >
                                Clear Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <UnifiedSearchBar
              accentColor="blue"
              suggestions={isNarrativeLoading ? [] : contextualSuggestions}
              onSubmit={submitNarrativeQuery}
              disabled={isNarrativeLoading}
            />
        </div>
    );
};

export default NarrativeScreen;
