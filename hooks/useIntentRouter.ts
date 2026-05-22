import { useCallback } from 'react';
import { NarrativeMessage } from '../context/NarrativeContext';
import { askAI } from '../services/geminiService';
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
  const sendToAI = useCallback(async (task: string, query: string): Promise<string> => {
    try {
      return await askAI(dataApiBase, selectedProjectId, { task, query });
    } catch (error: any) {
      logger.error('[useIntentRouter] AI error:', error);
      throw error;
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

  const handleTestIntent = useCallback(async (query: string) => {
    setViewMode('narrative');
    toast.info('Generating tests for: ' + query);
    addUserMessage(query, query);
    setIsNarrativeLoading(true);

    try {
      const aiResponse = await sendToAI('test_generation', query);
      addAIMessage(aiResponse);
    } catch (error: any) {
      logger.error('[useIntentRouter] Test generation error:', error);
      toast.error(`Test generation failed: ${error.message}`);
    }

    addConversationTurn({ user_input: query, intent: 'test_generation', datalog_query: '', result_count: 0, summary: 'Test generation', timestamp: Date.now() });
    return true;
  }, [sendToAI, addUserMessage, addAIMessage, setViewMode, setIsNarrativeLoading, toast, addConversationTurn]);

  const handleSecurityIntent = useCallback(async (query: string) => {
    setViewMode('narrative');
    toast.info('Analyzing security: ' + query);
    addUserMessage(query, query);
    setIsNarrativeLoading(true);

    try {
      const aiResponse = await sendToAI('security_audit', query);
      addAIMessage(aiResponse);
    } catch (error: any) {
      logger.error('[useIntentRouter] Security analysis error:', error);
      toast.error(`Security analysis failed: ${error.message}`);
    }

    addConversationTurn({ user_input: query, intent: 'security_audit', datalog_query: '', result_count: 0, summary: 'Security audit', timestamp: Date.now() });
    return true;
  }, [sendToAI, addUserMessage, addAIMessage, setViewMode, setIsNarrativeLoading, toast, addConversationTurn]);

  const handleRefactorIntent = useCallback(async (query: string) => {
    setViewMode('narrative');
    toast.info('Analyzing refactoring opportunities: ' + query);
    addUserMessage(query, query);
    setIsNarrativeLoading(true);

    try {
      const aiResponse = await sendToAI('refactor', query);
      addAIMessage(aiResponse);
    } catch (error: any) {
      logger.error('[useIntentRouter] Refactor analysis error:', error);
      toast.error(`Refactor analysis failed: ${error.message}`);
    }

    addConversationTurn({ user_input: query, intent: 'refactor', datalog_query: '', result_count: 0, summary: 'Refactor analysis', timestamp: Date.now() });
    return true;
  }, [sendToAI, addUserMessage, addAIMessage, setViewMode, setIsNarrativeLoading, toast, addConversationTurn]);

  const handlePerformanceIntent = useCallback(async (query: string) => {
    setViewMode('narrative');
    toast.info('Analyzing performance: ' + query);
    addUserMessage(query, query);
    setIsNarrativeLoading(true);

    try {
      const aiResponse = await sendToAI('performance', query);
      addAIMessage(aiResponse);
    } catch (error: any) {
      logger.error('[useIntentRouter] Performance analysis error:', error);
      toast.error(`Performance analysis failed: ${error.message}`);
    }

    addConversationTurn({ user_input: query, intent: 'performance', datalog_query: '', result_count: 0, summary: 'Performance analysis', timestamp: Date.now() });
    return true;
  }, [sendToAI, addUserMessage, addAIMessage, setViewMode, setIsNarrativeLoading, toast, addConversationTurn]);

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