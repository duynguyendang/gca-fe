
import { GoogleGenAI } from "@google/genai";

export const getGeminiInsight = async (node: any) => {
  if (!node) return null;
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze Go component: ID: ${node.id}, Kind: ${node.kind}, LOC: ${node.end_line - node.start_line}. Provide architectural responsibility summary in <50 words. Code snippet: ${node.code?.substring(0, 100)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Insight unavailable.";
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error("Connection failed.");
  }
};
