/**
 * CodePanel - Right panel for displaying source code
 * Extracted from App.tsx renderCode function
 */
import React, { useEffect, useState, useCallback } from 'react';
import HighlightedCode from '../HighlightedCode';
import MarkdownRenderer from '../Synthesis/MarkdownRenderer';
import { useGraphContext } from '../../context/GraphContext';
import { useSettingsContext } from '../../context/SettingsContext';
import { useOKFBridgesForSymbol } from '../../hooks/useOKFData';
import { fetchOKFConceptDetail } from '../../services/okfService';
import { OKF_COLORS } from '../../theme';
import { logger } from '../../logger';

interface CodePanelProps {
    width: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onStartResize: (e: React.MouseEvent) => void;
    onNavigateToSymbol?: (symbolId: string) => void;
}

const CodePanel: React.FC<CodePanelProps> = ({
    width,
    isCollapsed,
    onToggleCollapse,
    onStartResize,
    onNavigateToSymbol
}) => {
    const { selectedNode, hydratingNodeId, fileScopedNodes, astData } = useGraphContext();
    const { dataApiBase, selectedProjectId } = useSettingsContext();

    const isOKFConcept = (selectedNode as any)?.role === 'okf_concept' ||
        (selectedNode?.id || '').includes('/okf/');

    const { concepts: knowledgeLinks, loading: bridgesLoading } = useOKFBridgesForSymbol(
        selectedNode?.id && !isOKFConcept ? selectedNode.id : null,
        dataApiBase,
        selectedProjectId
    );

    const [okfDetail, setOkfDetail] = useState<any>(null);
    const [okfLoading, setOkfLoading] = useState(false);

    useEffect(() => {
        if (!isOKFConcept || !selectedNode?.id || !dataApiBase || !selectedProjectId) {
            setOkfDetail(null);
            return;
        }
        setOkfLoading(true);
        fetchOKFConceptDetail(dataApiBase, selectedProjectId, selectedNode.id)
            .then(setOkfDetail)
            .catch(err => {
                logger.warn('[CodePanel] Failed to fetch OKF detail:', err.message);
                setOkfDetail(null);
            })
            .finally(() => setOkfLoading(false));
    }, [isOKFConcept, selectedNode?.id, dataApiBase, selectedProjectId]);

    const handleOKFLinkClick = useCallback((href: string) => {
        if (!href || href.startsWith('http://') || href.startsWith('https://') || href === '#') return;

        const allGraphNodes = [...(fileScopedNodes || []), ...(('nodes' in (astData || {})) ? ((astData as any).nodes || []) : [])];
        const codeNodes = allGraphNodes.filter((n: any) => n.role !== 'okf_concept' && !(n.id || '').includes('/okf/'));
        const okfNodes = allGraphNodes.filter((n: any) => n.role === 'okf_concept' || (n.id || '').includes('/okf/'));

        if (href.includes('#')) {
            const parts = href.split('#');
            const filePath = parts[0] || '';
            const symName = parts[1] || '';
            const cleanPath = filePath.replace(/^\//, '');

            for (const n of codeNodes) {
                const nodePath = (n as any).filePath || (n as any).file_path || '';
                const cleanNodePath = nodePath.replace(/^\//, '');
                if (cleanNodePath.endsWith(cleanPath) || cleanPath.endsWith(cleanNodePath)) {
                    const name = (n as any).name || n.id.split(':').pop() || '';
                    if (name === symName) {
                        onNavigateToSymbol?.(n.id);
                        return;
                    }
                }
            }

            for (const n of codeNodes) {
                const name = (n as any).name || n.id.split(':').pop() || '';
                if (name === symName) {
                    onNavigateToSymbol?.(n.id);
                    return;
                }
            }
        }

        const cleanHref = href.replace(/^\//, '').replace(/\.md$/, '');

        for (const n of okfNodes) {
            const nodeId = (n.id || '');
            const lastSeg = nodeId.split('/').filter(Boolean).pop()?.toLowerCase() || '';
            const hrefLastSeg = cleanHref.split('/').filter(Boolean).pop()?.toLowerCase() || '';
            if (lastSeg && hrefLastSeg && lastSeg === hrefLastSeg) {
                onNavigateToSymbol?.(n.id);
                return;
            }
            if (nodeId.toLowerCase().includes(cleanHref.toLowerCase())) {
                onNavigateToSymbol?.(n.id);
                return;
            }
        }

        for (const n of codeNodes) {
            const nodePath = (n as any).filePath || (n as any).file_path || '';
            const cleanNodePath = nodePath.replace(/^\//, '');
            if (cleanNodePath.endsWith(cleanHref) || cleanHref.endsWith(cleanNodePath)) {
                onNavigateToSymbol?.(n.id);
                return;
            }
        }

        onNavigateToSymbol?.(href);
    }, [fileScopedNodes, astData, onNavigateToSymbol]);

    const renderCode = () => {
        if (!selectedNode) return (
            <div className="h-full flex items-center justify-center flex-col gap-4 grayscale opacity-20">
                <i className="fas fa-file-code text-5xl"></i>
                <p className="text-[10px] uppercase font-black tracking-[0.2em]">Select a Symbol to View Source</p>
            </div>
        );

        // OKF concept: show body as markdown
        if (isOKFConcept) {
            if (okfLoading) {
                return (
                    <div className="h-full flex items-center justify-center flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <i className="fas fa-circle-notch fa-spin text-[var(--accent-teal)] text-2xl"></i>
                            <p className="text-[10px] text-[var(--accent-teal)] font-medium">Loading concept...</p>
                        </div>
                    </div>
                );
            }

            if (!okfDetail) {
                return (
                    <div className="h-full flex items-center justify-center flex-col gap-3 opacity-30 italic">
                        <i className="fas fa-book-open text-3xl"></i>
                        <p className="text-[10px] uppercase font-bold tracking-widest">Concept Not Found</p>
                    </div>
                );
            }

            return (
                <div className="p-4 space-y-4 overflow-auto h-full">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: OKF_COLORS.NODE }}></span>
                        <span className="text-sm font-bold text-white">{okfDetail.title || selectedNode.name}</span>
                    </div>
                    {okfDetail.description && (
                        <p className="text-xs text-slate-400">{okfDetail.description}</p>
                    )}
                    {okfDetail.body && (
                        <div className="text-sm text-slate-300 leading-relaxed">
                            <MarkdownRenderer content={okfDetail.body} onLinkClick={handleOKFLinkClick} />
                        </div>
                    )}
                    {!okfDetail.body && (
                        <div className="text-xs text-slate-600 italic">No body content</div>
                    )}
                </div>
            );
        }

        // Show loading skeleton only when actively hydrating
        if (hydratingNodeId === selectedNode.id) {
            return (
                <div className="h-full flex items-center justify-center flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-circle-notch fa-spin text-[#00f2ff] text-2xl"></i>
                        <p className="text-[10px] text-[#00f2ff] font-medium">Loading code...</p>
                    </div>
                    <div className="flex-1 w-full max-w-2xl mx-4 space-y-2">
                        <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '40%' }}></div>
                        <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '70%' }}></div>
                        <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '60%' }}></div>
                        <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '50%' }}></div>
                        <div className="h-4 bg-[#16222a] rounded animate-pulse" style={{ width: '80%' }}></div>
                    </div>
                </div>
            );
        }

        let code = selectedNode.code;
        if (!code && selectedNode._isMissingCode) {
            return (
                <div className="h-full flex items-center justify-center flex-col gap-3 opacity-30 italic">
                    <i className="fas fa-file-invoice text-3xl"></i>
                    <p className="text-[10px] uppercase font-bold tracking-widest">Source Buffer Unavailable</p>
                </div>
            );
        }

        let language = 'go';
        const id = (selectedNode.id || "").toLowerCase();
        if (id.endsWith('.ts') || id.endsWith('.tsx')) language = 'typescript';
        else if (id.endsWith('.js') || id.endsWith('.jsx')) language = 'javascript';
        else if (id.endsWith('.py')) language = 'python';
        else if (id.endsWith('.rs')) language = 'rust';
        else if (id.endsWith('.cpp')) language = 'cpp';

        return (
            <HighlightedCode
                code={code || "// Code snippet missing."}
                language={language}
                startLine={selectedNode.start_line || 1}
                scrollToLine={typeof selectedNode._scrollToLine === 'number' ? selectedNode._scrollToLine : undefined}
            />
        );
    };

    return (
        <aside
            style={{ width }}
            className="insight-panel flex flex-col shrink-0 border-l border-[var(--border)] shadow-2xl z-10 relative bg-[var(--bg-surface)]"
        >
            {/* Resize Handle */}
            <div
                onMouseDown={onStartResize}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent-teal)]/20 active:bg-[var(--accent-teal)]/50 transition-colors z-40"
            />

            {/* Header */}
            <header
                className="h-10 px-5 border-b border-[var(--border)] flex items-center justify-between shrink-0 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={onToggleCollapse}
                role="button"
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Expand code panel' : 'Collapse code panel'}
            >
                <div className="flex items-center gap-3 overflow-hidden mr-4">
                    <button
                        aria-label={isCollapsed ? 'Expand code panel' : 'Collapse code panel'}
                        className="text-slate-500 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)] focus-visible:outline-none"
                    >
                        <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'left'}`}></i>
                    </button>
                    <i className="fas fa-terminal text-[var(--accent-teal)] text-[10px]"></i>
                    <span className="text-[10px] font-mono text-slate-300 truncate uppercase tracking-tighter">
                        RAW SOURCE <span className="text-slate-500 lowercase ml-2">{selectedNode?.id || "select a symbol"}</span>
                    </span>
                </div>
            </header>

            {/* Code Content */}
            <div className={`flex-1 overflow-auto custom-scrollbar bg-[var(--bg-surface)] ${isCollapsed ? 'hidden' : ''}`}>
                {renderCode()}
            </div>

            {/* Knowledge Links */}
            {!isCollapsed && knowledgeLinks.length > 0 && (
                <div className="border-t border-[var(--border)] px-4 py-3 shrink-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                        <i className="fas fa-link" style={{ color: OKF_COLORS.BRIDGE_EDGE }}></i>
                        Knowledge Links
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-auto">
                        {knowledgeLinks.map(link => (
                            <div
                                key={link.conceptId}
                                className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-main)] rounded hover:bg-white/5 cursor-pointer transition-colors group"
                                title={link.conceptId}
                            >
                                <i className="fas fa-link text-[9px]" style={{ color: OKF_COLORS.NODE }}></i>
                                <span className="font-mono text-[10px] text-gray-300 truncate group-hover:text-white transition-colors">
                                    {link.conceptId}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default CodePanel;
