
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = 'gemini-3-flash-preview';

export const getGeminiInsight = async (node: any, customEndpoint?: string, apiKey?: string) => {
  if (!node) return null;

  // Initialize with named parameter using provided key or process.env.API_KEY
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  const prompt = `Analyze the following code component.
  ID: ${node.id}
  Kind: ${node.kind}
  Code Snippet:
  ${node.code?.substring(0, 300)} (truncated)

  Task: Provide a concise architectural summary.
  Output Format: Markdown.
  - Use **bold** for key responsibilities.
  - Link related files using [\`path/to/file.ext\`] format.
  - Highlight symbols as \`SymbolName\`.
  `;

  console.log('[GeminiService] getGeminiInsight prompt:', prompt);
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    console.log('[GeminiService] getGeminiInsight response:', response.text);
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
    console.log('[GeminiService] pruneNodesWithAI prompt:', prompt);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    console.log('[GeminiService] pruneNodesWithAI response:', text);
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

  console.log('[GeminiService] getArchitectureSummary prompt:', prompt);
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    console.log('[GeminiService] getArchitectureSummary response:', response.text);
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
 * IMPORTANT: Returns ONLY an ID from the candidate list, validated
 */
export const resolveSymbolFromQuery = async (query: string, candidateSymbols: string[], apiKey?: string): Promise<string | null> => {
  if (!candidateSymbols || candidateSymbols.length === 0) return null;

  // If only one candidate, return it immediately
  if (candidateSymbols.length === 1) return candidateSymbols[0];

  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  // Number the candidates for easier selection
  const numberedCandidates = candidateSymbols.slice(0, 30).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Select the best matching symbol for this query.

Query: "${query}"

Candidates:
${numberedCandidates}

Rules:
- Return ONLY the number (1-${Math.min(30, candidateSymbols.length)}) of the best match
- Prefer definitions (structs, funcs) over usages
- If no good match, return 0

Your answer (just the number):`;

  console.log('[GeminiService] resolveSymbolFromQuery prompt:', prompt);
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    const text = response.text?.trim() || "";
    console.log('[GeminiService] resolveSymbolFromQuery response:', text);

    // Parse the number response
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);

    if (isNaN(num) || num < 1 || num > candidateSymbols.length) {
      console.log('AI returned invalid selection:', text, '- falling back to first candidate');
      return candidateSymbols[0];
    }

    const selected = candidateSymbols[num - 1];
    console.log('AI selected symbol:', selected);
    return selected;
  } catch (err) {
    console.error("Gemini Resolution Error:", err);
    return candidateSymbols[0]; // Fallback to first candidate
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
 * Generate Reactive Narrative with Architectural Insights
 * 
 * Analyzes Datalog query results to provide deep architectural understanding
 * instead of simple summaries.
 */
export const generateReactiveNarrative = async (
  query: string,
  results: { nodes: any[]; links: any[] },
  apiKey?: string
): Promise<string> => {
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  // Format triples as (Subject --Predicate--> Object) for better context
  const formattedTriples = results.links.map(link => {
    const source = link.source || link.source_id || 'unknown';
    const target = link.target || link.target_id || 'unknown';
    const relation = link.relation || 'unknown';
    return `(${source} --${relation}--> ${target})`;
  }).join('\n  ');

  // Calculate node statistics for pattern detection
  const nodeStats = new Map<string, { inDegree: number; outDegree: number; kind: string }>();
  results.nodes.forEach(node => {
    nodeStats.set(node.id, { inDegree: 0, outDegree: 0, kind: node.kind || 'unknown' });
  });
  results.links.forEach(link => {
    const source = link.source || link.source_id;
    const target = link.target || link.target_id;
    if (source && nodeStats.has(source)) {
      nodeStats.get(source)!.outDegree++;
    }
    if (target && nodeStats.has(target)) {
      nodeStats.get(target)!.inDegree++;
    }
  });

  // Format node statistics for architectural pattern detection
  const nodeStatsText = Array.from(nodeStats.entries())
    .map(([id, stats]) => `  ${id}: kind=${stats.kind}, in=${stats.inDegree}, out=${stats.outDegree}`)
    .join('\n');

  const systemPrompt = `# Role: GCA Software Architect
You are an expert software architect analyzing a codebase visualization.

## Output Format (STRICT MARKDOWN)
You MUST output your response in valid Markdown.
- Use \`#\` for major titles (e.g. # Architecture Insight)
- Use \`##\` for sections.
- **Links**: When referring to a file, you MUST use the link format: \`[path/to/file.ext](path/to/file.ext)\`. Example: \`[pkg/auth/auth.go](pkg/auth/auth.go)\`.
- **Symbols**: When referring to a function, struct, or variable, you MUST use inline code: \`SymbolName\`. Example: \`ValidateToken\`.
- **Formatting**: Use bullet points, bold text, and tables where appropriate.

## Analysis Goals
1. **Flow & Role**: Identify 'Drivers' (callers) and 'Sinks' (callees).
2. **Patterns**: Detect architectural patterns (Factory, singleton, etc.).
3. **Anomalies**: Point out weird connections or missing validation.
4. **Summary**: What is the "Story" of this subgraph?

Keep it under 10 sentences. Focus on interaction and data flow.
`;

  const userPrompt = `User Query: "${query}"

Query Results:
  ${results.nodes.length} nodes, ${results.links.length} links

Triples:
  ${formattedTriples || '(no relationships found)'}

Node Statistics:
${nodeStatsText || '(no nodes)'}

Task: Provide a concise architectural insight about these results. What pattern or flow does this reveal?`;

  try {
    // Combine system and user prompts since systemInstruction isn't supported
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
    console.log('[GeminiService] generateReactiveNarrative prompt:', fullPrompt);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: fullPrompt,
    });
    console.log('[GeminiService] generateReactiveNarrative response:', response.text);
    return response.text || "No insights generated.";
  } catch (err) {
    console.error("Gemini Reactive Narrative Error:", err);
    return "Failed to generate architectural narrative.";
  }
};

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

  console.log('[GeminiService] getFileRoleSummary prompt:', prompt);
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    console.log('[GeminiService] getFileRoleSummary response:', response.text);
    return response.text || "Role summary unavailable.";
  } catch (err) {
    console.error("Gemini Role Summary Error:", err);
    return "Failed to generate file summary.";
  }
}
/**
 * Convert Natural Language Query to Datalog
 * Uses GCA Datalog Architect role with dynamic schema injection
 */
