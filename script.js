/* =====================================================
   DOM REFERENCES
===================================================== */
const fileInput = document.getElementById("fileInput");
const uploadLabel = document.getElementById("upload");
const analysisDiv = document.querySelector(".analysis");
const resultDiv = document.querySelector(".result");

const jdTextarea = document.getElementById("text");
const analyzeBtn = document.getElementById("analysis");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


let selectedResumeFile = null;

/* =====================================================
   FILE UPLOAD → PREVIEW ONLY
===================================================== */
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedResumeFile = file;

    const reader = new FileReader();
    reader.onload = () => {
        analysisDiv.innerHTML = "";
        analysisDiv.style.display = "block";

        if (file.type === "application/pdf") {
            const iframe = document.createElement("iframe");
            iframe.src = reader.result;
            iframe.style.width = "100%";
            iframe.style.height = "300px";
            iframe.style.border = "none";
            analysisDiv.appendChild(iframe);
        } else {
            analysisDiv.textContent = "Preview available only for PDF files.";
        }
    };

    reader.readAsDataURL(file);
});

/* =====================================================
   ANALYZE BUTTON → FULL PIPELINE
===================================================== */
analyzeBtn.addEventListener("click", async () => {
    if (!selectedResumeFile) {
        alert("Please upload your resume.");
        return;
    }

    const jobDescriptionText = jdTextarea.value.trim();
    if (!jobDescriptionText) {
        alert("Please write the job description.");
        return;
    }

    try {
        analyzeBtn.disabled = true;
        resultDiv.style.display = "block";
        resultDiv.innerHTML = "<p>Analyzing resume, please wait...</p>";

        // 1️⃣ Extract resume text
        const resumeText = await extractResumeText(selectedResumeFile);

        // 2️⃣ Parse resume
        const parsedResume = parseResume(resumeText);
        parsedResume.skills = categorizeSkills(parsedResume.skills);

        // 3️⃣ Extract JD skills
        const jdSkills = extractSkillsFromJD(jobDescriptionText);

        // 4️⃣ Calculate ATS score
        const atsResult = calculateATSScore(
            parsedResume.skills,
            jdSkills
        );

        // 5️⃣ Build AI prompt
        const aiPrompt = buildAIPrompt(
            parsedResume,
            atsResult,
            jdSkills
        );

        // 6️⃣ Call backend AI
        const aiFeedback = await getAIFeedbackFromBackend(aiPrompt);

        // 7️⃣ Render result
        renderResult(atsResult, aiFeedback);

    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = "<p>Something went wrong. Please try again.</p>";
    } finally {
        analyzeBtn.disabled = false;
    }
});

/* =====================================================
   RESULT RENDERING
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
   TEXT EXTRACTION (PDF / DOCX / OCR)
===================================================== */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}

async function extractResumeText(file) {
    if (file.type === "application/pdf") {
        return extractTextFromPDF(file);
    }
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return extractTextFromDOCX(file);
    }
    throw new Error("Unsupported file type");
}

/* =====================================================
   RESUME PARSING
===================================================== */
function cleanText(text) {
    return text.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();
}

function extractName(text) {
    return text.split("\n").filter(Boolean)[0] || "";
}

function extractSection(text, name) {
    const regex = new RegExp(`${name}[\\s\\S]*?(?=\\n[A-Z ]{3,}|$)`, "i");
    const match = text.match(regex);
    return match ? match[0] : "";
}

function parseResume(rawText) {
    const text = cleanText(rawText);
    return {
        name: extractName(text),
        skills: extractSection(text, "skills")
            .replace(/skills/i, "")
            .split(/,|\n/)
            .map(s => s.trim())
            .filter(Boolean),
        experience: extractSection(text, "experience")
            .replace(/experience/i, "")
            .split("\n")
            .map(e => e.trim())
            .filter(Boolean),
        education: extractSection(text, "education")
            .replace(/education/i, "")
            .split("\n")
            .map(e => e.trim())
            .filter(Boolean)
    };
}

/* =====================================================
   SKILL NORMALIZATION & ATS
===================================================== */
const SKILL_NORMALIZATION_MAP = {
    js: "JavaScript",
    javascript: "JavaScript",
    "react.js": "React",
    reactjs: "React",
    node: "Node.js",
    nodejs: "Node.js"
};

const SKILL_CATEGORIES = {
    frontend: ["HTML", "CSS", "JavaScript", "React", "Tailwind"],
    backend: ["Node.js", "Express"],
    tools: ["Git", "GitHub"]
};

function normalizeSkill(skill) {
    return SKILL_NORMALIZATION_MAP[skill.toLowerCase()] || skill;
}

function categorizeSkills(rawSkills) {
    const result = { frontend: [], backend: [], tools: [], others: [] };

    rawSkills.forEach(skill => {
        const s = normalizeSkill(skill);
        let added = false;

        for (const cat in SKILL_CATEGORIES) {
            if (SKILL_CATEGORIES[cat].includes(s)) {
                result[cat].push(s);
                added = true;
                break;
            }
        }

        if (!added) result.others.push(s);
    });

    for (const key in result) {
        result[key] = [...new Set(result[key])];
    }

    return result;
}

function extractSkillsFromJD(jdText) {
    const lower = jdText.toLowerCase();
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
        score: jdSkills.length ? Math.round((matched.length / jdSkills.length) * 100) : 0,
        matchedSkills: matched,
        missingSkills: missing
    };
}

/* =====================================================
   AI BACKEND COMMUNICATION
===================================================== */
function buildAIPrompt(parsedResume, atsResult, jdSkills) {
    return `
You are an ATS resume reviewer.

Resume Name: ${parsedResume.name}
Skills: ${JSON.stringify(parsedResume.skills)}
Experience: ${parsedResume.experience.join(" | ")}
Education: ${parsedResume.education.join(" | ")}

Job Required Skills:
${jdSkills.join(", ")}

ATS Score: ${atsResult.score}%

Matched Skills: ${atsResult.matchedSkills.join(", ")}
Missing Skills: ${atsResult.missingSkills.join(", ")}

Give concise professional feedback.
`;
}

async function getAIFeedbackFromBackend(prompt) {
    const res = await fetch("http://localhost:3000/api/ai-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    });

    if (!res.ok) throw new Error("AI request failed");

    const data = await res.json();
    return data.result;
    

}
