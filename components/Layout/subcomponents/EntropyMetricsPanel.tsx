import React, { useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import MarkdownRenderer from '../../Synthesis/MarkdownRenderer';
import { FlatGraph } from '../../../types';

interface EntropyMetricsPanelProps {
    onLinkClick?: (href: string) => void;
    onSymbolClick?: (symbol: string) => void;
}

interface EntropyMetrics {
    riskScore: number;
    technicalDebt: string;
    testCoverage: string;
    churnRate: string;
}

const calculateEntropyMetrics = (astData: FlatGraph | null, selectedNodeId?: string): EntropyMetrics => {
    if (!astData || !('nodes' in astData) || astData.nodes.length === 0) {
        return { riskScore: 0, technicalDebt: 'N/A', testCoverage: 'N/A', churnRate: 'N/A' };
    }

    const nodes = astData.nodes;
    const links = astData.links || [];

    // Build adjacency map for degree calculation
    const outDegree = new Map<string, number>();
    const inDegree = new Map<string, number>();
    
    links.forEach(link => {
        const source = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const target = typeof link.target === 'object' ? (link.target as any).id : link.target;
        outDegree.set(source, (outDegree.get(source) || 0) + 1);
        inDegree.set(target, (inDegree.get(target) || 0) + 1);
    });

    // Calculate metrics for selected node or entire graph
    let targetNode: any = null;
    let targetId = selectedNodeId;

    if (targetId) {
        targetNode = nodes.find(n => n.id === targetId);
    }

    // If we have a selected node, calculate metrics for that node
    // Otherwise, calculate for the entire graph
    let riskScore = 0;
    let technicalDebtDays = 0;
    let testFileCount = 0;
    let totalFiles = 0;
    let highChurnFiles = 0;

    if (targetNode) {
        // Metrics for selected node
        const nodeOut = outDegree.get(targetNode.id) || 0;
        const nodeIn = inDegree.get(targetNode.id) || 0;
        const totalDegree = nodeOut + nodeIn;
        
        // Risk score based on connectivity (0-100)
        // Higher degree = higher risk
        riskScore = Math.min(100, Math.round(totalDegree * 5 + (targetNode.code?.length || 0) / 100));
        
        // Technical debt estimation
        // More external dependencies = more debt
        technicalDebtDays = Math.round(nodeOut * 0.5 + (nodeIn > 5 ? 2 : 0));
        
        // Test coverage for selected node
        const isTestFile = targetNode.id.includes('_test.');
        testFileCount = isTestFile ? 1 : 0;
        totalFiles = 1;
        
        // Churn rate based on degree (high connectivity = potential high churn)
        highChurnFiles = totalDegree > 3 ? 1 : 0;
    } else {
        // Metrics for entire graph
        nodes.forEach(node => {
            const nodeOut = outDegree.get(node.id) || 0;
            const nodeIn = inDegree.get(node.id) || 0;
            const totalDegree = nodeOut + nodeIn;
            
            // Accumulate risk based on connectivity
            riskScore += totalDegree;
            
            // Count test files
            if (node.id.includes('_test.')) {
                testFileCount++;
            }
            totalFiles++;
            
            // High churn: files with many connections
            if (totalDegree > 5) {
                highChurnFiles++;
            }
        });
        
        // Normalize risk score to 0-100
        riskScore = Math.min(100, Math.round(riskScore / Math.max(1, nodes.length) * 10));
        
        // Technical debt: based on average out-degree (external dependencies)
        const avgOutDegree = links.length / Math.max(1, nodes.length);
        technicalDebtDays = Math.round(avgOutDegree * 2);
    }

    // Format outputs
    const testCoverage = totalFiles > 0 ? Math.round((testFileCount / totalFiles) * 100) : 0;
    
    let churnRate = 'Low';
    if (targetNode) {
        const nodeDegree = (outDegree.get(targetNode.id) || 0) + (inDegree.get(targetNode.id) || 0);
        if (nodeDegree > 10) churnRate = 'Critical';
        else if (nodeDegree > 5) churnRate = 'High';
        else if (nodeDegree > 2) churnRate = 'Medium';
    } else {
        const churnRatio = highChurnFiles / Math.max(1, nodes.length);
        if (churnRatio > 0.3) churnRate = 'Critical';
        else if (churnRatio > 0.2) churnRate = 'High';
        else if (churnRatio > 0.1) churnRate = 'Medium';
    }

    return {
        riskScore,
        technicalDebt: technicalDebtDays > 0 ? `${technicalDebtDays.toFixed(1)}d` : '< 1d',
        testCoverage: `${testCoverage}%`,
        churnRate
    };
};

export const EntropyMetricsPanel: React.FC<EntropyMetricsPanelProps> = ({ onLinkClick, onSymbolClick }) => {
    const { selectedNode, nodeInsight, isInsightLoading, astData } = useAppContext();

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

    // Calculate entropy from graph data
    const calculatedMetrics = useMemo(() => {
        return calculateEntropyMetrics(astData as FlatGraph, selectedNode?.id);
    }, [astData, selectedNode]);

    // Use AI-provided metrics if available, otherwise calculate from graph
    const riskScore = parsedEntropy?.riskScore ?? calculatedMetrics.riskScore;

    const maintenanceBurden = [
        { label: 'Technical Debt', value: parsedEntropy?.technicalDebt ?? calculatedMetrics.technicalDebt, color: 'text-red-400' },
        { label: 'Test Coverage', value: parsedEntropy?.testCoverage ?? calculatedMetrics.testCoverage, color: 'text-amber-400' },
        { label: 'Churn Rate', value: parsedEntropy?.churnRate ?? calculatedMetrics.churnRate, color: 'text-red-400' },
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