export const translateNLToDatalog = async (
  query: string,
  subjectId?: string | null,
  apiKey?: string,
  predicates?: string[],
  manifest?: { F: Record<string, string>, S: Record<string, number> } | null
): Promise<string | null> => {
  const ai = new GoogleGenAI({
    apiKey: apiKey || process.env.API_KEY,
  });

  // Use dynamic predicates if provided, otherwise fall back to defaults
  const predicateList = predicates && predicates.length > 0
    ? predicates
    : ['calls', 'defines', 'reads', 'writes', 'imports'];

  const predicateSchema = predicateList.map(p => `- \`${p}\``).join('\n');

  // 1. Manifest Pruning (Optimization)
  let manifestToUse = manifest;
  if (manifest && manifest.S && Object.keys(manifest.S).length > 50) {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    // If query is very short/empty, don't prune or maybe don't send anything?
    if (tokens.length > 0) {
      const prunedS: Record<string, number> = {};
      const relevantFileIds = new Set<string>();

      // Match Symbols
      Object.entries(manifest.S).forEach(([symbol, fileId]) => {
        if (tokens.some(t => symbol.toLowerCase().includes(t))) {
          prunedS[symbol] = fileId;
          relevantFileIds.add(fileId.toString());
        }
      });

      // Match Files
      if (manifest.F) {
        Object.entries(manifest.F).forEach(([fid, path]) => {
          if (tokens.some(t => path.toLowerCase().includes(t))) {
            relevantFileIds.add(fid);
          }
        });
      }

      // Reconstruct Pruned Manifest
      const prunedF: Record<string, string> = {};
      if (manifest.F) {
        relevantFileIds.forEach(fid => {
          if (manifest.F[fid]) prunedF[fid] = manifest.F[fid];
        });
      }

      // Only prune if we found relevant things. If 0 matches, AI might need full context or standard tools.
      // But sending 1000s of unrelated symbols is noise.
      // Let's fallback to a "Light" mode if 0 matches?
      // For now, if > 0 matches, strict prune.
      if (Object.keys(prunedS).length > 0 || Object.keys(prunedF).length > 0) {
        manifestToUse = { S: prunedS, F: prunedF };
        console.log(`[GeminiService] Pruned manifest: ${Object.keys(prunedS).length} symbols, ${Object.keys(prunedF).length} files.`);
      }
    }
  }


  const rolePrompt = `# Role: GCA Datalog Architect
You are a specialist in source code architecture. Your sole task is to translate user questions into Datalog queries.

## Schema (Available Predicates)
You MUST only use these predicates:
${predicateSchema}

## Datalog Syntax
- Variables: \`?var\` (e.g., \`?file\`, \`?func\`)
- String IDs: \`"path/to/file.go"\`
- Query format: \`triples(?s, "predicate", ?o)\`
- Joins: \`triples(?a, "calls", ?b), triples(?b, "calls", ?c)\`

## Query Patterns
- **Who calls X?**: \`triples(?caller, "calls", "X_ID")\`
- **What does X call?**: \`triples("X_ID", "calls", ?callee)\`
- **What defines X?**: \`triples(?file, "defines", "X_ID")\`
- **What imports X?**: \`triples(?file, "imports", "X_ID")\`

## Rules
- Use Subject ID EXACTLY when provided
- Output ONLY the query string
- No markdown, no explanation

${manifestToUse ? `
## Project Manifest (Compressed & Pruned)
Use this map to resolve symbol names to file IDs without asking.
Format: S:{"Symbol":FileID}, F:{"FileID":"Path"}

Manifest:
${JSON.stringify(manifestToUse).substring(0, 30000)} (truncated if too large)

## Rules for Manifest
- If user mentions "Auth", look up "Auth" in S. If S["Auth"] is 1, and F["1"] is "pkg/auth/auth.go", use "pkg/auth/auth.go".
- **NEVER** use the \`search_symbols\` tool if a symbol name is found in the manifest. Directly generate the Datalog query using these IDs.
` : ''}
`;

  const userQuery = `Query: "${query}"
${subjectId ? `Subject ID: "${subjectId}"` : ""}

Output the Datalog query:`;

  try {
    const fullPrompt = `${rolePrompt}\n\n---\n\n${userQuery}`;
    console.log('[GeminiService] translateNLToDatalog prompt:', fullPrompt);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: fullPrompt,
    });

    console.log('[GeminiService] translateNLToDatalog response:', response.text);
    let datalogQuery = response.text?.trim() || null;

    // Clean up - remove markdown code blocks
    if (datalogQuery) {
      datalogQuery = datalogQuery.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    }

    console.log('Generated Datalog:', datalogQuery);
    return datalogQuery;
  } catch (err) {
    console.error("Gemini Translation Error:", err);
    return null;
  }
};
