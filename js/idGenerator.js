const STORAGE_KEYS = {
  ids: "id-card-records",
  counter: "idCounter",
  startNumber: "id-card-start-number",
  prefix: "id-card-prefix",
  signature: "id-card-signature",
};

export function createIdGenerator({
  formElements,
  previewElements,
  captureElements,
  autoFields,
  toast,
  onRecordsChange,
  onSignatureChange,
}) {
  const state = {
    records: loadRecords(),
    capturedPhoto: "",
    signature: loadSignature(),
    selectedPreviewSide: "front",
  };

  function loadRecords() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ids);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to parse ID records:", error);
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEYS.ids, JSON.stringify(state.records));
  }

  function getStoredPrefix() {
    const prefix = (localStorage.getItem(STORAGE_KEYS.prefix) || "SEC").trim().toUpperCase();
    return prefix || "SEC";
  }

  function getStoredStartNumber() {
    const value = Number(localStorage.getItem(STORAGE_KEYS.startNumber) || "1");
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  function getLastUsedNumber() {
    const stored = localStorage.getItem(STORAGE_KEYS.counter);

    if (stored === null) {
      return null;
    }

    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }

  function setLastUsedNumber(value) {
    localStorage.setItem(STORAGE_KEYS.counter, String(value));
  }

  function sanitizePrefix(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");
  }

  function saveNumberingSettings({ prefix, startingNumber }) {
    const nextPrefix = sanitizePrefix(prefix) || "SEC";
    const nextStartingNumber = Math.max(1, Math.floor(Number(startingNumber) || 1));

    localStorage.setItem(STORAGE_KEYS.prefix, nextPrefix);
    localStorage.setItem(STORAGE_KEYS.startNumber, String(nextStartingNumber));

    if (getLastUsedNumber() === null) {
      setLastUsedNumber(nextStartingNumber - 1);
    }

    updateAutoFields();
    updatePreview();

    return {
      prefix: nextPrefix,
      startingNumber: nextStartingNumber,
    };
  }

  function loadSignature() {
    return localStorage.getItem(STORAGE_KEYS.signature) || "";
  }

  function saveSignature(dataUrl) {
    localStorage.setItem(STORAGE_KEYS.signature, dataUrl);
    state.signature = dataUrl;
    updateSignaturePreview();
    onSignatureChange(state.signature);
  }

  function showToast(message, type = "success") {
    const colorMap = {
      success: "bg-emerald-600 text-white",
      error: "bg-rose-600 text-white",
      info: "bg-slate-900 text-white",
    };

    toast.innerHTML = `
      <div class="rounded-2xl px-4 py-3 shadow-2xl ${colorMap[type] || colorMap.info}">
        <p class="text-sm font-semibold">${message}</p>
      </div>
    `;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function formatDisplayDate(dateValue) {
    if (!dateValue) {
      return "--";
    }

    return new Date(dateValue).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getTodayIso() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 10);
  }

  function getValidUpto(issueDate) {
    const date = new Date(issueDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  function formatSequence(sequence) {
    return String(sequence).padStart(4, "0");
  }

  function formatIdNumber(prefix, sequence) {
    return `${prefix}-${formatSequence(sequence)}`;
  }

  function getUsedIdSet() {
    return new Set(state.records.map((record) => record.idNumber));
  }

  function getNextSequenceNumber() {
    const lastUsedNumber = getLastUsedNumber();
    return lastUsedNumber === null ? getStoredStartNumber() : lastUsedNumber + 1;
  }

  function getNextAvailableIdNumber() {
    const usedIds = getUsedIdSet();
    const prefix = getStoredPrefix();
    let candidate = getNextSequenceNumber();
    let idNumber = formatIdNumber(prefix, candidate);

    while (usedIds.has(idNumber)) {
      candidate += 1;
      idNumber = formatIdNumber(prefix, candidate);
    }

    return {
      prefix,
      sequence: candidate,
      idNumber,
    };
  }

  function getPreviewPayload() {
    const issueDate = getTodayIso();
    const validUpto = getValidUpto(issueDate);
    const nextId = getNextAvailableIdNumber();
    return {
      name: formElements.nameInput.value.trim() || "YOUR NAME",
      designation: formElements.designationInput.value.trim() || "JOB POSITION",
      dob: formatDisplayDate(formElements.dobInput.value),
      contact: formElements.contactInput.value.trim() || "--",
      bloodGroup: formElements.bloodGroupInput.value.trim().toUpperCase() || "--",
      issueDate,
      validUpto,
      idNumber: nextId.idNumber,
      photo: state.capturedPhoto,
      signature: state.signature,
    };
  }

  function updateBarcode(idNumber) {
    if (!window.JsBarcode) {
      return;
    }

    window.JsBarcode(previewElements.barcodeFront, idNumber, {
      format: "CODE128",
      displayValue: true,
      fontSize: 11,
      height: 42,
      margin: 0,
      width: 1.2,
      background: "#ffffff",
      lineColor: "#0f172a",
    });
  }

  function updatePhotoPreview() {
    if (state.capturedPhoto) {
      captureElements.capturedPreview.src = state.capturedPhoto;
      captureElements.capturedPreview.classList.remove("hidden");
      captureElements.capturePlaceholder.classList.add("hidden");
      previewElements.cardPhotoFront.src = state.capturedPhoto;
      previewElements.cardPhotoFront.classList.remove("hidden");
      previewElements.cardPhotoFrontPlaceholder.classList.add("hidden");
      return;
    }

    captureElements.capturedPreview.removeAttribute("src");
    captureElements.capturedPreview.classList.add("hidden");
    captureElements.capturePlaceholder.classList.remove("hidden");
    previewElements.cardPhotoFront.removeAttribute("src");
    previewElements.cardPhotoFront.classList.add("hidden");
    previewElements.cardPhotoFrontPlaceholder.classList.remove("hidden");
  }

  function updateSignaturePreview() {
    if (state.signature) {
      previewElements.cardSignature.src = state.signature;
      previewElements.cardSignature.classList.remove("hidden");
      previewElements.cardSignaturePlaceholder.classList.add("hidden");
      return;
    }

    previewElements.cardSignature.removeAttribute("src");
    previewElements.cardSignature.classList.add("hidden");
    previewElements.cardSignaturePlaceholder.classList.remove("hidden");
  }

  function updateAutoFields() {
    const payload = getPreviewPayload();
    autoFields.idNumber.textContent = payload.idNumber;
    autoFields.issueDate.textContent = formatDisplayDate(payload.issueDate);
    autoFields.validUpto.textContent = formatDisplayDate(payload.validUpto);
  }

  function updatePreview() {
    const payload = getPreviewPayload();
    previewElements.cardNameFront.textContent = payload.name;
    previewElements.cardDesignationFront.textContent = payload.designation;
    previewElements.cardIdFront.textContent = payload.idNumber;
    previewElements.cardDobFront.textContent = payload.dob;
    previewElements.cardIssueFront.textContent = formatDisplayDate(payload.issueDate);
    previewElements.cardValidFront.textContent = formatDisplayDate(payload.validUpto);
    previewElements.cardContactBack.textContent = payload.contact;
    previewElements.cardBloodBack.textContent = payload.bloodGroup;
    previewElements.cardIssueBack.textContent = formatDisplayDate(payload.issueDate);
    previewElements.cardValidBack.textContent = formatDisplayDate(payload.validUpto);
    updatePhotoPreview();
    updateSignaturePreview();
    updateAutoFields();
    updateBarcode(payload.idNumber);
  }

  function setCapturedPhoto(dataUrl) {
    state.capturedPhoto = dataUrl || "";
    updatePreview();
  }

  function validateForm() {
    const data = {
      name: formElements.nameInput.value.trim(),
      designation: formElements.designationInput.value.trim(),
      dob: formElements.dobInput.value,
      contact: formElements.contactInput.value.trim(),
      bloodGroup: formElements.bloodGroupInput.value.trim(),
      photo: state.capturedPhoto,
    };

    if (!data.name || !data.designation || !data.dob || !data.contact || !data.bloodGroup) {
      showToast("Please complete all required fields.", "error");
      return false;
    }

    if (!/^[+\d][\d\s-]{6,}$/.test(data.contact)) {
      showToast("Enter a valid contact number.", "error");
      return false;
    }

    if (!data.photo) {
      showToast("Capture a photo before generating the ID.", "error");
      return false;
    }

    return true;
  }

  function generateRecord() {
    if (!validateForm()) {
      return null;
    }

    const nextId = getNextAvailableIdNumber();
    const idNumber = nextId.idNumber;

    if (state.records.some((record) => record.idNumber === idNumber)) {
      showToast("A duplicate ID number was detected. Please try again.", "error");
      setLastUsedNumber(nextId.sequence);
      updatePreview();
      return null;
    }

    const issueDate = getTodayIso();
    const validUpto = getValidUpto(issueDate);
    const record = {
      idNumber,
      name: formElements.nameInput.value.trim(),
      designation: formElements.designationInput.value.trim(),
      dob: formElements.dobInput.value,
      contactNumber: formElements.contactInput.value.trim(),
      bloodGroup: formElements.bloodGroupInput.value.trim().toUpperCase(),
      issueDate,
      validUpto,
      photo: state.capturedPhoto,
      signature: state.signature,
      createdAt: new Date().toISOString(),
    };

    state.records.unshift(record);
    setLastUsedNumber(nextId.sequence);
    saveRecords();
    updatePreview();
    onRecordsChange([...state.records]);
    showToast(`ID generated successfully for ${record.name}.`, "success");
    return record;
  }

  function getRecords() {
    return [...state.records];
  }

  function getSettings() {
    return {
      prefix: getStoredPrefix(),
      startingNumber: getStoredStartNumber(),
      lastUsedNumber: getLastUsedNumber(),
      signature: state.signature,
    };
  }

  function handleSignatureUpload(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      saveSignature(String(reader.result || ""));
      showToast("Signature uploaded successfully.", "success");
    };
    reader.readAsDataURL(file);
  }

  function bindFormEvents() {
    Object.values(formElements).forEach((element) => {
      element.addEventListener("input", updatePreview);
      element.addEventListener("change", updatePreview);
    });
  }

  function initialize() {
    bindFormEvents();
    updatePreview();
    onRecordsChange([...state.records]);
    onSignatureChange(state.signature);
  }

  return {
    generateRecord,
    getRecords,
    getSettings,
    handleSignatureUpload,
    setCapturedPhoto,
    updatePreview,
    saveNumberingSettings,
    showToast,
    formatDisplayDate,
    getTodayIso,
    initialize,
  };
}
