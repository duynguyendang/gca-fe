/**
 * SynthesisPanel - GenAI synthesis panel for AI insights
 * Extracted from App.tsx
 */
import React from 'react';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { useAppContext } from '../../context/AppContext';

interface SynthesisPanelProps {
    height: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onStartResize: () => void;
    onAnalyze: () => void;
    onClearInsight: () => void;
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

const SynthesisPanel: React.FC<SynthesisPanelProps> = ({
    height,
    isCollapsed,
    onToggleCollapse,
    onStartResize,
    onAnalyze,
    onClearInsight,
    onLinkClick,
    onSymbolClick,
}) => {
    const { selectedNode, nodeInsight, isInsightLoading } = useAppContext();

    return (
        <div
            style={{ height: isCollapsed ? 'auto' : height }}
            className={`border-t border-white/10 ${isCollapsed ? 'p-2 bg-[#0a1118]' : 'p-5 bg-[#0a1118]'} shadow-2xl flex flex-col shrink-0 relative transition-none`}
        >
            {/* Resize Handle */}
            <div
                onMouseDown={onStartResize}
                className="absolute left-0 top-0 right-0 h-1.5 cursor-row-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onToggleCollapse}
                        className="text-slate-500 hover:text-white transition-colors"
                    >
                        <i className={`fas fa-chevron-${isCollapsed ? 'up' : 'down'}`}></i>
                    </button>
                    <div className={`w-2 h-2 rounded-full ${nodeInsight ? 'bg-[#00f2ff] animate-pulse shadow-[0_0_8px_#00f2ff]' : 'bg-slate-700'}`}></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">GenAI SYNTHESIS</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAnalyze}
                        disabled={isInsightLoading || !selectedNode}
                        className="px-3 py-1.5 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] rounded-sm text-[9px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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

            {/* Content */}
            <div className={`flex-1 bg-[#0d171d] p-4 rounded border border-white/5 text-[11px] text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar font-mono ${isCollapsed ? 'hidden' : ''}`}>
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
