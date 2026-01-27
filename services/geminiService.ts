
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = 'gemini-3-flash-preview';

export const getGeminiInsight = async (node: any, customEndpoint?: string, apiKey?: string) => {
  if (!node) return null;

  // Initialize with named parameter using provided key or process.env.API_KEY
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const prompt = `Analyze Go component: ID: ${node.id}, Kind: ${node.kind}, LOC: ${node.end_line - node.start_line}. Provide architectural responsibility summary in <50 words. Code snippet: ${node.code?.substring(0, 100)}`;

  try {
    // Correct way to call generateContent: use ai.models.generateContent
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    // Correct way to access text: use response.text property (not a method)
    return response.text || "Insight unavailable.";
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error("Connection failed.");
  }
};

export const pruneNodesWithAI = async (nodes: any[], apiKey?: string) => {
  if (!nodes || nodes.length === 0) return { selectedIds: [], explanation: "No nodes to analyze." };

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const nodeList = nodes.map(n => `- ${n.name} (Kind: ${n.kind}, ID: ${n.id})`).join('\n');

  const prompt = `You are a Senior Software Architect. 
    Review the following symbols from a source file:
    ${nodeList}

    Task: Identify the TOP 7 most significant "architectural gateway" nodes (entry points, key structs, main logic).
    
    Return strictly JSON format:
    {
        "selectedIds": ["id1", "id2"],
        "explanation": "Brief reason why these were chosen..."
    }
    `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Pruning Error:", err);
    return {
      selectedIds: nodes.slice(0, 7).map(n => n.id),
      explanation: "AI Unavailable. Showing top 7 items."
    };
  }
}

/**
 * Get an architecture summary for a file's symbols
 */
export const getArchitectureSummary = async (fileName: string, nodes: any[], apiKey?: string): Promise<string> => {
  if (!nodes || nodes.length === 0) return "No symbols to analyze.";

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const nodeList = nodes.slice(0, 15).map(n => `- ${n.name} (${n.kind})`).join('\n');

  const prompt = `You are a Senior Software Architect analyzing file: "${fileName}"

Symbols in this file:
${nodeList}

Provide a 2-3 sentence architectural summary explaining:
1. What is this file's primary responsibility?
2. What are the key entry points or data structures?

Be concise and technical.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text || "Summary unavailable.";
  } catch (err) {
    console.error("Gemini Summary Error:", err);
    return "Failed to generate summary.";
  }
};

/**
 * Generate narrative for Architecture Flow
 */
export const getArchitectureNarrative = async (nodes: any[], links: any[], apiKey?: string): Promise<string> => {
  if (!nodes || nodes.length === 0) return "No architecture visible.";

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const nodeNames = nodes.map(n => n.name).join(', ');
  const pathExample = links.slice(0, 3).map(l => {
    const s = typeof l.source === 'object' ? l.source.name || l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.name || l.target.id : l.target;
    return `${s} -> ${t}`;
  }).join(', ');

  const prompt = `I am looking at a file-level call graph:
Files: ${nodeNames}
Sample Connections: ${pathExample}

Based on these relationships, explain the high-level logic flow. 
What is the role of the intermediate files?
Keep it concise (2-3 sentences).`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text || "Narrative unavailable.";
  } catch (err) {
    console.error("Gemini Narrative Error:", err);
    return "Failed to generate narrative.";
  }
};

/**
 * Tool: Resolve user query to a specific Symbol ID
 */
export const resolveSymbolFromQuery = async (query: string, candidateSymbols: string[], apiKey?: string): Promise<string | null> => {
  if (!candidateSymbols || candidateSymbols.length === 0) return null;

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const prompt = `You are an intelligent code search assistant.
  
  User Query: "${query}"
  
  Candidate Symbols:
  ${candidateSymbols.slice(0, 50).join('\n')}
  
  Task: Select the ONE symbol ID that best matches the user's intent.
  If the user asks about "Auth", prefer "auth.go:Login" or "auth_service.go".
  If multiple matches, pick the definition (struct/func) over usage.
  
  Return strictly the ID string. If no good match, return "null".`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    const text = response.text?.trim();
    return text === "null" ? null : text || null;
  } catch (err) {
    console.error("Gemini Resolution Error:", err);
    return null;
  }
};

/**
 * Tool: Find logical start and end points for a pathfinding query.
 * e.g. "How does API call Database?" -> { from: "api", to: "database" }
 */
export const findPathEndpoints = async (query: string, candidateSymbols: string[], apiKey?: string): Promise<{ from: string, to: string } | null> => {
  if (!candidateSymbols || candidateSymbols.length === 0) return null;

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const prompt = `You are an intelligent code search assistant.

  User Query: "${query}"

  Candidate Symbols (Top 50):
  ${candidateSymbols.slice(0, 50).join('\n')}

  Task: Identify the "Source" and "Target" symbols implied by the user's question.
  - If the user asks "How does X call Y?", Source=X, Target=Y.
  - If the user asks "Path from X to Y", Source=X, Target=Y.
  - If the user just mentions one thing, return null.

  Return strictly JSON:
  {
    "from": "symbol_id_for_X",
    "to": "symbol_id_for_Y"
  }
  If no clear path is requested, return null.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text || text === "null") return null;
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Path Resolution Error:", err);
    return null;
  }
}
/**
 * Explain a flow path.
 */
export const generatePathNarrative = async (query: string, pathNodes: any[], apiKey?: string): Promise<string> => {
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const pathStr = pathNodes.map(n => `-> ${n.name} (${n.kind})`).join('\n');

  const prompt = `You are an expert code explainer.
  
  User asked: "${query}"
  We found this call chain:
  ${pathStr}
  
  Task: Explain the flow concisely.
  - Start with "The flow begins at..."
  - Mention key data transformations or decisions.
  - End with "finally reaching..."
  Keep it to 3-4 sentences.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text || "No narrative generated.";
  } catch (err) {
    console.error("Gemini Narrative Error:", err);
    return "Failed to explain path.";
  }
}

/**
 * Generate an answer connecting the user's query to the resolved symbol.
 */
export const generateAnswerForSymbol = async (query: string, symbolId: string, symbolDetails: any, apiKey?: string): Promise<string> => {
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const prompt = `You are an expert code explainer.
  
  User asked: "${query}"
  We resolved this to symbol: ${symbolId} (${symbolDetails.kind})
  
  Symbol Code Snippet:
  ${symbolDetails.code ? symbolDetails.code.substring(0, 300) : "No code available."}
  
  Task: Explain HOW this symbol answers the user's question.
  Keep it concise (3-4 sentences). Use markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text || "No explanation generated.";
  } catch (err) {
    console.error("Gemini Answer Error:", err);
    return "Failed to generate answer.";
  }
}

/**
 * Get a role summary for a selected file.
 */
export const getFileRoleSummary = async (fileName: string, neighbors: any[], apiKey?: string): Promise<string> => {
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const neighborList = neighbors.map(n => n.name).slice(0, 10).join(', ');

  const prompt = `The user selected "${fileName}".
  
  It interacts with: ${neighborList}.
  
  Task: Give a 1-sentence summary of its role and list the 2 most important files it interacts with.
  Start with "${fileName} serves as..."
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text || "Role summary unavailable.";
  } catch (err) {
      console.error("Gemini Role Summary Error:", err);
      return "Failed to generate file summary.";
  }
}
