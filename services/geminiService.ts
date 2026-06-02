
/**
 * Gemini Service (Refactored)
 *
 * Replaces direct Google GenAI client with calls to the Go Backend Proxy.
 * Endpoint: POST /api/v1/ai/ask
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { readSSEStream } from '../utils/sseStream';
import { API_CONFIG } from '../constants';
import { logger } from '../logger';

/**
 * Safely extract JSON from AI response text
 * Handles cases where AI wraps JSON in markdown code blocks or adds extra text
 */
function extractJSON<T>(text: string, fallback: T): T {
    if (!text || typeof text !== 'string') {
        return fallback;
    }

    // Try direct JSON parse first
    try {
        return JSON.parse(text);
    } catch {
        // Continue with extraction
    }

    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

    // State machine: string-aware brace matching
    let firstBrace = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (firstBrace === -1) {
            if (ch === '{') firstBrace = i;
            continue;
        }
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        if (ch === '}') {
            if (depth === 0) {
                const candidate = cleaned.slice(firstBrace, i + 1);
                try { return JSON.parse(candidate); } catch { return fallback; }
            }
            depth--;
        }
    }

    logger.warn('[GeminiService] Failed to extract JSON: no complete object found');
    return fallback;
}

/**
 * Core Proxy Function
 */
export const askAI = async (
  dataApiBase: string,
  projectId: string,
  payload: {
    task?: string;
    query?: string;
    symbol_id?: string;
    data?: any;
    context_mode?: string;
    query_instruction?: string;
  },
  signal?: AbortSignal | null
): Promise<string> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/ai/ask`;

  // Truncate context data to prevent oversized requests
  let contextData = payload.data;
  if (Array.isArray(contextData)) {
    const MAX_CONTEXT_ITEMS = 15;
    const MAX_CODE_PER_ITEM = 1500;
    if (contextData.length > MAX_CONTEXT_ITEMS) {
      logger.warn(`[GeminiService] Truncating context from ${contextData.length} to ${MAX_CONTEXT_ITEMS} items`);
      contextData = contextData.slice(0, MAX_CONTEXT_ITEMS);
    }
    contextData = contextData.map((item: any) => {
      if (item.code && item.code.length > MAX_CODE_PER_ITEM) {
        return { ...item, code: item.code.substring(0, MAX_CODE_PER_ITEM) + '\n...[truncated]' };
      }
      return item;
    });
  }

  const body = JSON.stringify({
    project_id: projectId,
    task: payload.task || 'chat',
    query: payload.query || '',
    symbol_id: payload.symbol_id || '',
    data: contextData || null,
    context_mode: payload.context_mode || '',
    query_instruction: payload.query_instruction || ''
  });

  logger.log(`[GeminiService] POST ${url} (${(body.length / 1024).toFixed(1)}KB body)`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body,
  }, API_CONFIG.TIMEOUT.LONG, signal);

  if (!response.ok) {
    const errText = await response.text();
    logger.error('[GeminiService] Backend Error:', response.status, errText);
    throw new Error(`AI Service Error: ${response.statusText}`);
  }

  let full = '';
  for await (const delta of readSSEStream(response, signal)) {
    full += delta;
  }
  return full || "No response from AI.";
};

/**
 * Streaming variant of askAI. Delivers each SSE token delta via onChunk,
 * then returns the full accumulated text. Reads /api/v1/ai/ask as SSE.
 */
export const askAIStream = async (
  dataApiBase: string,
  projectId: string,
  payload: {
    task?: string;
    query?: string;
    symbol_id?: string;
    data?: any;
    context_mode?: string;
    query_instruction?: string;
  },
  onChunk: (delta: string) => void,
  signal?: AbortSignal | null
): Promise<string> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/ai/ask`;

  let contextData = payload.data;
  if (Array.isArray(contextData)) {
    const MAX_CONTEXT_ITEMS = 15;
    const MAX_CODE_PER_ITEM = 1500;
    if (contextData.length > MAX_CONTEXT_ITEMS) {
      logger.warn(`[GeminiService] Truncating context from ${contextData.length} to ${MAX_CONTEXT_ITEMS} items`);
      contextData = contextData.slice(0, MAX_CONTEXT_ITEMS);
    }
    contextData = contextData.map((item: any) => {
      if (item.code && item.code.length > MAX_CODE_PER_ITEM) {
        return { ...item, code: item.code.substring(0, MAX_CODE_PER_ITEM) + '\n...[truncated]' };
      }
      return item;
    });
  }

  const body = JSON.stringify({
    project_id: projectId,
    task: payload.task || 'chat',
    query: payload.query || '',
    symbol_id: payload.symbol_id || '',
    data: contextData || null,
    context_mode: payload.context_mode || '',
    query_instruction: payload.query_instruction || ''
  });

  logger.log(`[GeminiService] POST ${url} (streaming, ${(body.length / 1024).toFixed(1)}KB body)`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body,
  }, API_CONFIG.TIMEOUT.LONG, signal);

  if (!response.ok) {
    const errText = await response.text();
    logger.error('[GeminiService] Backend Stream Error:', response.status, errText);
    throw new Error(`AI Service Error: ${response.statusText}`);
  }

  let full = '';
  for await (const delta of readSSEStream(response, signal)) {
    full += delta;
    onChunk(delta);
  }
  return full || "No response from AI.";
};

