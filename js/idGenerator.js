import {
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  ref,
  uploadString,
  getDownloadURL,
  getSessionUser,
} from "./auth.js";

const STORAGE_KEYS = {
  counter: "idCounter",
  startNumber: "id-card-start-number",
  prefix: "id-card-prefix",
  signature: "id-card-signature",
};
const FIREBASE_TIMEOUT_MS = 8000;

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
    records: [],
    capturedPhoto: "",
    signature: loadSignature(),
    selectedPreviewSide: "front",
    recordsLoaded: false,
  };

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

  function withTimeout(promise, timeoutMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, FIREBASE_TIMEOUT_MS);
      }),
    ]);
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
      displayValue: false,
      height: 22,
      margin: 0,
      width: 0.9,
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

  function sortRecordsByCreatedAtDesc(records) {
    return [...records].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }

  function normalizeRecord(docId, source) {
    const createdAtValue = source.createdAt?.toDate ? source.createdAt.toDate() : source.createdAt;
    const createdAt = createdAtValue ? new Date(createdAtValue).toISOString() : new Date().toISOString();

    return {
      docId,
      idNumber: source.idNumber || "--",
      name: source.name || "--",
      designation: source.designation || "--",
      dob: source.dob || "",
      contactNumber: source.contactNumber || source.contact || "--",
      bloodGroup: source.bloodGroup || "--",
      issueDate: source.issueDate || "",
      validUpto: source.validUpto || "",
      photo: source.photoURL || "",
      photoURL: source.photoURL || "",
      createdBy: source.createdBy || "",
      createdByName: source.createdByName || "N/A",
      signature: state.signature,
      createdAt,
    };
  }

  async function fetchRecords() {
    let querySnapshot;

    try {
      const recordsQuery = query(collection(db, "idCards"), orderBy("createdAt", "desc"));
      querySnapshot = await withTimeout(
        getDocs(recordsQuery),
        "Timed out while loading Firestore records.",
      );
    } catch (error) {
      console.warn("Ordered Firestore fetch failed, retrying without orderBy:", error);
      querySnapshot = await withTimeout(
        getDocs(collection(db, "idCards")),
        "Timed out while loading Firestore records.",
      );
    }

    state.records = sortRecordsByCreatedAtDesc(
      querySnapshot.docs.map((doc) => normalizeRecord(doc.id, doc.data())),
    );
    state.recordsLoaded = true;
    onRecordsChange([...state.records]);
    updatePreview();

    return [...state.records];
  }

  async function uploadCapturedPhoto(idNumber) {
    const storageRef = ref(storage, `idPhotos/${idNumber}.png`);

    await withTimeout(
      uploadString(storageRef, state.capturedPhoto, "data_url"),
      "Timed out while uploading the captured photo.",
    );
    return withTimeout(
      getDownloadURL(storageRef),
      "Timed out while reading the uploaded photo URL.",
    );
  }

  function upsertRecord(nextRecord) {
    const existingIndex = state.records.findIndex((record) => record.idNumber === nextRecord.idNumber);

    if (existingIndex >= 0) {
      state.records.splice(existingIndex, 1, nextRecord);
    } else {
      state.records.unshift(nextRecord);
    }

    state.records = sortRecordsByCreatedAtDesc(state.records);
    onRecordsChange([...state.records]);
  }

  async function persistRecordToFirebase(localRecord, payload) {
    let persistedPhotoURL = payload.photoURL;

    try {
      persistedPhotoURL = await uploadCapturedPhoto(localRecord.idNumber);
    } catch (error) {
      console.error("Photo upload failed:", error);
      showToast("Photo upload failed, continuing with local image data.", "info");
    }

    try {
      const docRef = await withTimeout(
        addDoc(collection(db, "idCards"), {
          ...payload,
          photoURL: persistedPhotoURL,
        }),
        "Timed out while saving the ID to Firestore.",
      );

      const persistedRecord = {
        ...localRecord,
        docId: docRef.id,
        photo: persistedPhotoURL,
        photoURL: persistedPhotoURL,
        localOnly: false,
      };

      upsertRecord(persistedRecord);
      showToast(`ID generated successfully for ${persistedRecord.name}.`, "success");
    } catch (error) {
      console.error("Failed to save ID record:", error);
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(error.message || "Saving to Firestore failed. The ID was created only in this session.");
      }
      showToast("ID created locally, but Firestore save failed.", "info");
    }
  }

  async function generateRecord() {
    if (!validateForm()) {
      return null;
    }

    const sessionUser = getSessionUser();

    if (!sessionUser?.uid) {
      if (typeof window !== "undefined") {
        window.location.replace("./login.html");
      }
      return null;
    }

    const nextId = getNextAvailableIdNumber();
    const idNumber = nextId.idNumber;

    if (state.records.some((record) => record.idNumber === idNumber)) {
      showToast("A duplicate ID number was detected. Please try again.", "error");
      updatePreview();
      return null;
    }

    const issueDate = getTodayIso();
    const validUpto = getValidUpto(issueDate);
    const payload = {
      name: formElements.nameInput.value.trim(),
      designation: formElements.designationInput.value.trim(),
      dob: formElements.dobInput.value,
      contact: formElements.contactInput.value.trim(),
      contactNumber: formElements.contactInput.value.trim(),
      bloodGroup: formElements.bloodGroupInput.value.trim().toUpperCase(),
      idNumber,
      issueDate,
      validUpto,
      photoURL: state.capturedPhoto,
      createdBy: sessionUser.uid,
      createdByName: sessionUser.name || "User",
      createdAt: new Date(),
    };

    const localRecord = normalizeRecord(`local-${Date.now()}`, payload);
    localRecord.signature = state.signature;
    localRecord.localOnly = true;

    setLastUsedNumber(nextId.sequence);
    upsertRecord(localRecord);
    updatePreview();
    showToast(`ID created for ${localRecord.name}. Syncing to Firebase...`, "info");

    void persistRecordToFirebase(localRecord, payload);

    return localRecord;
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

  async function initialize() {
    bindFormEvents();
    updatePreview();
    onSignatureChange(state.signature);

    try {
      await fetchRecords();
    } catch (error) {
      state.recordsLoaded = true;
      console.error("Failed to load Firestore records:", error);
      showToast(error.message || "Unable to load ID records from Firestore.", "error");
      onRecordsChange([...state.records]);
    }
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
    fetchRecords,
  };
}
