import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generateAIFeedback } from "./aiAgent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Resume Analyzer Backend is running 🚀");
});

/**
 * AI Feedback Endpoint
 */
app.post("/api/ai-feedback", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await generateAIFeedback(prompt);
    res.json({ result });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({ error: "AI processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
