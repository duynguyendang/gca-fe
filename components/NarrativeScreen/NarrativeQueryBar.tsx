import React, { useState, useCallback } from 'react';
import { useAppContext, NarrativeMessage, NarrativeSection } from '../../context/AppContext';
import { askAI } from '../../services/geminiService';

const SUGGESTION_CHIPS = [
    'NARRATE BOOT SEQUENCE',
    'FIND DEAD CODE',
    'EXPLAIN DATA FLOW',
];

const NarrativeQueryBar: React.FC = () => {
    const {
        dataApiBase,
        selectedProjectId,
        narrativeMessages,
        setNarrativeMessages,
        isNarrativeLoading,
        setIsNarrativeLoading,
        fileScopedNodes,
        searchTerm,
        setSearchTerm,
    } = useAppContext();

    const parseAIResponse = (raw: string): NarrativeSection[] => {
        const sections: NarrativeSection[] = [];

        // Try to detect section patterns in the response
        // Pattern: **SECTION_TITLE** or ## SECTION_TITLE
        const sectionRegex = /(?:^|\n)(?:#{1,3}\s+|(?:\*\*))([A-Z][A-Z\s_]+?)(?:\*\*)?(?:\n)/g;
        let lastIndex = 0;
        let match;
        const parts: { title: string; start: number }[] = [];

        while ((match = sectionRegex.exec(raw)) !== null) {
            parts.push({ title: match[1].trim(), start: match.index + match[0].length });
            if (parts.length > 1) {
                parts[parts.length - 2].start = parts[parts.length - 2].start;
            }
        }

        if (parts.length > 0) {
            for (let i = 0; i < parts.length; i++) {
                const endIdx = i + 1 < parts.length
                    ? raw.lastIndexOf('\n', raw.indexOf(parts[i + 1].title, parts[i].start))
                    : raw.length;
                const content = raw.substring(parts[i].start, endIdx).trim();
                const titleLower = parts[i].title.toLowerCase();

                let type: NarrativeSection['type'] = 'info';
                if (titleLower.includes('summary') || titleLower.includes('overview') || titleLower.includes('analysis')) {
                    type = 'summary';
                } else if (titleLower.includes('inconsisten') || titleLower.includes('warning') || titleLower.includes('issue') || titleLower.includes('problem')) {
                    type = 'inconsistency';
                } else if (titleLower.includes('architect') || titleLower.includes('gravity') || titleLower.includes('metric') || titleLower.includes('structure')) {
                    type = 'gravity';
                }

                sections.push({
                    type,
                    title: parts[i].title.replace(/_/g, ' '),
                    content,
                    actionLabel: type === 'inconsistency' ? 'GENERATE FIX NARRATIVE' : undefined,
                });
            }
        }

        // If no sections detected, wrap the whole response as a summary
        if (sections.length === 0) {
            sections.push({
                type: 'summary',
                title: 'EXECUTIVE LOGIC SUMMARY',
                content: raw,
            });
        }

        return sections;
    };

    const submitQuery = useCallback(async (q: string) => {
        if (!q.trim() || isNarrativeLoading || !dataApiBase || !selectedProjectId) return;

        const userMsg: NarrativeMessage = {
            role: 'user',
            content: q,
            timestamp: Date.now(),
        };

        setNarrativeMessages(prev => [...prev, userMsg]);
        setIsNarrativeLoading(true);

        try {
            // Build context from currently visible nodes
            const contextData = fileScopedNodes.slice(0, 20).map(n => ({
                id: n.id,
                name: n.name,
                kind: n.kind || n.type,
            }));

            const answer = await askAI(dataApiBase, selectedProjectId, {
                task: 'chat',
                query: `You are a Narrative Engine for codebase analysis. Analyze and respond with structured sections using markdown headers. Use headers like "## EXECUTIVE LOGIC SUMMARY", "## LOGICAL INCONSISTENCY", "## ARCHITECTURAL GRAVITY" where appropriate.\n\nUser query: ${q}`,
                data: contextData.length > 0 ? contextData : undefined,
            });

            const sections = parseAIResponse(answer);

            const aiMsg: NarrativeMessage = {
                role: 'ai',
                content: answer,
                sections,
                timestamp: Date.now(),
            };

            setNarrativeMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            const errMsg: NarrativeMessage = {
                role: 'ai',
                content: `Analysis failed: ${err.message || 'Connection error'}`,
                sections: [{
                    type: 'inconsistency',
                    title: 'CONNECTION ERROR',
                    content: `Failed to reach the Narrative Engine. ${err.message || ''}`,
                }],
                timestamp: Date.now(),
            };
            setNarrativeMessages(prev => [...prev, errMsg]);
        } finally {
            setIsNarrativeLoading(false);
        }
    }, [dataApiBase, selectedProjectId, isNarrativeLoading, fileScopedNodes, setNarrativeMessages, setIsNarrativeLoading]);

    const handleSubmit = () => submitQuery(searchTerm);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="shrink-0 bg-[var(--bg-main)]/95 backdrop-blur-xl border-t border-[var(--border)] px-6 py-4 flex items-center justify-between gap-6">
            {/* Suggestion Chips - Centered */}
            <div className="flex flex-wrap gap-2 flex-1 justify-center">
                {SUGGESTION_CHIPS.map((chip, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            setSearchTerm(chip.toLowerCase());
                            submitQuery(chip.toLowerCase());
                        }}
                        disabled={isNarrativeLoading}
                        className="px-4 py-2 bg-[#16222a] border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-white hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5 disabled:opacity-30 transition-all font-mono"
                    >
                        "{chip}"
                    </button>
                ))}
            </div>

            {/* Consult Button - Right Aligned */}
            <button
                onClick={handleSubmit}
                disabled={!searchTerm.trim() || isNarrativeLoading || !dataApiBase || !selectedProjectId}
                className="shrink-0 px-8 py-3 bg-[var(--accent-blue)] text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 flex items-center gap-2"
            >
                {isNarrativeLoading ? (
                    <>
                        <i className="fas fa-circle-notch animate-spin"></i>
                        THINKING...
                    </>
                ) : (
                    <>
                        <i className="fas fa-bolt text-xs opacity-80"></i>
                        CONSULT
                    </>
                )}
            </button>
        </div>
    );
};

export default NarrativeQueryBar;
