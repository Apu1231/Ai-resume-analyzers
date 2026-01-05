import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/* ============================
   ATS PROMPT BUILDER
============================ */
export function buildAtsPrompt({
  resumeText,
  jobDescription,
  matchedSkills,
  missingSkills,
  atsScore
}) {
  return `
You are an ATS resume analyzer and hiring assistant.

You will be given:
1. Extracted resume text
2. A job description
3. A list of matched skills
4. A list of missing skills
5. An ATS score (percentage)

Your task is to generate concise, structured, and actionable feedback.

RULES:
- Do NOT repeat the matched or missing skills list verbatim.
- Use simple professional language.
- Avoid unnecessary explanations.
- Do not mention AI, LLM, or model details.

OUTPUT FORMAT (STRICT):

Summary:
(1–2 lines describing overall resume fit)

Strengths:
• 2–3 bullet points highlighting strong areas based on matched skills

Skill Gaps:
• Explain missing or weak areas without listing all skills again

Improvement Suggestions:
• 3 concrete actions the candidate can take to improve ATS score

Expected Outcome:
• Predict the improved ATS score range

DATA:
Resume:
${resumeText}

Job Description:
${jobDescription}

Matched Skills:
${matchedSkills.join(", ")}

Missing Skills:
${missingSkills.join(", ")}

ATS Score:
${atsScore}%
`;
}

/* ============================
   GEMINI CALL
============================ */
export async function generateAIFeedback(prompt) {
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  const text =
    response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini");
  }

  return text;
}
