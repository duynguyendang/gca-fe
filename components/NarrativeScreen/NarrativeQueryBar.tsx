import React, { useState, useCallback } from 'react';
import { useAppContext, NarrativeMessage, NarrativeSection } from '../../context/AppContext';
import { askAI } from '../../services/geminiService';

const SUGGESTION_CHIPS = [
    'NARRATE THE BOOT SEQUENCE',
    'IDENTIFY CIRCULAR LOGIC',
    'SHOW ARCHITECTURE MAP',
    'EXPLAIN DATA FLOW',
    'FIND DEAD CODE',
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
    } = useAppContext();
    const [query, setQuery] = useState('');

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
        setQuery('');
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

    const handleSubmit = () => submitQuery(query);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="shrink-0 bg-[#0a1118]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4">
            {/* Query Input Bar */}
            <div className="flex items-center gap-3 bg-[#16222a] border border-white/10 rounded-xl px-4 py-3 mb-3 focus-within:border-[#00f2ff]/30 transition-all narrative-glow">
                {/* Icon */}
                <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#00f2ff]/20 to-[#a855f7]/20 flex items-center justify-center border border-white/10">
                    <i className="fas fa-bolt text-[#00f2ff] text-sm"></i>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-600 mb-0.5">
                        QUERYING NARRATIVE ENGINE
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me to explain a logic flow or predict a bottleneck..."
                        className="w-full bg-transparent border-none text-sm text-white placeholder-slate-600 focus:outline-none font-medium"
                        disabled={isNarrativeLoading}
                    />
                </div>

                {/* Mic (decorative) */}
                <button className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors p-2">
                    <i className="fas fa-microphone"></i>
                </button>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={!query.trim() || isNarrativeLoading || !dataApiBase || !selectedProjectId}
                    className="shrink-0 px-6 py-2.5 bg-[#00f2ff] text-[#0a1118] rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(0,242,255,0.3)] active:scale-95"
                >
                    {isNarrativeLoading ? (
                        <i className="fas fa-circle-notch animate-spin"></i>
                    ) : (
                        'CONSULT'
                    )}
                </button>
            </div>

            {/* Suggestion Chips */}
            <div className="flex flex-wrap gap-2">
                {SUGGESTION_CHIPS.map((chip, i) => (
                    <button
                        key={i}
                        onClick={() => submitQuery(chip.toLowerCase())}
                        disabled={isNarrativeLoading}
                        className="px-4 py-2 bg-[#16222a] border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-white hover:border-[#00f2ff]/30 hover:bg-[#00f2ff]/5 disabled:opacity-30 transition-all"
                    >
                        "{chip}"
                    </button>
                ))}
            </div>
        </div>
    );
};

export default NarrativeQueryBar;
