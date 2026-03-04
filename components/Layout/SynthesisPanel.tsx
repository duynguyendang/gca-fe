/**
 * SynthesisPanel - GenAI synthesis panel for AI insights
 * Extracted from App.tsx
 */
import React from 'react';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { useAppContext } from '../../context/AppContext';

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
    const { selectedNode, nodeInsight, isInsightLoading } = useAppContext();

    return (
        <div
            className={`flex-1 ${isCollapsed ? 'p-2 bg-[var(--bg-main)]' : 'p-5 bg-[var(--bg-main)]'} flex flex-col min-h-0 relative transition-none`}
        >
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
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">GenAI SYNTHESIS</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAnalyze}
                        disabled={isInsightLoading || !selectedNode}
                        className="px-3 py-1.5 bg-[var(--accent-teal)]/10 hover:bg-[var(--accent-teal)]/20 border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] rounded-sm text-[9px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Generate AI analysis for selected node"
                    >
                        {isInsightLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <><i className="fas fa-sparkles mr-1.5"></i>ANALYZE</>}
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
                {nodeInsight ? (
                    <MarkdownRenderer
                        content={nodeInsight}
                        onLinkClick={onLinkClick}
                        onSymbolClick={onSymbolClick}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-10 gap-3 grayscale">
                        <i className="fas fa-brain text-4xl"></i>
                        <p className="text-[10px] uppercase font-black tracking-[0.4em]">Inference Engine Standby</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynthesisPanel;
