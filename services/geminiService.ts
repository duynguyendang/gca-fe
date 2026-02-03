
/**
 * Gemini Service (Refactored)
 * 
 * Replaces direct Google GenAI client with calls to the Go Backend Proxy.
 * Endpoint: POST /v1/ai/ask
 */

export interface AIResponse {
  answer: string;
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
  }
): Promise<string> => {
  const cleanBase = dataApiBase.endsWith('/') ? dataApiBase.slice(0, -1) : dataApiBase;
  const url = `${cleanBase}/v1/ai/ask`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: projectId,
      task: payload.task || 'chat',
      query: payload.query || '',
      symbol_id: payload.symbol_id || '',
      data: payload.data || null
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GeminiService] Backend Error:', response.status, errText);
    throw new Error(`AI Service Error: ${response.statusText}`);
  }

  const data: AIResponse = await response.json();
  return data.answer || "No response from AI.";
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
) => {
  if (!node) return null;
  // Backend Task: "insight"
  return await askAI(dataApiBase, projectId, {
    task: 'insight',
    symbol_id: node.id
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
    // Attempt to clean markdown if backend returns it
    const jsonStr = answer.replace(/`/g, '').replace(/json/g, '').trim();
    // Use regex to find first { and last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("Failed to parse prune JSON:", e);
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
    const jsonStr = answer.replace(/`/g, '').replace(/json/g, '').trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
    }
    return JSON.parse(jsonStr);
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
  // Backend Task: "chat" (default), with symbol_id focus
  return await askAI(dataApiBase, projectId, {
    task: 'chat',
    query: query,
    symbol_id: symbolId
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

export const getFileRoleSummary = async (fileName: string, fileContent: string, neighbors: any, dataApiBase: string, projectId: string) => {
  // Backend Task: "insight" (reusing insight for general analysis, or creating new "file_insight")
  // Let's use "insight" but pass fileName as symbolID (assuming file ID works)
  return await askAI(dataApiBase, projectId, {
    task: 'insight',
    symbol_id: fileName
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
