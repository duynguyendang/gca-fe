/**
 * CodePanel - Right panel for displaying source code
 * Extracted from App.tsx renderCode function
 */
import React from 'react';
import HighlightedCode from '../HighlightedCode';
import { useAppContext } from '../../context/AppContext';

interface CodePanelProps {
    width: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onStartResize: () => void;
    children?: React.ReactNode;
}

const CodePanel: React.FC<CodePanelProps> = ({
    width,
    isCollapsed,
    onToggleCollapse,
    onStartResize,
    children
}) => {
    const { selectedNode, hydratingNodeId } = useAppContext();

    const renderCode = () => {
        if (!selectedNode) return (
            <div className="h-full flex items-center justify-center flex-col gap-4 grayscale opacity-20">
                <i className="fas fa-microchip text-5xl"></i>
                <p className="text-[9px] uppercase font-black tracking-[0.2em]">Select an Asset to Inspect</p>
            </div>
        );

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
                scrollToLine={selectedNode._scrollToLine}
            />
        );
    };

    return (
        <aside
            style={{ width }}
            className="code-panel flex flex-col shrink-0 border-l border-white/10 shadow-2xl z-10 relative bg-[#0d171d]"
        >
            {/* Resize Handle */}
            <div
                onMouseDown={onStartResize}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00f2ff]/20 active:bg-[#00f2ff]/50 transition-colors z-40"
            />

            {/* Header */}
            <header className="h-12 px-5 border-b border-white/5 flex items-center justify-between bg-[#0a1118] shrink-0">
                <div className="flex items-center gap-3 overflow-hidden mr-4">
                    <button
                        onClick={onToggleCollapse}
                        className="text-slate-500 hover:text-white transition-colors"
                    >
                        <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
                    </button>
                    <i className="fas fa-terminal text-[#00f2ff] text-[12px]"></i>
                    <span className="text-[10px] font-mono text-slate-300 truncate uppercase tracking-tighter">
                        {selectedNode?.id || "IDLE"}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-600 uppercase tracking-widest shrink-0">
                    {selectedNode?.kind && (
                        <span className="bg-[#16222a] px-2 py-1 rounded text-slate-400">{selectedNode.kind}</span>
                    )}
                    {selectedNode?.type && selectedNode.type !== selectedNode.kind && (
                        <span className="bg-[#16222a] px-2 py-1 rounded text-slate-400">{selectedNode.type}</span>
                    )}
                </div>
            </header>

            {/* Code Content */}
            <div className={`flex-1 overflow-auto custom-scrollbar ${isCollapsed ? 'hidden' : ''}`}>
                {renderCode()}
            </div>
            {children}
        </aside>
    );
};

export default CodePanel;
