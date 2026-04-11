import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TextBlock, TokenUsage } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";

interface ProcessResult {
  blocks: TextBlock[];
  usage: TokenUsage;
}

interface CleanResult {
  image: string | null;
  usage: TokenUsage;
}

export const processImage = async (base64: string): Promise<ProcessResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3.1-flash-lite-preview";

  const prompt = `
    You are a professional manga translation and cleaning assistant. Analyze the provided manga page image.
    
    TASK:
    1. Detect ALL text in the image. This is EXTREMELY IMPORTANT. Do not miss anything.
       - Dialogue in speech bubbles.
       - Thought bubbles.
       - Narrative boxes.
       - Onomatopoeia (sound effects) written in the art (e.g., "Ker-chak", "Knock knock").
       - Small background text (e.g., signs, labels, credits).
    2. For each text area, provide the bounding box in normalized coordinates (0 to 1000).
       - ymin: top edge
       - xmin: left edge
       - ymax: bottom edge
       - xmax: right edge
       - Ensure boxes are slightly larger than the text to fully encompass the bubble or area.
    3. Extract the original text.
    4. Detect the dominant background color of the text area (usually white #FFFFFF or light gray).
    5. Translate the text into Vietnamese and Hindi.
    
    OUTPUT FORMAT:
    Return a JSON array of objects with these fields:
    - 'text': original text
    - 'box_2d': [ymin, xmin, ymax, xmax]
    - 'background_color': hex color (e.g., "#FFFFFF")
    - 'translation_vi': Vietnamese translation
    - 'translation_hi': Hindi translation
    
    CRITICAL: 
    - Be EXHAUSTIVE. Scan every corner of the image.
    - Accuracy of bounding boxes is paramount for clean replacement.
    - If text is part of a bubble, the box should cover the text area inside the bubble.
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/png",
      data: base64.split(",")[1],
    },
  };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }, imagePart] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            box_2d: { 
              type: Type.ARRAY, 
              items: { type: Type.NUMBER },
              minItems: 4,
              maxItems: 4
            },
            background_color: { type: Type.STRING },
            translation_vi: { type: Type.STRING },
            translation_hi: { type: Type.STRING },
          },
          required: ["text", "box_2d", "background_color", "translation_vi", "translation_hi"],
        },
      },
    },
  });

  const usage: TokenUsage = {
    promptTokens: response.usageMetadata?.promptTokenCount || 0,
    candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: response.usageMetadata?.totalTokenCount || 0,
  };

  return {
    blocks: JSON.parse(response.text || "[]"),
    usage
  };
};

export const cleanArt = async (base64: string): Promise<CleanResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash-image";

  // Refined prompt to keep the bubbles but remove the text
  const prompt = "This is a manga page. Your task is to remove ONLY the text and sound effects from the image. If the text is inside a speech bubble, remove the text but KEEP the speech bubble intact. Reconstruct any line work or background art that was hidden behind the text itself. The final image should contain the original artwork and empty speech bubbles, with no text remaining. Maintain the original art style and line quality perfectly.";

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64.split(",")[1],
          },
        },
        { text: prompt },
      ],
    },
  });

  const usage: TokenUsage = {
    promptTokens: response.usageMetadata?.promptTokenCount || 0,
    candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: response.usageMetadata?.totalTokenCount || 0,
  };

  let image: string | null = null;
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      image = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  return { image, usage };
};
