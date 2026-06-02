import { useCallback } from 'react';
import { NarrativeMessage } from '../context/NarrativeContext';
import { askAIStream } from '../services/geminiService';
import { logger } from '../logger';
import { IntentRoute } from '../utils/queryClassifier';

interface UseIntentRouterProps {
  dataApiBase: string;
  selectedProjectId: string;
  setViewMode: (mode: 'narrative' | 'map' | 'discovery' | 'architecture' | 'dashboard') => void;
  setNarrativeMessages: React.Dispatch<React.SetStateAction<NarrativeMessage[]>>;
  setIsNarrativeLoading: (loading: boolean) => void;
  addConversationTurn: (turn: any) => void;
  toast: any;
}

export function useIntentRouter({
  dataApiBase,
  selectedProjectId,
  setViewMode,
  setNarrativeMessages,
  setIsNarrativeLoading,
  addConversationTurn,
  toast,
}: UseIntentRouterProps) {
  const sendToAI = useCallback(async (
    task: string,
    query: string,
    onChunk?: (delta: string) => void
  ): Promise<string> => {
    try {
      return await askAIStream(dataApiBase, selectedProjectId, { task, query }, onChunk || (() => {}));
    } finally {
      setIsNarrativeLoading(false);
    }
  }, [dataApiBase, selectedProjectId, setIsNarrativeLoading]);

  const addUserMessage = useCallback((content: string, displayContent: string) => {
    const userMsg: NarrativeMessage = {
      role: 'user',
      content,
      displayContent,
      timestamp: Date.now(),
    };
    setNarrativeMessages(prev => [...prev, userMsg]);
    return userMsg;
  }, [setNarrativeMessages]);

  const addAIMessage = useCallback((content: string) => {
    const aiMsg: NarrativeMessage = {
      role: 'ai',
      content,
      timestamp: Date.now(),
    };
    setNarrativeMessages(prev => [...prev, aiMsg]);
    return aiMsg;
  }, [setNarrativeMessages]);

  const handleWithStreaming = useCallback(async (task: string, query: string, toastAction: string) => {
    setViewMode('narrative');
    toast.info(`${toastAction}: ${query}`);
    addUserMessage(query, query);
    setIsNarrativeLoading(true);

    const idxRef = { current: -1 };
    setNarrativeMessages(prev => {
      idxRef.current = prev.length;
      return [...prev, { role: 'ai', content: '', timestamp: Date.now() }];
    });

    try {
      await sendToAI(task, query, (delta) => {
        setNarrativeMessages(prev => prev.map((m, i) =>
          i === idxRef.current ? { ...m, content: m.content + delta } : m
        ));
      });
    } catch (error: any) {
      logger.error(`[useIntentRouter] ${task} error:`, error);
      setNarrativeMessages(prev => prev.map((m, i) =>
        i === idxRef.current ? { ...m, content: `Error: ${error.message}` } : m
      ));
      toast.error(`${toastAction} failed: ${error.message}`);
    }
  }, [sendToAI, addUserMessage, setNarrativeMessages, setViewMode, setIsNarrativeLoading, toast]);

  const handleTestIntent = useCallback(async (query: string) => {
    await handleWithStreaming('test_generation', query, 'Generating tests');
    addConversationTurn({ user_input: query, intent: 'test_generation', datalog_query: '', result_count: 0, summary: 'Test generation', timestamp: Date.now() });
    return true;
  }, [handleWithStreaming, addConversationTurn]);

  const handleSecurityIntent = useCallback(async (query: string) => {
    await handleWithStreaming('security_audit', query, 'Analyzing security');
    addConversationTurn({ user_input: query, intent: 'security_audit', datalog_query: '', result_count: 0, summary: 'Security audit', timestamp: Date.now() });
    return true;
  }, [handleWithStreaming, addConversationTurn]);

  const handleRefactorIntent = useCallback(async (query: string) => {
    await handleWithStreaming('refactor', query, 'Analyzing refactoring opportunities');
    addConversationTurn({ user_input: query, intent: 'refactor', datalog_query: '', result_count: 0, summary: 'Refactor analysis', timestamp: Date.now() });
    return true;
  }, [handleWithStreaming, addConversationTurn]);

  const handlePerformanceIntent = useCallback(async (query: string) => {
    await handleWithStreaming('performance', query, 'Analyzing performance');
    addConversationTurn({ user_input: query, intent: 'performance', datalog_query: '', result_count: 0, summary: 'Performance analysis', timestamp: Date.now() });
    return true;
  }, [handleWithStreaming, addConversationTurn]);

  const handleIntent = useCallback(async (intentRoute: IntentRoute, query: string): Promise<boolean> => {
    switch (intentRoute) {
      case 'test':
        return handleTestIntent(query);
      case 'security':
        return handleSecurityIntent(query);
      case 'refactor':
        return handleRefactorIntent(query);
      case 'performance':
        return handlePerformanceIntent(query);
      default:
        return false;
    }
  }, [handleTestIntent, handleSecurityIntent, handleRefactorIntent, handlePerformanceIntent]);

  return { handleIntent };
}