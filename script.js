const fileInput = document.getElementById("fileInput");
const analysisDiv = document.querySelector(".analysis");
const uploadLabel = document.getElementById("upload");

/* =========================
   FILE INPUT CHANGE
========================= */

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];

    if (!file) {
        console.log("No file selected");
        return;
    }

    console.log("File selected:", file.name, file.type);

    /* =========================
       1️⃣ FILE PREVIEW (UI)
    ========================= */

    const reader = new FileReader();

    reader.onload = () => {
        analysisDiv.innerHTML = "";
        analysisDiv.style.display = "block";

        // IMAGE PREVIEW
        if (file.type.startsWith("image/")) {
            const img = document.createElement("img");
            img.src = reader.result;
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            analysisDiv.appendChild(img);
        }

        // PDF PREVIEW
        else if (file.type === "application/pdf") {
            const iframe = document.createElement("iframe");
            iframe.src = reader.result;
            iframe.style.width = "100%";
            iframe.style.height = "300px";
            iframe.style.border = "none";
            analysisDiv.appendChild(iframe);
        }

        else {
            analysisDiv.textContent = "Preview not available for this file type.";
        }
    };

    reader.readAsDataURL(file);

    /* =========================
       2️⃣ TEXT EXTRACTION
    ========================= */

    try {
    console.log("Extracting resume text...");

    const resumeText = await extractResumeText(file);

    console.log("✅ Text extraction successful");
    console.log(resumeText.slice(0, 500));

    // STEP 1: Parse resume
    const parsedResume = parseResume(resumeText);

    // STEP 2: Categorize skills
    parsedResume.skills = categorizeSkills(parsedResume.skills);

    // STEP 3: Extract JD skills
    const jdSkills = extractSkillsFromJD(jobDescriptionText);

    // STEP 4: Calculate ATS score
    const atsResult = calculateATSScore(
        parsedResume.skills,
        jdSkills
    );

    console.log("📊 ATS RESULT:", atsResult);

    // STEP 5: Build AI prompt
    const aiPrompt = buildAIPrompt(
        parsedResume,
        atsResult,
        jdSkills
    );

    // STEP 6: Call backend AI
    const aiFeedback = await getAIFeedbackFromBackend(aiPrompt);

    console.log("🤖 AI FEEDBACK:", aiFeedback);

} catch (error) {
    console.error("❌ Extraction failed:", error.message);
}

});

/* =========================
   DRAG & DROP
========================= */

uploadLabel.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadLabel.classList.add("dragover");
});

uploadLabel.addEventListener("dragleave", () => {
    uploadLabel.classList.remove("dragover");
});

uploadLabel.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadLabel.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change"));
    }
});

/* =========================
   PDF TEXT EXTRACTION
========================= */

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ");
        text += pageText + "\n";
    }

    // 🔴 OCR fallback for scanned PDFs
    if (text.trim().length < 50) {
        console.warn("⚠️ Scanned PDF detected. Running OCR...");
        text = await extractTextFromScannedPDF(file);
    }

    return text.trim();
}

/* =========================
   OCR FOR SCANNED PDF
========================= */

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

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        const result = await Tesseract.recognize(
            canvas,
            "eng",
            {
                logger: m => console.log("OCR:", m.status, m.progress)
            }
        );

        ocrText += result.data.text + "\n";
    }

    return ocrText.trim();
}

/* =========================
   DOCX TEXT EXTRACTION
========================= */

async function extractTextFromDOCX(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}

/* =========================
   FILE TYPE ROUTER
========================= */

async function extractResumeText(file) {
    if (!file) throw new Error("No file provided");

    if (file.type === "application/pdf") {
        return await extractTextFromPDF(file);
    }

    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return await extractTextFromDOCX(file);
    }

    throw new Error("Unsupported file type");
}

// ---------- Clean Resume Text ----------
function cleanText(text) {
    return text
        .replace(/\r/g, "")
        .replace(/\n{2,}/g, "\n")
        .replace(/\t/g, " ")
        .trim();
}

// ---------- Extract Email ----------
function extractEmail(text) {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    return match ? match[0] : null;
}

// ---------- Extract Phone ----------
function extractPhone(text) {
    const match = text.match(/(\+?\d{1,3}[\s-]?)?\d{10}/);
    return match ? match[0] : null;
}

// ---------- Extract Name ----------
function extractName(text) {
    const lines = text.split("\n").filter(Boolean);
    return lines.length > 0 ? lines[0] : null;
}

// ---------- Extract Section ----------
function extractSection(text, sectionName) {
    const regex = new RegExp(
        `${sectionName}[\\s\\S]*?(?=\\n[A-Z ]{3,}|$)`,
        "i"
    );
    const match = text.match(regex);
    return match ? match[0] : "";
}

