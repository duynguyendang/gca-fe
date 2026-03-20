import { useState, useCallback } from 'react';
import { executeAgent, AgentStep, AgentResponse } from '../services/geminiService';
import { logger } from '../src/logger';

interface UseAgentOptions {
  dataApiBase: string;
  selectedProjectId: string;
  onNarrativeReady?: (narrative: string) => void;
  onStepsReady?: (steps: AgentStep[]) => void;
}

export const useAgent = (options: UseAgentOptions) => {
  const { dataApiBase, selectedProjectId, onNarrativeReady, onStepsReady } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [narrative, setNarrative] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runAgent = useCallback(async (query: string) => {
    if (!dataApiBase || !selectedProjectId || !query) return;

    setIsRunning(true);
    setError(null);
    setSteps([]);
    setNarrative('');

    try {
      logger.log('[useAgent] Starting agent execution:', query);

      const response: AgentResponse = await executeAgent(
        dataApiBase,
        selectedProjectId,
        query
      );

      logger.log('[useAgent] Agent completed:', response.session_id);

      setSteps(response.steps);
      setNarrative(response.narrative);

      if (onStepsReady) onStepsReady(response.steps);
      if (onNarrativeReady) onNarrativeReady(response.narrative);
    } catch (err: any) {
      logger.error('[useAgent] Agent execution failed:', err);
      setError(err.message || 'Agent execution failed');
    } finally {
      setIsRunning(false);
    }
  }, [dataApiBase, selectedProjectId, onNarrativeReady, onStepsReady]);

  return {
    runAgent,
    isRunning,
    steps,
    narrative,
    error,
  };
};

export default useAgent;
