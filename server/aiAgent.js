import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/**
 * Generate AI resume feedback
 */
export async function generateAIFeedback(prompt) {
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt
  });

  return response.text;
}
