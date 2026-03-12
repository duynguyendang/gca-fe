import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { LogIn, ShieldCheck, Key, Zap, Database, ChevronRight, Brain } from 'lucide-react';
import MarkdownRenderer from '../../Synthesis/MarkdownRenderer';

const IconMap: Record<string, any> = {
    LogIn,
    ShieldCheck,
    Key,
    Zap,
    Database,
    Brain,
    default: Zap
};

interface SequenceStep {
    id: number;
    title: string;
    icon: string;
    description: string;
    nodeId: string;
}

interface LogicSequenceCardProps {
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

export const LogicSequenceCard: React.FC<LogicSequenceCardProps> = ({ onLinkClick, onSymbolClick }) => {
    const {
        nodeInsight,
        isInsightLoading,
        setHighlightedNodeId,
        selectedNode,
        setSelectedNode,
        astData,
        setIsCodeCollapsed
    } = useAppContext();

    const [activeStepId, setActiveStepId] = useState<number | null>(null);

    // Dynamic Step Parsing Logic
    const steps = useMemo<SequenceStep[]>(() => {
        if (!nodeInsight) return [];

        try {
            // Attempt to find a JSON block in the AI response
            const jsonMatch = nodeInsight.match(/```json\n([\s\S]*?)\n```/) ||
                nodeInsight.match(/{[\s\S]*?}/);

            if (jsonMatch) {
                const cleaned = jsonMatch[0].replace(/```json\n|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.steps && Array.isArray(parsed.steps)) {
                    return parsed.steps;
                }
            }
        } catch (e) {
            console.warn('[LogicSequenceCard] Failed to parse dynamic steps:', e);
        }

        // Fallback or legacy markdown parsing?
        // Let's try to extract from common markdown list pattern: "1. **Title** (id: ...): Description"
        const fallbackSteps: SequenceStep[] = [];
        const lines = nodeInsight.split('\n');
        let counter = 1;

        for (const line of lines) {
            const match = line.match(/^(\d+)\.\s+\*\*(.*?)\*\*(?:\s+\(id:\s+(.*?)\))?:\s*(.*)/i);
            if (match) {
                fallbackSteps.push({
                    id: counter++,
                    title: match[2],
                    icon: "Zap",
                    nodeId: match[3] || "",
                    description: match[4]
                });
            }
        }

        // Final fallback if nothing found
        if (fallbackSteps.length === 0) {
            return [
                { id: 1, title: "Initial Call", icon: "LogIn", description: "Symbol found in the codebase.", nodeId: selectedNode?.id || "" }
            ];
        }

        return fallbackSteps;
    }, [nodeInsight, selectedNode]);

    // Reverse Sync: Update activeStepId when selectedNode changes externally
    useEffect(() => {
        if (selectedNode) {
            const found = steps.find(s => s.nodeId === selectedNode.id);
            if (found) {
                setActiveStepId(found.id);
            }
        }
    }, [selectedNode, steps]);

    const handleStepClick = (step: SequenceStep) => {
        setActiveStepId(step.id);

        // Find node in astData to select it
        const nodes = (astData as any).nodes || [];
        const targetNode = nodes.find((n: any) => n.id === step.nodeId);

        if (targetNode) {
            // SYNC TRINITY: Graph + Code + Selection
            setSelectedNode({
                ...targetNode,
                _scrollToLine: targetNode.start_line
            });
            // Auto expand code panel for smooth linkage
            setIsCodeCollapsed(false);
        }
    };

    if (steps.length === 0 && !isInsightLoading) {
        return (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6 text-center opacity-40 italic">
                <Brain size={24} className="mx-auto mb-3 text-slate-600" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Waiting for AI Narrative...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in custom-scrollbar overflow-y-auto pr-1">
            {/* AI Summary Section */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">AI Analysis</h4>
                    {!isInsightLoading && (
                        <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[7px] font-black text-blue-400 uppercase tracking-tighter">
                            Real-time
                        </div>
                    )}
                </div>

                {isInsightLoading ? (
                    <div className="flex items-center gap-3 text-blue-500/60 animate-pulse py-4">
                        <Brain size={14} className="animate-bounce" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Contextualizing Flow...</span>
                    </div>
                ) : (
                    <div className="text-[11px] text-slate-400 leading-relaxed max-w-none">
                        <MarkdownRenderer
                            content={nodeInsight?.replace(/```json\n([\s\S]*?)\n```/g, '') || "Select a logical step below to focus the analysis on specific component interactions."}
                            onLinkClick={onLinkClick}
                            onSymbolClick={onSymbolClick}
                        />
                    </div>
                )}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-5 mb-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Zap size={40} className="text-blue-400" />
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                    Execution Sequence
                </h4>

                <div className="relative ml-2">
                    {/* Vertical Rail */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-[2px] border-l-2 border-dashed border-slate-800"></div>

                    {/* Active Progress Rail */}
                    {activeStepId !== null && steps.length > 1 && (
                        <div
                            className="absolute left-[7px] top-2 w-[2px] transition-all duration-700 ease-in-out border-l-2 border-blue-500 shadow-[0_0_10px_#3B82F6]"
                            style={{
                                height: `calc(${(activeStepId - 1) / (steps.length - 1) * 100}% - 4px)`,
                                opacity: activeStepId > 1 ? 1 : 0
                            }}
                        ></div>
                    )}

                    <div className="space-y-8">
                        {steps.map((step) => {
                            const Icon = IconMap[step.icon] || IconMap.default;
                            const isActive = activeStepId === step.id;
                            const isCompleted = activeStepId !== null && step.id < activeStepId;

                            return (
                                <div
                                    key={step.id}
                                    className={`relative flex gap-6 group cursor-pointer transition-all duration-300 ${isActive ? 'opacity-100 translate-x-1' : 'opacity-70 hover:opacity-100 hover:translate-x-0.5'}`}
                                    onMouseEnter={() => setHighlightedNodeId(step.nodeId)}
                                    onMouseLeave={() => setHighlightedNodeId(null)}
                                    onClick={() => handleStepClick(step)}
                                >
                                    {/* Indicator */}
                                    <div className="relative z-10 flex items-center justify-center">
                                        <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 flex items-center justify-center bg-[var(--bg-main)] 
                                            ${isActive ? 'border-blue-500 scale-125' : isCompleted ? 'border-blue-500 bg-blue-500' : 'border-slate-700'}`}
                                        >
                                            {isActive && (
                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_#3B82F6]"></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 transition-all duration-300 ${isActive ? 'pl-2 border-l-2 border-blue-500 -ml-[2px]' : ''}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon size={12} className={isActive || isCompleted ? 'text-blue-400' : 'text-slate-500'} />
                                            <span className={`text-[11px] font-black uppercase tracking-wider transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                                {step.id}. {step.title}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                            {step.description}
                                        </p>
                                    </div>

                                    {isActive && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-500/40 animate-pulse">
                                            <ChevronRight size={14} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <button className="group w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-[0.98]">
                <Brain size={12} className="group-hover:rotate-12 transition-transform" />
                Narrate Entire Sequence
            </button>
        </div>
    );
};
