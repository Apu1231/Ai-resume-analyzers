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
        console.log("Resume text preview (first 500 chars):");
        console.log(resumeText.slice(0, 500));

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
