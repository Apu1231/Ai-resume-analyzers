import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generateAIFeedback, buildAtsPrompt } from "./aiAgent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: ["http://localhost:5500", "http://127.0.0.1:5500"]
  })
);

app.use(express.json({ limit: "2mb" }));

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.status(200).send("AI Resume Analyzer Backend is running 🚀");
});

/* =========================
   AI FEEDBACK API
========================= */
app.post("/api/ai-feedback", async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      matchedSkills,
      missingSkills,
      atsScore
    } = req.body;

    /* ---------- VALIDATION ---------- */
    if (
      typeof resumeText !== "string" ||
      resumeText.trim().length < 50 ||
      typeof jobDescription !== "string" ||
      jobDescription.trim().length < 20
    ) {
      return res.status(400).json({
        error: "Invalid resume text or job description"
      });
    }

    /* ---------- BUILD PROMPT ---------- */
    const prompt = buildAtsPrompt({
      resumeText,
      jobDescription,
      matchedSkills: Array.isArray(matchedSkills) ? matchedSkills : [],
      missingSkills: Array.isArray(missingSkills) ? missingSkills : [],
      atsScore: Number.isFinite(atsScore) ? atsScore : 0
    });

    // Extra safety (prevents your current error forever)
    if (!prompt || prompt.trim().length === 0) {
      return res.status(500).json({
        error: "Failed to build AI prompt"
      });
    }

    /* ---------- CALL GEMINI ---------- */
    const aiFeedback = await generateAIFeedback(prompt);

    /* ---------- RESPONSE ---------- */
    return res.status(200).json({ aiFeedback });

  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({
      error: error.message || "AI processing failed"
    });
  }
});

/* =========================
   SERVER START
========================= */
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
