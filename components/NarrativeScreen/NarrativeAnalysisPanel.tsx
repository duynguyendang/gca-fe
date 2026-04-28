import React, { useState, useRef, useEffect } from 'react';
import { useNarrativeContext, NarrativeSection } from '../../context/NarrativeContext';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';

interface NarrativeAnalysisPanelProps {
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

type FilterTab = 'narrative' | 'architecture' | 'entropy';

const NarrativeAnalysisPanel: React.FC<NarrativeAnalysisPanelProps> = ({
    onLinkClick,
    onSymbolClick,
}) => {
    const { narrativeMessages, isNarrativeLoading } = useNarrativeContext();
    const [activeTab, setActiveTab] = useState<FilterTab>('narrative');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [narrativeMessages, isNarrativeLoading]);

    const tabs: { id: FilterTab; label: string }[] = [
        { id: 'narrative', label: 'NARRATIVE' },
        { id: 'architecture', label: 'ARCHITECTURE' },
        { id: 'entropy', label: 'ENTROPY' },
    ];

    const getSectionIcon = (type: NarrativeSection['type']) => {
        switch (type) {
            case 'summary': return { icon: '●', color: 'text-[#10b981]' };
            case 'inconsistency': return { icon: '⚠', color: 'text-[#f59e0b]' };
            case 'gravity': return { icon: '●', color: 'text-slate-500' };
            default: return { icon: '●', color: 'text-[var(--accent-blue)]' };
        }
    };

    const renderSection = (section: NarrativeSection, idx: number) => {
        const { icon, color } = getSectionIcon(section.type);
        const isBgCard = section.type === 'inconsistency';

        return (
            <div
                key={idx}
                className={`mb-6 section-slide-in ${isBgCard
                    ? 'bg-[#1e293b] border border-red-500/20 rounded-lg p-5 relative overflow-hidden font-mono shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                    : ''
                    }`}
                style={{ animationDelay: `${idx * 120}ms` }}
            >
                {/* Decorative gear icon for inconsistency */}
                {isBgCard && (
                    <div className="absolute top-3 right-3 text-white/5 text-4xl">
                        <i className="fas fa-cogs"></i>
                    </div>
                )}

                <div className={`text-[9px] font-black uppercase tracking-[0.25em] ${color} mb-3 flex items-center gap-2`}>
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
                    <button className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors flex items-center gap-2 group">
                        {section.actionLabel}
                        <i className="fas fa-wand-magic-sparkles text-[8px] group-hover:rotate-12 transition-transform"></i>
                    </button>
                )}
            </div>
        );
    };

    const aiMessages = narrativeMessages.filter(m => m.role === 'ai');

    return (
        <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)]">
            {/* Header */}
            <div className="p-5 pb-4 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded bg-[var(--accent-blue)]/20 flex items-center justify-center">
                            <i className="fas fa-cog text-[var(--accent-blue)] text-[10px] animate-spin" style={{ animationDuration: '4s' }}></i>
                        </div>
                        <h2 className="text-sm font-bold text-white tracking-tight">AI Narrative Analysis</h2>
                    </div>
                    <span className="px-2.5 py-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded text-[8px] font-black uppercase tracking-[0.15em] text-[#10b981]">
                        AGENT_DEEP_THINK
                    </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] border rounded transition-all ${activeTab === tab.id
                                ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/40 text-[var(--accent-blue)]'
                                : 'bg-transparent border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
                {aiMessages.length === 0 && !isNarrativeLoading ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 gap-4">
                        <i className="fas fa-brain text-5xl text-slate-600"></i>
                        <p className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-600">
                            Narrative Engine Standby
                        </p>
                        <p className="text-[9px] text-slate-700 text-center max-w-xs">
                            Ask a question below to begin AI-powered codebase analysis
                        </p>
                    </div>
                ) : (
                    <>
                        {aiMessages.map((msg, i) => (
                            <div key={i} className="mb-8">
                                {msg.sections && msg.sections.length > 0 ? (
                                    msg.sections.map((section, j) => renderSection(section, j))
                                ) : (
                                    <div className="section-slide-in">
                                        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-[#10b981] mb-3 flex items-center gap-2">
                                            <span>●</span>
                                            EXECUTIVE LOGIC SUMMARY
                                        </div>
                                        <div className="text-[12px] text-slate-300 leading-relaxed">
                                            <MarkdownRenderer
                                                content={msg.content}
                                                onLinkClick={onLinkClick}
                                                onSymbolClick={onSymbolClick}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading State */}
                        {isNarrativeLoading && (
                            <div className="mb-6 section-slide-in">
                                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--accent-blue)] mb-3 flex items-center gap-2">
                                    <i className="fas fa-circle-notch animate-spin text-[8px]"></i>
                                    REASONING...
                                </div>
                                <div className="space-y-3">
                                    <div className="h-3 bg-[#1e293b] rounded animate-pulse" style={{ width: '80%' }}></div>
                                    <div className="h-3 bg-[#1e293b] rounded animate-pulse" style={{ width: '60%' }}></div>
                                    <div className="h-3 bg-[#1e293b] rounded animate-pulse" style={{ width: '70%' }}></div>
                                    <div className="h-3 bg-[#1e293b] rounded animate-pulse" style={{ width: '45%' }}></div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default NarrativeAnalysisPanel;
