/* =====================================================
   DOM REFERENCES
===================================================== */
const fileInput = document.getElementById("fileInput");
const analysisDiv = document.querySelector(".analysis");
const resultDiv = document.querySelector(".result");

const jdTextarea = document.getElementById("text");
const analyzeBtn = document.getElementById("analysis");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let selectedResumeFile = null;

/* =====================================================
   FILE UPLOAD → PREVIEW (PDF ONLY)
===================================================== */
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  selectedResumeFile = file;
  analysisDiv.innerHTML = "";
  analysisDiv.style.display = "block";

  if (file.type === "application/pdf") {
    const reader = new FileReader();
    reader.onload = () => {
      const iframe = document.createElement("iframe");
      iframe.src = reader.result;
      iframe.style.width = "100%";
      iframe.style.height = "300px";
      iframe.style.border = "none";
      analysisDiv.appendChild(iframe);
    };
    reader.readAsDataURL(file);
  } else {
    analysisDiv.textContent = "Preview available only for PDF files.";
  }
});

/* =====================================================
   ANALYZE BUTTON
===================================================== */
analyzeBtn.addEventListener("click", async () => {
  if (!selectedResumeFile) {
    alert("Please upload your resume.");
    return;
  }

  const jobDescription = jdTextarea.value.trim();
  if (!jobDescription) {
    alert("Please paste the job description.");
    return;
  }

  try {
    analyzeBtn.disabled = true;
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<p>Analyzing resume…</p>";

    /* 1️⃣ Extract Resume Text */
    const resumeText = await extractResumeText(selectedResumeFile);

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text extraction failed.");
    }

    /* 2️⃣ Parse Resume */
    const parsedResume = parseResume(resumeText);
    parsedResume.skills = categorizeSkills(parsedResume.skills);

    /* 3️⃣ Extract JD Skills */
    const jdSkills = extractSkillsFromJD(jobDescription);

    /* 4️⃣ Calculate ATS */
    const atsResult = calculateATSScore(parsedResume.skills, jdSkills);

    /* 5️⃣ Call Backend AI (RAW DATA) */
    const aiFeedback = await getAIFeedbackFromBackend({
      resumeText,
      jobDescription,
      matchedSkills: atsResult.matchedSkills,
      missingSkills: atsResult.missingSkills,
      atsScore: atsResult.score
    });

    /* 6️⃣ Render Result */
    renderResult(atsResult, aiFeedback);

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `
      <p style="color:red">
        ${err.message || "Something went wrong. Please try again."}
      </p>
    `;
  } finally {
    analyzeBtn.disabled = false;
  }
});

/* =====================================================
   RESULT RENDER
===================================================== */
function renderResult(atsResult, aiFeedback) {
  resultDiv.innerHTML = `
    <h3>ATS Score: ${atsResult.score}%</h3>

    <h4>Matched Skills</h4>
    <p>${atsResult.matchedSkills.join(", ") || "None"}</p>

    <h4>Missing Skills</h4>
    <p>${atsResult.missingSkills.join(", ") || "None"}</p>

    <h4>AI Feedback</h4>
    <pre>${aiFeedback}</pre>
  `;
}

/* =====================================================
   TEXT EXTRACTION
===================================================== */
async function extractResumeText(file) {
  if (file.type === "application/pdf") return extractTextFromPDF(file);
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDOCX(file);
  }
  throw new Error("Unsupported file type.");
}

async function extractTextFromPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }

  if (text.trim().length < 50) {
    text = await extractTextFromScannedPDF(file);
  }

  return text.trim();
}

async function extractTextFromScannedPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let ocrText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const result = await Tesseract.recognize(canvas, "eng");
    ocrText += result.data.text + "\n";
  }

  return ocrText.trim();
}

async function extractTextFromDOCX(file) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

/* =====================================================
   RESUME PARSING
===================================================== */
function parseResume(text) {
  const clean = text.replace(/\r/g, "").trim();

  return {
    name: clean.split("\n")[0] || "",
    skills: extractSection(clean, "skills"),
    experience: extractSection(clean, "experience"),
    education: extractSection(clean, "education")
  };
}

function extractSection(text, section) {
  const regex = new RegExp(`${section}[\\s\\S]*?(?=\\n[A-Z ]{3,}|$)`, "i");
  const match = text.match(regex);
  if (!match) return [];

  return match[0]
    .replace(new RegExp(section, "i"), "")
    .split(/,|\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

/* =====================================================
   SKILLS & ATS
===================================================== */
const SKILL_MAP = {
  js: "JavaScript",
  javascript: "JavaScript",
  reactjs: "React",
  "react.js": "React",
  node: "Node.js",
  nodejs: "Node.js"
};

const SKILL_CATEGORIES = {
  frontend: ["HTML", "CSS", "JavaScript", "React", "Tailwind"],
  backend: ["Node.js", "Express"],
  tools: ["Git", "GitHub"]
};

function normalizeSkill(skill) {
  return SKILL_MAP[skill.toLowerCase()] || skill;
}

function categorizeSkills(skills) {
  const result = { frontend: [], backend: [], tools: [], others: [] };

  skills.forEach(skill => {
    const s = normalizeSkill(skill);
    let found = false;

    for (const cat in SKILL_CATEGORIES) {
      if (SKILL_CATEGORIES[cat].includes(s)) {
        result[cat].push(s);
        found = true;
        break;
      }
    }

    if (!found) result.others.push(s);
  });

  Object.keys(result).forEach(k => {
    result[k] = [...new Set(result[k])];
  });

  return result;
}

function extractSkillsFromJD(jd) {
  const lower = jd.toLowerCase();
  const found = [];

  for (const cat in SKILL_CATEGORIES) {
    SKILL_CATEGORIES[cat].forEach(skill => {
      if (lower.includes(skill.toLowerCase())) {
        found.push(skill);
      }
    });
  }

  return [...new Set(found)];
}

function calculateATSScore(resumeSkills, jdSkills) {
  const resumeSet = new Set(Object.values(resumeSkills).flat());
  const matched = jdSkills.filter(s => resumeSet.has(s));
  const missing = jdSkills.filter(s => !resumeSet.has(s));

  return {
    score: jdSkills.length
      ? Math.round((matched.length / jdSkills.length) * 100)
      : 0,
    matchedSkills: matched,
    missingSkills: missing
  };
}

/* =====================================================
   BACKEND COMMUNICATION
===================================================== */
async function getAIFeedbackFromBackend(payload) {
  const res = await fetch("http://localhost:3000/api/ai-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "AI request failed");
  }

  const data = await res.json();
  return data.aiFeedback;
}