// --- Legacy Function Mappers ---

/**
 * Get architectural insight for a specific node
 */
export const getGeminiInsight = async (
  node: any,
  context: any,
  dataApiBase: string,
  projectId: string,
  activeSubMode: string = 'NARRATIVE'
) => {
  if (!node) return null;
  // Backend Task: "insight"

  let instruction = "";
  if (activeSubMode === 'NARRATIVE') {
    instruction = `Include a structured JSON block for the "Execution Sequence" at the VERY END.
    JSON Format: \`\`\`json { "steps": [ { "id": 1, "title": "Step Name", "icon": "LogIn|ShieldCheck|Key|Zap|Database|Brain", "description": "Short description", "nodeId": "exact:symbol:id" } ] } \`\`\``;
  } else if (activeSubMode === 'ARCHITECTURE') {
    instruction = `Include a structured JSON block for the "Metrics" and "Patterns" at the VERY END.
    JSON Format: \`\`\`json { "architecture": { "inDegree": 12, "outDegree": 4, "cohesion": "High", "coupling": "Low", "patterns": [ { "name": "Singleton", "weight": "95%" } ] } } \`\`\``;
  } else if (activeSubMode === 'ENTROPY') {
    instruction = `Include a structured JSON block for "Entropy" at the VERY END.
    JSON Format: \`\`\`json { "entropy": { "riskScore": 78, "technicalDebt": "3.2d", "testCoverage": "42%", "churnRate": "High" } } \`\`\``;
  }

  return await askAI(dataApiBase, projectId, {
    task: 'insight',
    symbol_id: node.id,
    query_instruction: instruction
  });
};

/**
 * Prune nodes (Top 7)
 */
export const pruneNodesWithAI = async (
  nodes: any[],
  dataApiBase: string,
  projectId: string,
): Promise<{ selectedIds: string[], explanation: string }> => {
  if (!nodes || nodes.length === 0) return { selectedIds: [], explanation: "No nodes." };

  // Backend Task: "prune"
  // Send nodes as data
  const answer = await askAI(dataApiBase, projectId, {
    task: 'prune',
    data: nodes.map(n => ({ id: n.id, name: n.name, kind: n.kind }))
  });

  try {
    return extractJSON(answer, { selectedIds: nodes.slice(0, 7).map(n => n.id), explanation: "AI parsing failed. Showing top 7." });
  } catch (e) {
    logger.warn('[GeminiService] Failed to parse prune response:', e);
    return { selectedIds: nodes.slice(0, 7).map(n => n.id), explanation: "AI parsing failed. Showing top 7." };
  }
};

/**
 * Get architecture summary for a file
 */
