import React, { useMemo, useRef, useEffect } from 'react';
import { useAppContext, NarrativeMessage } from '../../context/AppContext';
import NarrativeQueryBar from './NarrativeQueryBar';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';

interface NarrativeScreenProps {
    onNodeSelect: (node: any) => void;
    onSymbolClick?: (symbol: string) => void;
    onLinkClick?: (href: string) => void;
}

const NarrativeScreen: React.FC<NarrativeScreenProps> = ({
    onNodeSelect,
    onSymbolClick,
    onLinkClick,
}) => {
    const {
        narrativeMessages,
        isNarrativeLoading,
        selectedProjectId,
    } = useAppContext();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [narrativeMessages, isNarrativeLoading]);

    const getSectionIcon = (type: string) => {
        switch (type) {
            case 'summary': return { icon: '●', color: 'text-[#10b981]' };
            case 'inconsistency': return { icon: '⚠', color: 'text-[#f59e0b]' };
            case 'gravity': return { icon: '●', color: 'text-slate-500' };
            default: return { icon: '●', color: 'text-[var(--accent-blue)]' };
        }
    };

    const renderMessage = (msg: NarrativeMessage, idx: number) => {
        const isUser = msg.role === 'user';
        
        return (
            <div
                key={idx}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 section-slide-in`}
                style={{ animationDelay: `${idx * 80}ms` }}
            >
                <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                    {/* Avatar */}
                    <div className={`flex items-center gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                            <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                                <i className="fas fa-atom text-[var(--accent-blue)] text-[8px]"></i>
                            </div>
                        )}
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            {isUser ? 'You' : 'GCA Narrative'}
                        </span>
                        {isUser && (
                            <div className="w-6 h-6 rounded-full bg-[#10b981]/20 border border-[#10b981]/30 flex items-center justify-center">
                                <i className="fas fa-user text-[#10b981] text-[8px]"></i>
                            </div>
                        )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-5 py-4 ${
                        isUser
                            ? 'bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20'
                            : 'bg-[#16222a] border border-white/5'
                    }`}>
                        {isUser ? (
                            <p className="text-[13px] text-white leading-relaxed">{msg.content}</p>
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
                                                        <button className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors flex items-center gap-2 group">
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
                                            content={msg.content}
                                            onLinkClick={onLinkClick}
                                            onSymbolClick={onSymbolClick}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Timestamp */}
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
                    /* Welcome State */
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
                        
                        {/* Quick Start Suggestions */}
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {[
                                'Trace the authentication flow',
                                'Explain the main entry point',
                                'Find all API handlers',
                                'Show dependency graph',
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    className="px-4 py-2 bg-[#16222a] border border-white/10 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-[var(--accent-blue)]/30 transition-all"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Messages */
                    <div className="max-w-4xl mx-auto">
                        {narrativeMessages.map((msg, idx) => renderMessage(msg, idx))}
                        
                        {/* Loading Indicator */}
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
                                            <span className="text-[11px] text-slate-400">Analyzing your codebase...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Query Bar */}
            <NarrativeQueryBar />
        </div>
    );
};

export default NarrativeScreen;
