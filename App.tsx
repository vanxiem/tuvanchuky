
import { GoogleGenAI } from "@google/genai";
import { MoldingRecord, ChatMessage, ImprovementData, DetailCycleData, CLFParameters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache to ensure identical inputs get identical outputs
const analysisCache = new Map<string, any>();

const defaultCLFParameters = {
  moldClose: { stage1: {pressure: 0, speed: 0, position: 0}, stage2: {pressure: 0, speed: 0, position: 0}, lp: {pressure: 0, speed: 0, position: 0}, hp: {pressure: 0, speed: 0, position: 0}, closeTime: 0 },
  moldOpen: { open: {pressure: 0, speed: 0, position: 0}, openFull: {pressure: 0, speed: 0, position: 0}, stage3: {pressure: 0, speed: 0, position: 0}, stage2: {pressure: 0, speed: 0, position: 0}, stage1: {pressure: 0, speed: 0, position: 0}, openTime: 0 },
  injection: { stages: [{pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}, {pressure: 0, speed: 0, position: 0}], coolingTime: 0, injectionTime: 0, holdingWaitTime: 0 },
  holding: { stage3: {pressure: 0, speed: 0, position: 0, time: 0}, stage2: {pressure: 0, speed: 0, position: 0, time: 0}, stage1: {pressure: 0, speed: 0, position: 0, time: 0} },
  charging: { stage1: {pressure: 0, speed: 0, position: 0}, stage2: {pressure: 0, speed: 0, position: 0}, stage3: {pressure: 0, speed: 0, position: 0}, backPressure: 0, chargingTime: 0 },
  suckback: { before: {pressure: 0, speed: 0, position: 0}, after: {pressure: 0, speed: 0, position: 0} },
  ejection: { back: {pressure: 0, speed: 0, position: 0}, forward: {pressure: 0, speed: 0, position: 0}, ejectionTime: 0 },
  other: { robotTime: 0, waitRobotTime: 0 },
  core: { in1: {pressure: 0, speed: 0, position: 0, time: 0}, out1: {pressure: 0, speed: 0, position: 0, time: 0}, in2: {pressure: 0, speed: 0, position: 0, time: 0}, out2: {pressure: 0, speed: 0, position: 0, time: 0}, in3: {pressure: 0, speed: 0, position: 0, time: 0}, out3: {pressure: 0, speed: 0, position: 0, time: 0} },
  temperatures: { barrel: [0, 0, 0, 0, 0, 0], hotRunner: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
};

export const analyzeMoldingData = async (
  data: MoldingRecord[], 
  notes?: string,
  imageBase64?: string,
  language: string = 'vi',
  imageNotes?: string
): Promise<{ 
  analysis: string; 
  improvementData: ImprovementData | null;
  productName?: string;
  summary?: string;
  recommendations?: string[];
  riskLevel?: string;
}> => {
  // Generate a cache key based on inputs
  const cacheKey = JSON.stringify({ 
    data, 
    notes, 
    language, 
    imageNotes,
    imageHash: imageBase64 ? `${imageBase64.length}_${imageBase64.substring(0, 500)}` : 'no-image'
  });

  if (analysisCache.has(cacheKey)) {
    console.log("Returning cached analysis result");
    return analysisCache.get(cacheKey);
  }

  const promptParts: any[] = [];
  
  let promptText = `
You are an expert plastic injection molding engineer.
Analyze the provided injection molding cycle data and parameters.
Language for response: ${language === 'vi' ? 'Vietnamese' : 'English'}

If an image is provided, extract the molding parameters (like cycle time, injection time, cooling time, pressures, speeds, temperatures, etc.) from the image.
If text data is provided, use it.
Notes from user: ${notes || 'None'}
Image notes: ${imageNotes || 'None'}

Provide a detailed analysis report in Markdown format.
Focus on identifying bottlenecks and proposing optimizations to reduce cycle time and improve quality.
Provide 3 proposed solutions (Safe, Balanced, Aggressive).
Provide material optimization suggestions.

IMPORTANT: You must return a JSON block at the very end of your response, enclosed in \`\`\`json ... \`\`\` tags.
The JSON must follow this structure exactly:
{
  "before": { "cycleTime": number, "coolingTime": number, "injectionTime": number, "holdingTime": number, "chargingTime": number, "moldCloseTime": number, "moldOpenTime": number, "ejectionTime": number },
  "after": { "cycleTime": number, "coolingTime": number, "injectionTime": number, "holdingTime": number, "chargingTime": number, "moldCloseTime": number, "moldOpenTime": number, "ejectionTime": number },
  "clfBefore": { ... full CLFParameters structure based on extracted data ... },
  "clfAfter": { ... full CLFParameters structure with your optimized values ... },
  "productName": "Extracted Product Name or N/A",
  "summary": "Short summary of the analysis",
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
  "riskLevel": "Low" | "Medium" | "High"
}

For clfBefore and clfAfter, use this structure as a template:
${JSON.stringify(defaultCLFParameters)}
Fill in the values you extract into clfBefore, and your optimized values into clfAfter. If a value is unknown, use 0.
`;

  promptParts.push({ text: promptText });

  if (data && data.length > 0) {
    promptParts.push({ text: `\n\nText Data:\n${JSON.stringify(data, null, 2)}` });
  }

  if (imageBase64) {
    const parts = imageBase64.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const base64Data = parts[1];
    promptParts.push({
      inlineData: {
        mimeType,
        data: base64Data
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: promptParts },
      config: {
        temperature: 0.1, // Low temperature for consistency
        seed: 42, // Fixed seed for determinism
      }
    });

    const text = response.text || '';
    
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    let improvementData: ImprovementData | null = null;
    let productName, summary, riskLevel;
    let recommendations: string[] = [];
    let analysis = text;

    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        improvementData = {
          before: parsed.before,
          after: parsed.after,
          clfBefore: parsed.clfBefore || defaultCLFParameters,
          clfAfter: parsed.clfAfter || defaultCLFParameters
        };
        productName = parsed.productName;
        summary = parsed.summary;
        recommendations = parsed.recommendations || [];
        riskLevel = parsed.riskLevel;
        
        analysis = text.replace(/```json\n[\s\S]*?\n```/, '').replace(/```\n[\s\S]*?\n```/, '').trim();
      } catch (e) {
        console.error("Failed to parse JSON from AI response", e);
      }
    }

    const result = {
      analysis,
      improvementData,
      productName,
      summary,
      recommendations,
      riskLevel
    };

    // Cache the result
    analysisCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

export const chatWithExpert = async (currentAnalysis: string, rawContext: string, history: ChatMessage[], question: string, language: string = 'vi') => {
  const prompt = `
You are an expert plastic injection molding engineer.
The user is asking a question about their molding process.
Language for response: ${language === 'vi' ? 'Vietnamese' : 'English'}

Context Data:
${rawContext}

Current Analysis:
${currentAnalysis}

User Question: ${question}

Provide a helpful, technical, and concise answer.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No response from AI.";
  } catch (error) {
    console.error("Error calling Gemini API for chat:", error);
    return "Xin lỗi, đã có lỗi xảy ra khi kết nối với chuyên gia AI.";
  }
};