export const getArchitectureSummary = async (
  fileName: string,
  nodes: any[],
  dataApiBase: string,
  projectId: string,
): Promise<string> => {
  // Backend Task: "summary"
  return await askAI(dataApiBase, projectId, {
    task: 'summary',
    query: fileName,
    data: nodes.map(n => ({ name: n.name, kind: n.kind }))
  });
};

/**
 * Generate narrative for Architecture Flow
 */
export const getArchitectureNarrative = async (
  nodes: any[],
  links: any[],
  dataApiBase: string,
  projectId: string,
): Promise<string> => {
  // Backend Task: "narrative"
  return await askAI(dataApiBase, projectId, {
    task: 'narrative',
    data: nodes.map(n => ({ name: n.name }))
  });
};

/**
 * Resolve user query to a specific Symbol ID
 */
export const resolveSymbolFromQuery = async (
  query: string,
  candidateSymbols: string[],
  dataApiBase: string,
  projectId: string,
): Promise<string | null> => {
  // Backend Task: "resolve_symbol"
  const answer = await askAI(dataApiBase, projectId, {
    task: 'resolve_symbol',
    query: query,
    data: candidateSymbols
  });

  const trimmed = answer.trim();
  if (trimmed === "null" || trimmed === "") return null;
  return trimmed;
};

/**
 * Find logical start and end points
 */
export const findPathEndpoints = async (
  query: string,
  candidateSymbols: string[],
  dataApiBase: string,
  projectId: string,
): Promise<{ from: string, to: string } | null> => {
  // Backend Task: "path_endpoints"
  const answer = await askAI(dataApiBase, projectId, {
    task: 'path_endpoints',
    query: query,
    data: candidateSymbols
  });

  try {
    return extractJSON<{ from: string; to: string } | null>(answer, null);
  } catch {
    return null;
  }
};

/**
 * Contextual Chat Answer
 */
export const generateAnswerForSymbol = async (
  query: string,
  symbolId: string,
  symbolDetails: any,
  dataApiBase: string,
  projectId: string,
): Promise<string> => {
  const instruction = `
  If the query asks to explain or narrate a logic flow, your response MUST include a structured JSON block for the "Execution Sequence" at the VERY END.
  
  JSON Format:
  \`\`\`json
  {
    "steps": [
      { "id": 1, "title": "Step Name", "icon": "LogIn|ShieldCheck|Key|Zap|Database|Brain", "description": "Short description", "nodeId": "exact:symbol:id" }
    ]
  }
  \`\`\`
  
  Ensure the nodeId matches the real symbol IDs from the context.
  `;

  return await askAI(dataApiBase, projectId, {
    task: 'chat',
    query: query,
    symbol_id: symbolId,
    query_instruction: instruction
  });
};

// -- Stubs or Mapped --

export const generatePathNarrative = async (query: string, pathNodes: any[], dataApiBase: string, projectId: string) => {
  // Backend Task: "path_narrative"
  return await askAI(dataApiBase, projectId, {
    task: 'path_narrative',
    query: query,
    data: pathNodes.map(n => ({ name: n.name }))
  });
};

export const generateReactiveNarrative = async (query: string, results: any, dataApiBase: string, projectId: string) => {
  // Backend's "chat" task handles all context formatting from raw nodes
  return await askAI(dataApiBase, projectId, {
    task: 'chat',
    query: `Analyze and explain the code that answers: "${query}". List the specific functions/handlers found and explain their purpose.`,
    data: results.nodes.slice(0, 10) // Reduced from 20 to 10 for faster processing
  });
};

