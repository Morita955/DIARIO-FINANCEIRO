const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];
const STORAGE_KEY = "clareza-receipts";

const elements = {
    form: document.querySelector("#receipt-form"),
    uploadArea: document.querySelector("#upload-area"),
    fileInput: document.querySelector("#receipt-file"),
    uploadPlaceholder: document.querySelector("#upload-placeholder"),
    filePreview: document.querySelector("#file-preview"),
    previewImage: document.querySelector("#preview-image"),
    fileName: document.querySelector("#file-name"),
    removeFile: document.querySelector("#remove-file"),
    fileMessage: document.querySelector("#file-message"),
    description: document.querySelector("#description"),
    amount: document.querySelector("#amount"),
    category: document.querySelector("#category"),
    purchaseDate: document.querySelector("#purchase-date"),
    formStatus: document.querySelector("#form-status"),
    totalAmount: document.querySelector("#total-amount"),
    totalNote: document.querySelector("#total-note"),
    receiptCount: document.querySelector("#receipt-count"),
    categoryCount: document.querySelector("#category-count"),
    categoryList: document.querySelector("#category-list"),
    receiptList: document.querySelector("#receipt-list"),
    clearReceipts: document.querySelector("#clear-receipts")
};

let selectedFile = null;
let previewUrl = null;
let receipts = loadReceipts();

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

elements.purchaseDate.value = new Date().toISOString().split("T")[0];
renderSummary();

elements.uploadPlaceholder.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", (event) => setSelectedFile(event.target.files[0]));
elements.removeFile.addEventListener("click", clearSelectedFile);
elements.form.addEventListener("submit", handleSubmit);
elements.clearReceipts.addEventListener("click", clearReceipts);

["dragenter", "dragover"].forEach((eventName) => {
    elements.uploadArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.uploadArea.classList.add("is-dragging");
    });
});

elements.uploadArea.addEventListener("dragleave", (event) => {
    if (!elements.uploadArea.contains(event.relatedTarget)) elements.uploadArea.classList.remove("is-dragging");
});
elements.uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.uploadArea.classList.remove("is-dragging");
    setSelectedFile(event.dataTransfer.files[0]);
});

function setSelectedFile(file) {
    clearFileMessage();
    if (!file) return;

    if (!VALID_TYPES.includes(file.type)) {
        showFileMessage("Escolha uma imagem JPG, PNG ou WEBP.");
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        showFileMessage("A imagem precisa ter no máximo 5 MB.");
        return;
    }

    selectedFile = file;
    revokePreviewUrl();
    previewUrl = URL.createObjectURL(file);
    elements.previewImage.src = previewUrl;
    elements.fileName.textContent = file.name;
    elements.uploadPlaceholder.hidden = true;
    elements.filePreview.hidden = false;
}

function clearSelectedFile() {
    selectedFile = null;
    revokePreviewUrl();
    elements.fileInput.value = "";
    elements.previewImage.removeAttribute("src");
    elements.uploadPlaceholder.hidden = false;
    elements.filePreview.hidden = true;
    clearFileMessage();
}

async function handleSubmit(event) {
    event.preventDefault();
    elements.formStatus.textContent = "";

    if (!selectedFile) {
        showFileMessage("Anexe uma foto do comprovante para continuar.");
        elements.uploadArea.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    if (!elements.form.reportValidity()) return;

    const image = await fileToDataUrl(selectedFile);
    const receipt = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        description: elements.description.value.trim(),
        amount: Number(elements.amount.value),
        category: elements.category.value,
        date: elements.purchaseDate.value,
        image,
        fileName: selectedFile.name
    };

    receipts = [receipt, ...receipts];
    saveReceipts();
    renderSummary();
    elements.formStatus.textContent = "Comprovante adicionado ao seu resumo.";
    elements.form.reset();
    elements.purchaseDate.value = new Date().toISOString().split("T")[0];
    clearSelectedFile();
    elements.description.focus();
}

function renderSummary() {
    const total = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const grouped = receipts.reduce((groups, receipt) => {
        groups[receipt.category] = (groups[receipt.category] || 0) + receipt.amount;
        return groups;
    }, {});
    const categories = Object.entries(grouped).sort(([, first], [, second]) => second - first);
    const highestCategory = categories[0]?.[0];

    elements.totalAmount.textContent = currency.format(total);
    elements.totalNote.textContent = receipts.length ? `Maior categoria: ${highestCategory}` : "Adicione seu primeiro comprovante";
    elements.receiptCount.textContent = `${receipts.length} ${receipts.length === 1 ? "item" : "itens"}`;
    elements.categoryCount.textContent = `${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`;
    elements.clearReceipts.hidden = receipts.length === 0;

    elements.categoryList.innerHTML = categories.length ? categories.map(([category, value]) => {
        const percentage = total ? (value / total) * 100 : 0;
        return `<div class="category-row"><div class="category-label"><span>${escapeHtml(category)}</span><span>${currency.format(value)}</span></div><div class="progress"><span style="width: ${percentage}%"></span></div></div>`;
    }).join("") : '<p class="empty-state">Seu resumo por categoria aparecerá aqui.</p>';

    elements.receiptList.innerHTML = receipts.length ? receipts.slice(0, 8).map((receipt) => `
        <article class="receipt-item">
            <img class="receipt-thumb" src="${receipt.image}" alt="">
            <div><strong>${escapeHtml(receipt.description)}</strong><small>${escapeHtml(receipt.category)} · ${formatDate(receipt.date)}</small></div>
            <span class="receipt-value">${currency.format(receipt.amount)}</span>
        </article>`).join("") : '<p class="empty-state">Nenhum comprovante registrado ainda.</p>';
}

function clearReceipts() {
    receipts = [];
    saveReceipts();
    renderSummary();
    elements.formStatus.textContent = "Resumo limpo.";
}

function loadReceipts() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(saved) ? saved.filter((receipt) => receipt && typeof receipt.image === "string" && receipt.image.startsWith("data:image/")) : [];
    } catch {
        return [];
    }
}

function saveReceipts() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
    } catch {
        elements.formStatus.textContent = "Registro criado apenas nesta sessão: o armazenamento local está cheio.";
    }
}

function formatDate(date) {
    return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function showFileMessage(message) {
    elements.fileMessage.textContent = message;
}

function clearFileMessage() {
    elements.fileMessage.textContent = "";
}

function revokePreviewUrl() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", reject);
        reader.readAsDataURL(file);
    });
}

function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
