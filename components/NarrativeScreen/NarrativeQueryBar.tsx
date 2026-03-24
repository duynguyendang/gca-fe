import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppContext, NarrativeMessage, NarrativeSection } from '../../context/AppContext';
import { askAI } from '../../services/geminiService';
import { fetchSummary, fetchSource } from '../../services/graphService';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

interface SuggestionGroup {
    label: string;
    icon: string;
    color: string;
    questions: string[];
}

const NarrativeQueryBar: React.FC = () => {
    const {
        dataApiBase,
        selectedProjectId,
        narrativeMessages,
        setNarrativeMessages,
        isNarrativeLoading,
        setIsNarrativeLoading,
        fileScopedNodes,
        selectedNode,
        searchTerm,
        setSearchTerm,
    } = useAppContext();

    // Dynamically generate suggestions based on project context
    const [projectContext, setProjectContext] = useState<{
        hasTests: boolean;
        hasSecurity: boolean;
        hasApi: boolean;
        fileCount: number;
    } | null>(null);
    
    // Project summary for better AI context
    const [projectSummary, setProjectSummary] = useState<any>(null);

    // Fetch project context on mount
    React.useEffect(() => {
        if (!dataApiBase || !selectedProjectId) return;

        const fetchProjectContext = async () => {
            try {
                const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
                const filesRes = await fetchWithTimeout(`${cleanBase}/v1/files?project=${encodeURIComponent(selectedProjectId)}`);
                if (filesRes.ok) {
                    const files: string[] = await filesRes.json();
                    
                    const hasTests = files.some(f => f.includes('_test.') || f.includes('.test.') || f.includes('.spec.'));
                    const hasSecurity = files.some(f =>
                        f.includes('auth') || f.includes('security') || f.includes('permission') ||
                        f.includes('login') || f.includes('jwt') || f.includes('oauth')
                    );
                    const hasApi = files.some(f =>
                        f.includes('handler') || f.includes('controller') || f.includes('route') ||
                        f.includes('endpoint') || f.includes('api')
                    );

                    setProjectContext({
                        hasTests,
                        hasSecurity,
                        hasApi,
                        fileCount: files.length,
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch project context:', e);
            }
        };

        fetchProjectContext();
    }, [dataApiBase, selectedProjectId]);
    
    // Fetch project summary for better AI context
    React.useEffect(() => {
        if (!dataApiBase || !selectedProjectId) return;
        
        const fetchProjectSummary = async () => {
            try {
                const summary = await fetchSummary(dataApiBase, selectedProjectId);
                setProjectSummary(summary);
            } catch (e) {
                console.warn('Failed to fetch project summary:', e);
            }
        };
        
        fetchProjectSummary();
    }, [dataApiBase, selectedProjectId]);

    // Dynamic suggestions based on project context
    const dynamicSuggestions = useMemo((): SuggestionGroup[] => {
        const groups: SuggestionGroup[] = [];

        // Always available - Narrative/Flow
        groups.push({
            label: 'Flow',
            icon: 'fa-route',
            color: 'blue',
            questions: projectContext?.hasApi
                ? ['Trace the API request flow', 'Explain the boot sequence', 'How does authentication work?']
                : ['Explain how the app starts up', 'Trace the data flow', 'Show execution path'],
        });

        // Architecture - always useful
        groups.push({
            label: 'Architecture',
            icon: 'fa-sitemap',
            color: 'purple',
            questions: projectContext && projectContext.fileCount > 50
                ? ['Analyze the module structure', 'What are the core components?', 'Show dependency hierarchy']
                : ['Analyze file organization', 'What are the main files?', 'Show imports'],
        });

        // Resolve - always useful when files loaded
        if (fileScopedNodes.length > 0) {
            const firstFile = fileScopedNodes[0]?.name || 'this';
            groups.push({
                label: 'Find',
                icon: 'fa-search',
                color: 'green',
                questions: [
                    `Where is ${firstFile} defined?`,
                    'Find the main handler',
                    'Who calls this function?',
                ],
            });
        }

        // Test - if no tests found
        if (!projectContext?.hasTests) {
            groups.push({
                label: 'Missing Tests',
                icon: 'fa-vial',
                color: 'teal',
                questions: [
                    'Generate test structure',
                    'Suggest test coverage areas',
                    'Where to add tests?',
                ],
            });
        }

        // Security - if security-related files exist
        if (projectContext?.hasSecurity) {
            groups.push({
                label: 'Security',
                icon: 'fa-shield-alt',
                color: 'red',
                questions: [
                    'Audit authentication flow',
                    'Check permission checks',
                    'Find security vulnerabilities',
                ],
            });
        }

        // Refactor - always useful
        groups.push({
            label: 'Refactor',
            icon: 'fa-wrench',
            color: 'amber',
            questions: [
                'Find code duplication',
                'Suggest refactoring',
                'Identify technical debt',
            ],
        });

        // Performance - for larger projects
        if (projectContext && projectContext.fileCount > 20) {
            groups.push({
                label: 'Performance',
                icon: 'fa-bolt',
                color: 'orange',
                questions: [
                    'Find performance bottlenecks',
                    'Analyze algorithmic complexity',
                    'Identify expensive operations',
                ],
            });
        }

        return groups;
    }, [projectContext, fileScopedNodes]);

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
            // Build context from project summary and selected node - always fetch fresh data for the selected project
            let contextData: any[] = [];
            
            // If there's a selected node (e.g., from source navigator), include it in the context
            if (selectedNode) {
                let nodeCode = selectedNode.code;
                
                // If the selected node doesn't have code, fetch it from the source API
                if (!nodeCode && selectedNode.id) {
                    try {
                        nodeCode = await fetchSource(dataApiBase, selectedProjectId, selectedNode.id);
                    } catch (e) {
                        console.warn('Failed to fetch source for selected node:', e);
                    }
                }
                
                contextData.push({
                    id: selectedNode.id,
                    name: selectedNode.name,
                    kind: selectedNode.kind || selectedNode.type,
                    code: nodeCode,
                    filePath: selectedNode.filePath,
                    start_line: selectedNode.start_line,
                    end_line: selectedNode.end_line,
                });
            }
            
            // Fetch fresh project summary to ensure context is relevant to selected project
            try {
                const freshSummary = await fetchSummary(dataApiBase, selectedProjectId);
                if (freshSummary?.top_symbols) {
                    // Add top symbols, but filter out the selected node if it's already included
                    const selectedNodeId = selectedNode?.id;
                    const topSymbols = freshSummary.top_symbols
                        .filter((s: any) => s.id !== selectedNodeId)
                        .slice(0, selectedNode ? 10 : 15)
                        .map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            kind: s.kind || s.type,
                        }));
                    contextData = [...contextData, ...topSymbols];
                }
            } catch (e) {
                console.warn('Failed to fetch fresh project summary:', e);
                // Fallback to cached summary if available
                if (projectSummary?.top_symbols) {
                    const selectedNodeId = selectedNode?.id;
                    const topSymbols = projectSummary.top_symbols
                        .filter((s: any) => s.id !== selectedNodeId)
                        .slice(0, selectedNode ? 10 : 15)
                        .map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            kind: s.kind || s.type,
                        }));
                    contextData = [...contextData, ...topSymbols];
                }
            }

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
    }, [dataApiBase, selectedProjectId, selectedNode, isNarrativeLoading, setNarrativeMessages, setIsNarrativeLoading]);

    const handleSubmit = () => submitQuery(searchTerm);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const getColorClass = (color: string) => {
        switch (color) {
            case 'blue': return 'hover:text-blue-400 hover:border-blue-400/30';
            case 'purple': return 'hover:text-purple-400 hover:border-purple-400/30';
            case 'green': return 'hover:text-green-400 hover:border-green-400/30';
            case 'amber': return 'hover:text-amber-400 hover:border-amber-400/30';
            case 'teal': return 'hover:text-teal-400 hover:border-teal-400/30';
            case 'red': return 'hover:text-red-400 hover:border-red-400/30';
            case 'orange': return 'hover:text-orange-400 hover:border-orange-400/30';
            default: return 'hover:text-white hover:border-white/30';
        }
    };

    return (
        <div className="shrink-0 bg-[var(--bg-main)]/95 backdrop-blur-xl border-t border-[var(--border)] px-6 py-4">
            {/* Proactive Suggestions - Show after last AI message */}
            {narrativeMessages.length > 0 && narrativeMessages[narrativeMessages.length - 1]?.role === 'ai' && !isNarrativeLoading && (
                <div className="mb-4 flex flex-wrap gap-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mr-2">Suggested follow-ups:</span>
                    {[
                        'Tell me more about this',
                        'Show me the code',
                        'Find similar patterns',
                        'What are the risks?',
                    ].map((suggestion, i) => (
                        <button
                            key={i}
                            onClick={() => submitQuery(suggestion)}
                            disabled={isNarrativeLoading}
                            className="px-3 py-1.5 bg-[#16222a] border border-white/10 rounded text-[9px] text-slate-400 hover:text-white hover:border-[var(--accent-blue)]/30 disabled:opacity-30 transition-all"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your codebase..."
                        disabled={isNarrativeLoading}
                        className="w-full px-4 py-3 bg-[#16222a] border border-white/10 rounded-xl text-[13px] text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent-blue)]/50 disabled:opacity-50 transition-all"
                    />
                    {isNarrativeLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <i className="fas fa-circle-notch animate-spin text-[var(--accent-blue)]"></i>
                        </div>
                    )}
                </div>
                
                <button
                    onClick={handleSubmit}
                    disabled={!searchTerm.trim() || isNarrativeLoading || !dataApiBase || !selectedProjectId}
                    className="px-6 py-3 bg-[var(--accent-blue)] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95"
                >
                    {isNarrativeLoading ? (
                        <i className="fas fa-circle-notch animate-spin"></i>
                    ) : (
                        <i className="fas fa-paper-plane"></i>
                    )}
                </button>
            </div>

            {/* Quick Suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
                {dynamicSuggestions.slice(0, 3).map((group, gIdx) => (
                    group.questions.slice(0, 1).map((chip, i) => (
                        <button
                            key={`${group.label}-${i}`}
                            onClick={() => submitQuery(chip.toLowerCase())}
                            disabled={isNarrativeLoading}
                            className={`px-3 py-1.5 bg-[#16222a] border border-white/10 rounded text-[8px] font-bold text-slate-400 ${getColorClass(group.color)} disabled:opacity-30 transition-all`}
                            title={`${group.label} - Click to query`}
                        >
                            <i className={`fas ${group.icon} mr-1.5 opacity-50`}></i>
                            {chip}
                        </button>
                    ))
                ))}
            </div>
        </div>
    );
};

export default NarrativeQueryBar;