export const getFileRoleSummary = async (fileName: string, fileContent: string, neighbors: any, dataApiBase: string, projectId: string, activeSubMode: string = 'ARCHITECTURE') => {
  // Use "chat" task to force context injection since "insight" might rely only on backend symbol lookup.
  // We truncate fileContent to avoid blowing up context window (simple safety)
  const truncatedContent = fileContent.length > 20000 ? fileContent.substring(0, 20000) + "\n...(truncated)" : fileContent;

  let jsonInstruction = "";
  if (activeSubMode === 'NARRATIVE') {
    jsonInstruction = `Please also include a structured JSON block for the "Execution Sequence" at the VERY END.
      JSON Format: \`\`\`json { "steps": [ { "id": 1, "title": "Step Name", "icon": "File", "description": "Short description", "nodeId": "exact:symbol:id" } ] } \`\`\``;
  } else if (activeSubMode === 'ARCHITECTURE') {
    jsonInstruction = `Please also include a structured JSON block for the "Metrics" and "Patterns" at the VERY END.
      JSON Format: \`\`\`json { "architecture": { "inDegree": 12, "outDegree": 4, "cohesion": "High", "coupling": "Low", "patterns": [ { "name": "Singleton", "weight": "95%" } ] } } \`\`\``;
  } else if (activeSubMode === 'ENTROPY') {
    jsonInstruction = `Please also include a structured JSON block for "Entropy" at the VERY END.
      JSON Format: \`\`\`json { "entropy": { "riskScore": 78, "technicalDebt": "3.2d", "testCoverage": "42%", "churnRate": "High" } } \`\`\``;
  }

  const prompt = `Analyze the architectural role of the file "${fileName}".
  
  Context:
  - Callers: ${neighbors.callers.join(', ') || 'None'}
  - Dependencies: ${neighbors.dependencies.join(', ') || 'None'}
  
  Source Code:
  \`\`\`
  ${truncatedContent}
  \`\`\`
  
  Provide a technical summary of its role, key interactions, and design patterns used.
  
  ${jsonInstruction}`;

  return await askAI(dataApiBase, projectId, {
    task: 'chat',
    query: prompt,
    symbol_id: fileName
  });
};

export const getMultiFileInsight = async (
  fileIds: string[],
  query: string,
  dataApiBase: string,
  projectId: string
) => {
  return await askAI(dataApiBase, projectId, {
    task: 'multi_file_summary',
    query: query || "Analyze the relationships and collective architecture of these files.",
    data: fileIds
  });
};

export const translateNLToDatalog = async (
  query: string,
  subjectId: string | null,
  dataApiBase: string,
  projectId: string,
  predicates?: string[]
) => {
  // Use specific 'datalog' task for schema-aware generation
  return await askAI(dataApiBase, projectId, {
    task: 'datalog',
    query: query,
    symbol_id: subjectId || '',
    data: predicates || [] // Pass predicates for dynamic prompt
  });
};

export const analyzePathWithCode = async (pathGraph: any, originalQuery: string, dataApiBase: string, projectId: string) => {
  // Backend Task: "path_narrative" equivalent
  const pathStr = pathGraph.nodes.map((n: any) => n.id).join(' -> ');
  return await askAI(dataApiBase, projectId, {
    task: 'path_narrative',
    query: originalQuery,
    data: pathGraph.nodes.map((n: any) => ({ name: n.id })) // Assuming ID list for path
  });
};

// --- Agent Execution (multi-step reasoning) ---

export interface AgentStep {
  index: number;
  task: string;
  query: string;
  status: 'Pending' | 'Running' | 'Success' | 'Failed' | 'Corrected';
  result?: any[];
  hydrated?: Array<{ id: string; name: string; kind: string; code?: string }>;
  error?: string;
}

export interface AgentResponse {
  session_id: string;
  steps: AgentStep[];
  narrative: string;
}

/**
 * Execute a multi-step agent reasoning session.
 * POST /api/v1/agent/execute
 */
export const executeAgent = async (
  dataApiBase: string,
  projectId: string,
  query: string
): Promise<AgentResponse> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/agent/execute`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, query }),
  }, API_CONFIG.TIMEOUT.LONG);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Agent execution failed: ${errText}`);
  }

  return await response.json();
};

// --- Unified Ask Endpoint (NL -> Datalog -> LLM Answer) ---

export interface ConversationTurn {
    user_input: string;
    intent: string;
    datalog_query: string;
    result_count: number;
    summary: string;
    timestamp: number;
}

