import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateAIFeedback, buildAtsPrompt } from "./aiAgent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   PATH SETUP
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ]
  })
);

app.use(express.json({ limit: "2mb" }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* =========================
   AI FEEDBACK API
========================= */
app.post("/api/ai-feedback", async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      matchedSkills = [],
      missingSkills = [],
      atsScore = 0
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
      matchedSkills,
      missingSkills,
      atsScore
    });

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
   FRONTEND FALLBACK (NODE 22 SAFE)
========================= */
app.use((req, res, next) => {
  // Let API routes pass through
  if (req.path.startsWith("/api")) return next();

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   SERVER START
========================= */
app.listen(PORT, () => {
  console.log(`✅ App running on http://localhost:${PORT}`);
});
