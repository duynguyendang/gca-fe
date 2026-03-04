/**
 * SynthesisPanel - GenAI synthesis panel for AI insights
 * Extracted from App.tsx
 */
import React from 'react';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { useAppContext } from '../../context/AppContext';
import { LogicSequenceCard } from './subcomponents/LogicSequenceCard';
import { ArchitectureOverview } from './subcomponents/ArchitectureOverview';
import { EntropyMetricsPanel } from './subcomponents/EntropyMetricsPanel';

interface SynthesisPanelProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onAnalyze: () => void;
    onClearInsight: () => void;
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

const SynthesisPanel: React.FC<SynthesisPanelProps> = ({
    isCollapsed,
    onToggleCollapse,
    onAnalyze,
    onClearInsight,
    onLinkClick,
    onSymbolClick,
}) => {
    const {
        selectedNode,
        nodeInsight,
        isInsightLoading,
        activeSubMode,
        setActiveSubMode
    } = useAppContext();

    const TABS = ['NARRATIVE', 'ARCHITECTURE', 'ENTROPY'] as const;

    return (
        <div
            className={`flex-1 ${isCollapsed ? 'p-2 bg-[var(--bg-main)]' : 'p-5 bg-[var(--bg-main)]'} flex flex-col min-h-0 relative transition-none`}
        >
            {/* Tab Navigation */}
            {!isCollapsed && (
                <div className="flex border-b border-white/5 mb-4">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSubMode(tab as any)}
                            className={`px-4 py-2 text-[9px] font-black tracking-widest transition-all relative ${activeSubMode === tab ? 'text-[var(--accent-teal)]' : 'text-slate-500 hover:text-slate-400'}`}
                        >
                            {tab}
                            {activeSubMode === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-teal)] shadow-[0_0_8px_var(--accent-teal)]"></div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onToggleCollapse}
                        className="text-slate-500 hover:text-white transition-colors"
                    >
                        <i className={`fas fa-chevron-${isCollapsed ? 'up' : 'down'}`}></i>
                    </button>
                    <div className={`w-2 h-2 rounded-full ${nodeInsight ? 'bg-[var(--accent-teal)] animate-pulse shadow-[0_0_8px_var(--accent-teal)]' : 'bg-slate-700'}`}></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">
                        {activeSubMode} ANALYSIS
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAnalyze}
                        disabled={isInsightLoading || !selectedNode}
                        className={`px-3 py-1.5 bg-[var(--accent-teal)]/10 hover:bg-[var(--accent-teal)]/20 border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] rounded-sm text-[9px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all ${activeSubMode === 'ENTROPY' && 'border-red-500/30 text-red-500 bg-red-500/10'}`}
                        title="Generate AI analysis for selected node"
                    >
                        {isInsightLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <><i className={`fas ${activeSubMode === 'ENTROPY' ? 'fa-triangle-exclamation' : 'fa-sparkles'} mr-1.5`}></i>ANALYZE</>}
                    </button>
                    {nodeInsight && (
                        <button
                            onClick={onClearInsight}
                            className="px-2 py-1 text-slate-500 hover:text-white text-xs"
                            title="Clear insight"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Content  - with glassmorphism spec*/}
            <div className={`flex-1 glass-panel p-4 rounded border border-[var(--border)] text-[11px] text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar font-sans ${isCollapsed ? 'hidden' : ''}`}>
                {activeSubMode === 'NARRATIVE' && <LogicSequenceCard onLinkClick={onLinkClick} onSymbolClick={onSymbolClick} />}
                {activeSubMode === 'ARCHITECTURE' && <ArchitectureOverview onLinkClick={onLinkClick} onSymbolClick={onSymbolClick} />}
                {activeSubMode === 'ENTROPY' && <EntropyMetricsPanel onLinkClick={onLinkClick} onSymbolClick={onSymbolClick} />}
            </div>
        </div>
    );
};

export default SynthesisPanel;