// ---------- Extract Skills ----------
function extractSkills(text) {
    const skillsSection = extractSection(text, "skills");
    if (!skillsSection) return [];

    return skillsSection
        .replace(/skills/i, "")
        .split(/,|\n/)
        .map(skill => skill.trim())
        .filter(Boolean);
}

// ---------- Extract Experience ----------
function extractExperience(text) {
    const expSection = extractSection(text, "experience");
    if (!expSection) return [];

    return expSection
        .replace(/experience/i, "")
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}

// ---------- Extract Education ----------
function extractEducation(text) {
    const eduSection = extractSection(text, "education");
    if (!eduSection) return [];

    return eduSection
        .replace(/education/i, "")
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}

// ---------- Main Resume Parser ----------
function parseResume(rawText) {
    const text = cleanText(rawText);

    return {
        name: extractName(text),
        email: extractEmail(text),
        phone: extractPhone(text),
        skills: extractSkills(text),
        experience: extractExperience(text),
        education: extractEducation(text),
    };
}


// ---------- Skill Normalization ----------
const SKILL_NORMALIZATION_MAP = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "react.js": "React",
    "reactjs": "React",
    "node": "Node.js",
    "nodejs": "Node.js",
    "expressjs": "Express",
    "git version control": "Git"
};

// ---------- Skill Categories ----------
const SKILL_CATEGORIES = {
    frontend: ["HTML", "CSS", "JavaScript", "React", "Tailwind", "Bootstrap"],
    backend: ["Node.js", "Express", "Django", "Flask"],
    database: ["MongoDB", "MySQL", "PostgreSQL", "Firebase"],
    tools: ["Git", "GitHub", "Docker", "Postman", "Figma"]
};

// ---------- Normalize Single Skill ----------
function normalizeSkill(skill) {
    const key = skill.toLowerCase();
    return SKILL_NORMALIZATION_MAP[key] || skill;
}

// ---------- Categorize Skills ----------
function categorizeSkills(rawSkills) {
    const result = {
        frontend: [],
        backend: [],
        database: [],
        tools: [],
        others: []
    };

    rawSkills.forEach(skill => {
        const normalized = normalizeSkill(skill);
        let found = false;

        for (const category in SKILL_CATEGORIES) {
            if (SKILL_CATEGORIES[category].includes(normalized)) {
                result[category].push(normalized);
                found = true;
                break;
            }
        }

        if (!found) result.others.push(normalized);
    });

    // Remove duplicates
    for (const key in result) {
        result[key] = [...new Set(result[key])];
    }

    return result;
}

// demo job description text
const jobDescriptionText = `
We are looking for a Frontend Developer with strong skills in
HTML, CSS, JavaScript, React, Tailwind, Git, and basic knowledge of Node.js.
Experience with REST APIs is a plus.
`;

function extractSkillsFromJD(jdText) {
    const lowerJD = jdText.toLowerCase();
    const foundSkills = [];

    for (const category in SKILL_CATEGORIES) {
        SKILL_CATEGORIES[category].forEach(skill => {
            if (lowerJD.includes(skill.toLowerCase())) {
                foundSkills.push(skill);
            }
        });
    }

    return [...new Set(foundSkills)];
}

function calculateATSScore(resumeSkills, jdSkills) {
    const resumeSkillSet = new Set(
        Object.values(resumeSkills).flat()
    );

    let matched = [];
    let missing = [];

    jdSkills.forEach(skill => {
        if (resumeSkillSet.has(skill)) {
            matched.push(skill);
        } else {
            missing.push(skill);
        }
    });

    const score = jdSkills.length === 0
        ? 0
        : Math.round((matched.length / jdSkills.length) * 100);

    return {
        score,
        matchedSkills: matched,
        missingSkills: missing
    };
}


/* =========================*/
function buildAIPrompt(parsedResume, atsResult, jdSkills) {
    return `
You are an ATS resume reviewer.

Resume:
Name: ${parsedResume.name}
Skills: ${JSON.stringify(parsedResume.skills)}
Experience: ${parsedResume.experience.join(" | ")}
Education: ${parsedResume.education.join(" | ")}

Job Skills Required:
${jdSkills.join(", ")}

ATS Score: ${atsResult.score}%

Matched Skills:
${atsResult.matchedSkills.join(", ")}

Missing Skills:
${atsResult.missingSkills.join(", ")}

Give feedback in simple professional language.
`;
}

async function getAIFeedbackFromBackend(prompt) {
    const response = await fetch("http://localhost:3000/api/ai-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        throw new Error("AI request failed");
    }

    const data = await response.json();
    return data.result;
}


