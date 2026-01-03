const fileInput = document.getElementById("fileInput");
const analysisDiv = document.querySelector(".analysis");

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
        analysisDiv.innerHTML = ""; // reset
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

        // OTHER FILES
        else {
            analysisDiv.textContent = "Preview not available for this file type.";
        }
    };

    reader.readAsDataURL(file);

    /* =========================
       2️⃣ TEXT EXTRACTION (CONSOLE)
    ========================= */

    try {
        console.log("Extracting resume text...");

        const resumeText = await extractResumeText(file);

        console.log("✅ Text extraction successful");
        console.log("Resume text preview (first 500 characters):" );
        console.log(resumeText.slice(0, 500));

    } catch (error) {
        console.error("❌ Text extraction failed:", error.message);
    }
});


// =========================
// Drag & Drop functionality
// =========================

const uploadLabel = document.getElementById("upload");

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


// =========================
// PDF TEXT EXTRACTION
// =========================

async function extractTextFromPDF(file) {
    if (!file || file.type !== "application/pdf") {
        throw new Error("Invalid PDF file");
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str)
            .join(" ");

        fullText += pageText + "\n";
    }

    return fullText.trim();
}


// =========================
// DOCX TEXT EXTRACTION
// =========================

async function extractTextFromDOCX(file) {
    if (
        !file ||
        file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        throw new Error("Invalid DOCX file");
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    return result.value.trim();
}


// =========================
// FILE TYPE ROUTER
// =========================

async function extractResumeText(file) {
    if (!file) throw new Error("No file provided");

    if (file.type === "application/pdf") {
        return await extractTextFromPDF(file);
    }

    if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return await extractTextFromDOCX(file);
    }

    throw new Error("Unsupported file type");
}
