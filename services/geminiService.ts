
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
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Correct way to access text: use response.text property (not a method)
    return response.text || "Insight unavailable.";
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error("Connection failed.");
  }
};