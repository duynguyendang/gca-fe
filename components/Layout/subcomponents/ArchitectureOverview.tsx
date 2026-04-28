import React, { useMemo } from 'react';
import { useNarrativeContext } from '../../../context/NarrativeContext';
import { useGraphContext } from '../../../context/GraphContext';
import MarkdownRenderer from '../../Synthesis/MarkdownRenderer';
import { logger } from '../../../logger';

interface ArchitectureOverviewProps {
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

export const ArchitectureOverview: React.FC<ArchitectureOverviewProps> = ({ onLinkClick, onSymbolClick }) => {
    const { selectedNode } = useGraphContext();
    const { nodeInsight, isInsightLoading } = useNarrativeContext();

    const parsedArch = useMemo(() => {
        if (!nodeInsight) return null;
        try {
            const jsonMatch = nodeInsight.match(/```json\n([\s\S]*?)\n```/) || nodeInsight.match(/{[\s\S]*?}/);
            if (jsonMatch) {
                const cleaned = jsonMatch[0].replace(/```json\n|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.architecture) return parsed.architecture;
            }
        } catch (e) {
            logger.warn('[ArchitectureOverview] Failed to parse dynamic architecture metrics:', e);
        }
        return null;
    }, [nodeInsight]);

    const metrics = [
        { label: 'In-Degree', value: parsedArch?.inDegree ?? 12, icon: 'fa-arrow-right-to-bracket', color: 'text-teal-400' },
        { label: 'Out-Degree', value: parsedArch?.outDegree ?? 4, icon: 'fa-arrow-right-from-bracket', color: 'text-teal-400' },
        { label: 'Cohesion', value: parsedArch?.cohesion ?? 'High', icon: 'fa-vector-square', color: 'text-teal-400' },
        { label: 'Coupling', value: parsedArch?.coupling ?? 'Low', icon: 'fa-link-slash', color: 'text-teal-400' },
    ];

    const patterns = parsedArch?.patterns?.map((p: any) => ({
        name: p.name,
        weight: p.weight,
        color: p.weight.includes('9') ? 'border-teal-500/30 bg-teal-500/5' : 'border-white/10 bg-white/5'
    })) || [
            { name: 'Singleton', weight: '95%', color: 'border-teal-500/30 bg-teal-500/5' },
            { name: 'Factory', weight: '12%', color: 'border-white/10 bg-white/5' },
        ];

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                {metrics.map((m) => (
                    <div key={m.label} className="bg-teal-500/5 border border-teal-500/20 rounded p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                            <i className={`fas ${m.icon} text-[9px] ${m.color}`}></i>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{m.label}</span>
                        </div>
                        <p className="text-[12px] font-black text-white">{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Patterns Identification */}
            <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4 mb-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-teal-400 mb-3">
                    <i className="fas fa-microchip mr-2"></i>Design Patterns
                </h4>
                <div className="flex flex-wrap gap-2">
                    {patterns.map((p: any) => (
                        <div key={p.name} className={`px-2.5 py-1.5 rounded border ${p.color} flex items-center gap-2`}>
                            <span className="text-[9px] font-bold text-white/90">{p.name}</span>
                            <span className="text-[8px] font-black text-teal-400/60 tracking-tight">{p.weight}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Summary */}
            <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 italic">Structural Summary</h4>
                {isInsightLoading ? (
                    <div className="flex items-center gap-3 text-teal-500 animate-pulse">
                        <i className="fas fa-project-diagram animate-spin text-[10px]"></i>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Profiling Architecture...</span>
                    </div>
                ) : (
                    <div className="text-[11px] text-slate-300 leading-relaxed max-w-none">
                        <MarkdownRenderer
                            content={nodeInsight?.replace(/```json\n([\s\S]*?)\n```/g, '') || "Select a module to analyze its structural integrity and dependencies."}
                            onLinkClick={onLinkClick}
                            onSymbolClick={onSymbolClick}
                        />
                    </div>
                )}
            </div>

            <button className="w-full py-2.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mt-4 shadow-[0_0_15px_-5px_#2dd4bf30]">
                <i className="fas fa-sitemap"></i>
                Map Dependencies
            </button>
        </div>
    );
};
