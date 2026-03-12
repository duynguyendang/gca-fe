import React, { useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import MarkdownRenderer from '../../Synthesis/MarkdownRenderer';

interface EntropyMetricsPanelProps {
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

export const EntropyMetricsPanel: React.FC<EntropyMetricsPanelProps> = ({ onLinkClick, onSymbolClick }) => {
    const { selectedNode, nodeInsight, isInsightLoading } = useAppContext();

    const parsedEntropy = useMemo(() => {
        if (!nodeInsight) return null;
        try {
            const jsonMatch = nodeInsight.match(/```json\n([\s\S]*?)\n```/) || nodeInsight.match(/{[\s\S]*?}/);
            if (jsonMatch) {
                const cleaned = jsonMatch[0].replace(/```json\n|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.entropy) return parsed.entropy;
            }
        } catch (e) {
            console.warn('[EntropyMetricsPanel] Failed to parse dynamic entropy metrics:', e);
        }
        return null;
    }, [nodeInsight]);

    const riskScore = parsedEntropy?.riskScore ?? 78; // Simulated fallback

    const maintenanceBurden = [
        { label: 'Technical Debt', value: parsedEntropy?.technicalDebt ?? '3.2d', color: 'text-red-400' },
        { label: 'Test Coverage', value: parsedEntropy?.testCoverage ?? '42%', color: 'text-amber-400' },
        { label: 'Churn Rate', value: parsedEntropy?.churnRate ?? 'High', color: 'text-red-400' },
    ];

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Risk Indicator */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-5 mb-4 text-center">
                <div className="relative inline-block mb-3">
                    <svg className="w-20 h-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent"
                            strokeDasharray={2 * Math.PI * 36}
                            strokeDashoffset={2 * Math.PI * 36 * (1 - riskScore / 100)}
                            className="text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-white leading-none">{riskScore}</span>
                        <span className="text-[7px] font-black uppercase text-red-400/60 tracking-tighter">RISK INDEX</span>
                    </div>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white italic">High-Entropy Candidate</h4>
            </div>

            {/* Metrics List */}
            <div className="space-y-2 mb-4">
                {maintenanceBurden.map((m) => (
                    <div key={m.label} className="bg-slate-900/50 border border-white/5 rounded px-3 py-2 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{m.label}</span>
                        <span className={`text-[11px] font-black ${m.color}`}>{m.value}</span>
                    </div>
                ))}
            </div>

            {/* Refactoring Insight */}
            <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 italic">Entropy Diagnosis</h4>
                {isInsightLoading ? (
                    <div className="flex items-center gap-3 text-red-500 animate-pulse">
                        <i className="fas fa-triangle-exclamation animate-spin text-[10px]"></i>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Scanning Debt...</span>
                    </div>
                ) : (
                    <div className="text-[11px] text-slate-300 leading-relaxed max-w-none">
                        <MarkdownRenderer
                            content={nodeInsight?.replace(/```json\n([\s\S]*?)\n```/g, '') || "Select a high-complexity node to analyze technical debt and refactoring impact."}
                            onLinkClick={onLinkClick}
                            onSymbolClick={onSymbolClick}
                        />
                    </div>
                )}
            </div>

            <button className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mt-4 shadow-[0_0_15px_-5px_#ef444430]">
                <i className="fas fa-hammer"></i>
                Propose Refactor
            </button>
        </div>
    );
};
