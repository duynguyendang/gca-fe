import React, { useRef, useEffect } from 'react';

// Ensure Prism is available for highlighting
declare var Prism: any;

interface HighlightedCodeProps {
    code: string;
    language: string;
    startLine: number;
    scrollToLine?: number;
}

const HighlightedCode = React.forwardRef<HTMLDivElement, HighlightedCodeProps>(({ code, language, startLine, scrollToLine }, ref) => {
    const codeRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const highlightTimeoutRef = useRef<number>();

    useEffect(() => {
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }

        highlightTimeoutRef.current = window.setTimeout(() => {
            if (codeRef.current && typeof Prism !== 'undefined') {
                try {
                    Prism.highlightElement(codeRef.current);
                } catch (e) {
                    console.warn('Prism highlight error:', e);
                }
            }
        }, 100);

        return () => {
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, [code, language]);

    useEffect(() => {
        if (scrollToLine && containerRef.current) {
            const lineElements = containerRef.current.querySelectorAll('.code-line');
            const targetIndex = scrollToLine - startLine - 1;
            if (targetIndex >= 0 && targetIndex < lineElements.length) {
                const targetLine = lineElements[targetIndex];
                if (targetLine) {
                    targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetLine.classList.add('bg-[#00f2ff]/10');
                    setTimeout(() => targetLine.classList.remove('bg-[#00f2ff]/10'), 2000);
                }
            }
        }
    }, [scrollToLine, startLine]);

    const lines = (code || "").split('\n');
    return (
        <div ref={containerRef} className="flex bg-[#0d171d] min-h-full font-mono text-[11px]">
            <div className="bg-[#0a1118] text-slate-700 text-right pr-3 pl-2 select-none border-r border-white/5 py-4 min-w-[3.5rem]">
                {lines.map((_, i) => <div key={i} className="leading-5 h-5 code-line">{startLine + i}</div>)}
            </div>
            <div className="flex-1 overflow-x-auto py-4 px-4 relative">
                <pre className="m-0 p-0 bg-transparent">
                    <code ref={codeRef} className={`language-${language} leading-5 block`}>{code}</code>
                </pre>
            </div>
        </div>
    );
});

export default HighlightedCode;
