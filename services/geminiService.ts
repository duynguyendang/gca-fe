
import { GoogleGenAI } from "@google/genai";

export const getGeminiInsight = async (node: any, customEndpoint?: string) => {
  if (!node) return null;

  // Initialize with named parameter using process.env.API_KEY
  const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY,
  });

  const prompt = `Analyze Go component: ID: ${node.id}, Kind: ${node.kind}, LOC: ${node.end_line - node.start_line}. Provide architectural responsibility summary in <50 words. Code snippet: ${node.code?.substring(0, 100)}`;

  try {
    // Correct way to call generateContent: use ai.models.generateContent
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    // Correct way to access text: use response.text property (not a method)
    return response.text || "Insight unavailable.";
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error("Connection failed.");
  }
};

export const pruneNodesWithAI = async (nodes: any[]) => {
  if (!nodes || nodes.length === 0) return { selectedIds: [], explanation: "No nodes to analyze." };

  const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY,
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
      model: 'gemini-2.0-flash-exp',
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
export const getArchitectureSummary = async (fileName: string, nodes: any[]): Promise<string> => {
  if (!nodes || nodes.length === 0) return "No symbols to analyze.";

  const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY,
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
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    return response.text || "Summary unavailable.";
  } catch (err) {
    console.error("Gemini Summary Error:", err);
    return "Failed to generate summary.";
  }
};

/**
 * Identify critical path nodes for Focus Mode
 */
export const getCriticalPathNodes = async (nodes: any[], links: any[]): Promise<{ nodeIds: string[], explanation: string }> => {
  if (!nodes || nodes.length === 0) return { nodeIds: [], explanation: "No nodes to analyze." };

  const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY,
  });

  const nodeList = nodes.slice(0, 20).map(n => `- ${n.name} (${n.kind}, ID: ${n.id})`).join('\n');
  const linkSummary = `${links.length} connections between symbols`;

  const prompt = `You are a Senior Software Architect.

Visible symbols:
${nodeList}

Graph has ${linkSummary}.

Task: Identify the CRITICAL PATH nodes - the most important nodes that form the main execution/data flow. These are typically:
- Entry points (main, handlers, constructors)
- Core business logic functions
- Key data structures that flow through the system

Return JSON:
{
    "nodeIds": ["id1", "id2", "id3"],
    "explanation": "Brief reason for this critical path..."
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");

    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Critical Path Error:", err);
    // Fallback: return first 5 nodes
    return {
      nodeIds: nodes.slice(0, 5).map(n => n.id),
      explanation: "AI unavailable. Showing first 5 nodes as critical path."
    };
  }
};