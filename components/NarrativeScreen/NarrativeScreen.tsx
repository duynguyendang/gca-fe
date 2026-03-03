import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import TreeVisualizer from '../TreeVisualizer/index';
import NarrativeAnalysisPanel from './NarrativeAnalysisPanel';
import NarrativeQueryBar from './NarrativeQueryBar';

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
        astData,
        fileScopedNodes,
        fileScopedLinks,
        selectedNode,
        viewMode,
        expandedFileIds,
        expandingFileId,
        isNarrativeLoading,
    } = useAppContext();

    const fileScopedData = useMemo(() => ({
        nodes: fileScopedNodes,
        links: fileScopedLinks,
    }), [fileScopedNodes, fileScopedLinks]);

    // Steps for the top progress bar
    const steps = [
        { num: '01', label: 'CONTEXT INGESTION', active: true },
        { num: '02', label: 'GRAPH SYNTHESIS', active: true },
        { num: '03', label: 'LOGIC REASONING', active: true },
        { num: '04', label: 'IMPL. MAPPING', active: false },
    ];

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a1118]">
            {/* Top Progress Bar */}
            <div className="h-12 border-b border-white/5 flex items-center px-6 gap-1 bg-[#0a1118]/90 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2 mr-6">
                    <div className="w-2 h-2 rounded-full bg-[#10b981] narrative-pulse shadow-[0_0_8px_#10b981]"></div>
                    <span className="text-sm font-bold text-white tracking-tight uppercase">
                        Narrative Flow
                    </span>
                </div>

                <div className="flex-1 flex items-center justify-center gap-0">
                    {steps.map((step, i) => (
                        <React.Fragment key={step.num}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border ${step.active
                                    ? 'bg-[#00f2ff]/20 border-[#00f2ff]/50 text-[#00f2ff]'
                                    : 'border-white/10 text-slate-600'
                                    }`}>
                                    {step.num}
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${step.active ? 'text-white' : 'text-slate-600'
                                    }`}>
                                    {step.label}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`w-16 h-px mx-3 ${i < 2 ? 'bg-[#00f2ff]/30' : 'bg-white/5'}`}></div>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Model Status */}
                <div className="flex items-center gap-3 ml-auto">
                    <div className="text-right">
                        <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600">MODEL_STATUS</div>
                        <div className={`text-[10px] font-black uppercase tracking-wider ${isNarrativeLoading ? 'text-[#00f2ff] animate-pulse' : 'text-[#10b981]'}`}>
                            {isNarrativeLoading ? 'REASONING...' : 'READY'}
                        </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${isNarrativeLoading
                        ? 'border-[#00f2ff]/50 bg-[#00f2ff]/10'
                        : 'border-[#10b981]/30 bg-[#10b981]/10'
                        }`}>
                        <i className={`fas fa-atom text-xs ${isNarrativeLoading ? 'text-[#00f2ff] animate-spin' : 'text-[#10b981]'}`}
                            style={{ animationDuration: '3s' }}></i>
                    </div>
                </div>
            </div>

            {/* Main Content: Graph + Analysis Panel */}
            <div className="flex-1 flex min-h-0">
                {/* Left: Graph Visualization */}
                <div className="flex-1 relative dot-grid overflow-hidden bg-[#0a1118] min-w-0">
                    {/* Floating decorative elements */}
                    <div className="absolute inset-0 pointer-events-none z-0">
                        <div className="absolute top-[15%] left-[20%] w-16 h-16 rounded-full border border-[#a855f7]/20 flex items-center justify-center opacity-40">
                            <i className="fas fa-layer-group text-[#a855f7] text-lg"></i>
                        </div>
                        <div className="absolute top-[45%] left-[40%] w-12 h-12 rounded-full border border-[#00f2ff]/20 flex items-center justify-center opacity-30">
                            <i className="fas fa-snowflake text-[#00f2ff] text-sm"></i>
                        </div>
                        <div className="absolute top-[55%] left-[25%] w-20 h-20 rounded-full border border-[#00f2ff]/15 flex items-center justify-center opacity-40">
                            <div className="w-12 h-12 rounded-full border border-[#00f2ff]/25 flex items-center justify-center">
                                <i className="fas fa-cubes text-[#00f2ff] text-lg"></i>
                            </div>
                        </div>
                        <div className="absolute top-[70%] left-[15%] w-14 h-14 rounded-full border border-[#a855f7]/15 flex items-center justify-center opacity-30">
                            <i className="fas fa-puzzle-piece text-[#a855f7] text-sm"></i>
                        </div>
                    </div>

                    {/* Actual Graph */}
                    <div className="relative z-10 w-full h-full">
                        <TreeVisualizer
                            data={astData}
                            onNodeSelect={onNodeSelect}
                            onNodeHover={() => { }}
                            mode={'discovery'}
                            selectedId={selectedNode?.id}
                            fileScopedData={fileScopedData}
                            skipFlowZoom={false}
                            expandedFileIds={expandedFileIds}
                            onToggleFileExpansion={() => { }}
                            expandingFileId={expandingFileId}
                        />
                    </div>

                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
                        <button className="w-8 h-8 bg-[#16222a] border border-white/10 rounded flex items-center justify-center text-slate-400 hover:text-white hover:border-[#00f2ff]/30 transition-all text-sm">
                            +
                        </button>
                        <button className="w-8 h-8 bg-[#16222a] border border-white/10 rounded flex items-center justify-center text-slate-400 hover:text-white hover:border-[#00f2ff]/30 transition-all text-sm">
                            −
                        </button>
                    </div>

                    {/* Node Label Overlay (if a node is focused) */}
                    {selectedNode && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#16222a]/90 border border-[#00f2ff]/20 rounded-lg backdrop-blur-sm z-20">
                            <span className="text-[9px] font-mono font-bold text-[#00f2ff] uppercase tracking-wider">
                                {selectedNode.name || selectedNode.id}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right: AI Analysis Panel (40% width) */}
                <div className="w-[440px] shrink-0">
                    <NarrativeAnalysisPanel
                        onLinkClick={onLinkClick}
                        onSymbolClick={onSymbolClick}
                    />
                </div>
            </div>

            {/* Bottom: Query Bar */}
            <NarrativeQueryBar />
        </div>
    );
};

export default NarrativeScreen;
