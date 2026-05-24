const form = document.querySelector(".prompt-form");
const promptInput = document.querySelector(".prompt-input");
const promptButton = document.querySelector(".prompt-btn");
const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = themeToggle.querySelector("i");
const tokenInput = document.querySelector("#api-token");
const modelSelect = document.querySelector("#model-select");
const countSelect = document.querySelector("#count-select");
const ratioSelect = document.querySelector("#ratio-select");
const generateButton = document.querySelector(".generate-btn");
const statusText = document.querySelector(".status-text");
const galleryGrid = document.querySelector(".gallery-grid");

const HF_API_BASE_URL = "https://router.huggingface.co/hf-inference/models";
const TOKEN_STORAGE_KEY = "hf_image_generator_token";

const randomPrompts = [
    "A futuristic city floating above the clouds at sunset",
    "A cozy reading room filled with plants and warm window light",
    "A cyberpunk street market in the rain with neon signs",
    "An astronaut discovering glowing flowers on a distant planet",
    "A tiny wooden cabin beside a crystal lake under northern lights"
];

const imageSizes = {
    "1/1": { width: 768, height: 768 },
    "16/9": { width: 1024, height: 576 },
    "9/16": { width: 576, height: 1024 }
};

tokenInput.value = localStorage.getItem(TOKEN_STORAGE_KEY) || "";

promptButton.addEventListener("click", () => {
    const prompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    promptInput.value = prompt;
    promptInput.focus();
});

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    themeIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = tokenInput.value.trim();
    const prompt = promptInput.value.trim();
    const model = modelSelect.value;
    const imageCount = Number(countSelect.value);
    const ratio = ratioSelect.value;

    if (!token || !prompt || !model || !imageCount || !ratio) {
        form.reportValidity();
        return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setLoadingState(true, imageCount);

    try {
        const requests = Array.from({ length: imageCount }, (_, index) => {
            return generateImage({ token, prompt, model, ratio, seed: Date.now() + index });
        });
        const imageUrls = await Promise.all(requests);

        galleryGrid.innerHTML = "";
        imageUrls.forEach((imageUrl, index) => {
            galleryGrid.appendChild(createImageCard(imageUrl, prompt, ratio, index));
        });
        statusText.textContent = "Images generated successfully.";
    } catch (error) {
        galleryGrid.innerHTML = "";
        statusText.textContent = error.message;
    } finally {
        setLoadingState(false);
    }
});

async function generateImage({ token, prompt, model, ratio, seed }) {
    const size = imageSizes[ratio];
    const response = await fetch(`${HF_API_BASE_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "image/png"
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                width: size.width,
                height: size.height,
                num_inference_steps: model.includes("schnell") ? 4 : 25,
                seed
            },
            options: {
                wait_for_model: true
            }
        })
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, contentType));
    }

    if (!contentType.includes("image")) {
        throw new Error(await getApiErrorMessage(response, contentType));
    }

    const imageBlob = await response.blob();
    return URL.createObjectURL(imageBlob);
}

async function getApiErrorMessage(response, contentType) {
    if (contentType.includes("application/json")) {
        const data = await response.json();
        return data.error || data.message || `Request failed with status ${response.status}.`;
    }

    const text = await response.text();
    return text || `Request failed with status ${response.status}.`;
}

function createImageCard(imageUrl, prompt, ratio, index) {
    const card = document.createElement("article");
    card.className = "image-card generated-card";
    card.style.aspectRatio = ratio;

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = prompt;

    const downloadLink = document.createElement("a");
    downloadLink.className = "download-btn";
    downloadLink.href = imageUrl;
    downloadLink.download = `ai-image-${index + 1}.png`;
    downloadLink.ariaLabel = "Download image";
    downloadLink.innerHTML = '<i class="fa-solid fa-download"></i>';

    card.append(image, downloadLink);
    return card;
}

function setLoadingState(isLoading, imageCount = 0) {
    generateButton.disabled = isLoading;
    generateButton.innerHTML = isLoading
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Generating'
        : '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate';

    if (!isLoading) {
        return;
    }

    statusText.textContent = "Generating images...";
    galleryGrid.innerHTML = "";

    for (let index = 0; index < imageCount; index++) {
        const loadingCard = document.createElement("article");
        loadingCard.className = "image-card loading-card";
        loadingCard.style.aspectRatio = ratioSelect.value;
        loadingCard.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        galleryGrid.appendChild(loadingCard);
    }
}
