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
    onStartResize: (e: React.MouseEvent) => void;
}

const CodePanel: React.FC<CodePanelProps> = ({
    width,
    isCollapsed,
    onToggleCollapse,
    onStartResize
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
            >
                <div className="flex items-center gap-3 overflow-hidden mr-4">
                    <button
                        className="text-slate-500 transition-colors"
                    >
                        <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'left'}`}></i>
                    </button>
                    <i className="fas fa-terminal text-[var(--accent-teal)] text-[10px]"></i>
                    <span className="text-[10px] font-mono text-slate-300 truncate uppercase tracking-tighter">
                        RAW SOURCE <span className="text-slate-500 lowercase ml-2">{selectedNode?.id || "idle"}</span>
                    </span>
                </div>
            </header>

            {/* Code Content */}
            <div className={`flex-1 overflow-auto custom-scrollbar bg-[var(--bg-surface)] ${isCollapsed ? 'hidden' : ''}`}>
                {renderCode()}
            </div>
        </aside>
    );
};

export default CodePanel;