export interface UnifiedAskRequest {
    project_id: string;
    query: string;
    symbol_id?: string;
    depth?: number;
    context?: string;
    conversation_history?: ConversationTurn[];
}

export interface UnifiedAskResponse {
    answer: string;
    query: string;
    intent: string;
    confidence: number;
    results: any;
    summary: string;
    error?: string;
}

/**
 * Unified natural language query endpoint.
 * Converts NL to Datalog, executes, and synthesizes answer.
 * POST /api/v1/ask
 */
export const unifiedAsk = async (
  dataApiBase: string,
  projectId: string,
  query: string,
  options?: {
    symbolId?: string;
    depth?: number;
    context?: string;
    conversationHistory?: ConversationTurn[];
  }
): Promise<UnifiedAskResponse> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/ask`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: projectId,
      query: query,
      symbol_id: options?.symbolId || '',
      depth: options?.depth || 0,
      context: options?.context || '',
      conversation_history: options?.conversationHistory || []
    })
  }, API_CONFIG.TIMEOUT.LONG);

  if (!response.ok) {
    const errText = await response.text();
    logger.error('[GeminiService] Unified Ask Error:', response.status, errText);
    throw new Error(`Unified Ask Error: ${response.statusText}`);
  }

  const data: UnifiedAskResponse = await response.json();
  return data;
};

/**
 * Convenience wrapper that returns just the answer.
 */
export const askQuestion = async (
  dataApiBase: string,
  projectId: string,
  query: string,
  options?: {
    symbolId?: string;
    depth?: number;
    context?: string;
  }
): Promise<string> => {
  const result = await unifiedAsk(dataApiBase, projectId, query, options);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.answer;
};

/**
 * Intent classification result
 */
export interface IntentClassification {
  intent: string;
  confidence: number;
}

/**
 * Classify a query's intent with optional conversation history for context-aware classification.
 * Uses the /api/v1/ai/classify endpoint for lightweight intent classification.
 */
export const classifyIntent = async (
  dataApiBase: string,
  projectId: string,
  query: string,
  conversationHistory?: ConversationTurn[]
): Promise<IntentClassification> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/api/v1/ai/classify`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      query,
      conversation_history: conversationHistory || [],
    })
  }, API_CONFIG.TIMEOUT.DEFAULT);

  if (!response.ok) {
    const errText = await response.text();
    logger.error('[GeminiService] Intent classification error:', response.status, errText);
    throw new Error(`Intent classification failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    intent: data.intent || 'chat',
    confidence: data.confidence || 0.5,
  };
};

/**
 * Generate integration tests for a target symbol or file.
 */
export const generateTestsForSymbol = async (
  dataApiBase: string,
  projectId: string,
  target: string,
  query: string = 'generate integration tests'
): Promise<string> => {
  const result = await askAI(dataApiBase, projectId, {
    task: 'test_generation',
    query,
    symbol_id: target,
  });
  return result;
};

/**
 * Perform security analysis on a target symbol or file.
 */
export const analyzeSecurityForSymbol = async (
  dataApiBase: string,
  projectId: string,
  target: string,
  query: string = 'analyze security vulnerabilities'
): Promise<string> => {
  const result = await askAI(dataApiBase, projectId, {
    task: 'security_audit',
    query,
    symbol_id: target,
  });
  return result;
};

/**
 * Suggest refactoring opportunities for a target symbol or file.
 */
export const suggestRefactorForSymbol = async (
  dataApiBase: string,
  projectId: string,
  target: string,
  query: string = 'suggest refactoring improvements'
): Promise<string> => {
  const result = await askAI(dataApiBase, projectId, {
    task: 'refactor',
    query,
    symbol_id: target,
  });
  return result;
};

/**
 * Analyze performance for a target symbol or file.
 */
export const analyzePerformanceForSymbol = async (
  dataApiBase: string,
  projectId: string,
  target: string,
  query: string = 'analyze performance characteristics'
): Promise<string> => {
  const result = await askAI(dataApiBase, projectId, {
    task: 'performance',
    query,
    symbol_id: target,
  });
  return result;
};
