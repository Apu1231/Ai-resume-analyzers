const fileInput = document.getElementById("fileInput");
const analysisDiv = document.querySelector(".analysis");

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) {
        console.log("No file selected");
        return;
    }

    console.log("File selected:", file.name, file.type);

    const reader = new FileReader();

    reader.onload = () => {
        analysisDiv.innerHTML = ""; // reset
        analysisDiv.style.display = "block";

        // ✅ IMAGE PREVIEW
        if (file.type.startsWith("image/")) {
            const img = document.createElement("img");
            img.src = reader.result;
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            analysisDiv.appendChild(img);
        }

        // ⚠️ PDF PREVIEW (basic)
        else if (file.type === "application/pdf") {
            const iframe = document.createElement("iframe");
            iframe.src = reader.result;
            iframe.width = "100%";
            iframe.height = "300px";
            analysisDiv.appendChild(iframe);
        }

        // ❌ DOCX (no preview)
        else {
            analysisDiv.textContent = "Preview not available for this file type.";
        }
    };

    reader.readAsDataURL(file);

});
