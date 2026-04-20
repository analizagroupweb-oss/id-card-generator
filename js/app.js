import { createCameraController } from "./camera.js";
import { createIdGenerator } from "./idGenerator.js";
import { createAdminController } from "./admin.js";
import { exportRecordsToPdf } from "./pdfExport.js";

const elements = {
  fieldOfficerTab: document.getElementById("fieldOfficerTab"),
  adminTab: document.getElementById("adminTab"),
  fieldSection: document.getElementById("fieldSection"),
  adminSection: document.getElementById("adminSection"),
  cameraFeed: document.getElementById("cameraFeed"),
  cameraStatus: document.getElementById("cameraStatus"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  captureBtn: document.getElementById("captureBtn"),
  captureCanvas: document.getElementById("captureCanvas"),
  capturedPreview: document.getElementById("capturedPreview"),
  capturePlaceholder: document.getElementById("capturePlaceholder"),
  nameInput: document.getElementById("nameInput"),
  designationInput: document.getElementById("designationInput"),
  dobInput: document.getElementById("dobInput"),
  contactInput: document.getElementById("contactInput"),
  bloodGroupInput: document.getElementById("bloodGroupInput"),
  autoIdNumber: document.getElementById("autoIdNumber"),
  autoIssueDate: document.getElementById("autoIssueDate"),
  autoValidUpto: document.getElementById("autoValidUpto"),
  generateBtn: document.getElementById("generateBtn"),
  flipCardBtn: document.getElementById("flipCardBtn"),
  cardPreview: document.getElementById("cardPreview"),
  cardNameFront: document.getElementById("cardNameFront"),
  cardDesignationFront: document.getElementById("cardDesignationFront"),
  cardIdFront: document.getElementById("cardIdFront"),
  cardDobFront: document.getElementById("cardDobFront"),
  cardIssueFront: document.getElementById("cardIssueFront"),
  cardValidFront: document.getElementById("cardValidFront"),
  barcodeFront: document.getElementById("barcodeFront"),
  cardPhotoFront: document.getElementById("cardPhotoFront"),
  cardPhotoFrontPlaceholder: document.getElementById("cardPhotoFrontPlaceholder"),
  cardContactBack: document.getElementById("cardContactBack"),
  cardBloodBack: document.getElementById("cardBloodBack"),
  cardIssueBack: document.getElementById("cardIssueBack"),
  cardValidBack: document.getElementById("cardValidBack"),
  cardSignature: document.getElementById("cardSignature"),
  cardSignaturePlaceholder: document.getElementById("cardSignaturePlaceholder"),
  toast: document.getElementById("toast"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  reportMonthInput: document.getElementById("reportMonthInput"),
  monthlyCount: document.getElementById("monthlyCount"),
  totalIdsStat: document.getElementById("totalIdsStat"),
  prefixInput: document.getElementById("prefixInput"),
  startingNumberInput: document.getElementById("startingNumberInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  signatureInput: document.getElementById("signatureInput"),
  signaturePreview: document.getElementById("signaturePreview"),
  signaturePlaceholder: document.getElementById("signaturePlaceholder"),
  searchInput: document.getElementById("searchInput"),
  exportSelectedBtn: document.getElementById("exportSelectedBtn"),
  selectAllCheckbox: document.getElementById("selectAllCheckbox"),
  pdfSheet: document.getElementById("pdfSheet"),
};

const generator = createIdGenerator({
  formElements: {
    nameInput: elements.nameInput,
    designationInput: elements.designationInput,
    dobInput: elements.dobInput,
    contactInput: elements.contactInput,
    bloodGroupInput: elements.bloodGroupInput,
  },
  previewElements: {
    cardNameFront: elements.cardNameFront,
    cardDesignationFront: elements.cardDesignationFront,
    cardIdFront: elements.cardIdFront,
    cardDobFront: elements.cardDobFront,
    cardIssueFront: elements.cardIssueFront,
    cardValidFront: elements.cardValidFront,
    barcodeFront: elements.barcodeFront,
    cardPhotoFront: elements.cardPhotoFront,
    cardPhotoFrontPlaceholder: elements.cardPhotoFrontPlaceholder,
    cardContactBack: elements.cardContactBack,
    cardBloodBack: elements.cardBloodBack,
    cardIssueBack: elements.cardIssueBack,
    cardValidBack: elements.cardValidBack,
    cardSignature: elements.cardSignature,
    cardSignaturePlaceholder: elements.cardSignaturePlaceholder,
  },
  captureElements: {
    capturedPreview: elements.capturedPreview,
    capturePlaceholder: elements.capturePlaceholder,
  },
  autoFields: {
    idNumber: elements.autoIdNumber,
    issueDate: elements.autoIssueDate,
    validUpto: elements.autoValidUpto,
  },
  toast: elements.toast,
  onRecordsChange: handleRecordsChange,
  onSignatureChange: handleSignatureChange,
});

const camera = createCameraController({
  videoElement: elements.cameraFeed,
  canvasElement: elements.captureCanvas,
  onStatusChange: (status) => {
    elements.cameraStatus.textContent = status;
  },
  onCapture: (dataUrl) => {
    generator.setCapturedPhoto(dataUrl);
  },
});

const admin = createAdminController({
  generator,
  elements: {
    recordsTableBody: elements.recordsTableBody,
    reportMonthInput: elements.reportMonthInput,
    monthlyCount: elements.monthlyCount,
    totalIdsStat: elements.totalIdsStat,
    prefixInput: elements.prefixInput,
    startingNumberInput: elements.startingNumberInput,
    saveSettingsBtn: elements.saveSettingsBtn,
    signatureInput: elements.signatureInput,
    signaturePreview: elements.signaturePreview,
    signaturePlaceholder: elements.signaturePlaceholder,
    searchInput: elements.searchInput,
    exportSelectedBtn: elements.exportSelectedBtn,
    selectAllCheckbox: elements.selectAllCheckbox,
  },
  onExportSelected: async (records) => {
    if (!records.length) {
      generator.showToast("Select at least one ID before exporting.", "error");
      return;
    }

    try {
      generator.showToast("Preparing printable PDF sheet...", "info");
      await exportRecordsToPdf(records, elements.pdfSheet);
      generator.showToast("PDF exported successfully.", "success");
    } catch (error) {
      console.error("PDF export failed:", error);
      generator.showToast(error.message || "PDF export failed.", "error");
    }
  },
});

generator.initialize();

function handleRecordsChange(records) {
  admin.updateRecords(records);
}

function handleSignatureChange(signatureDataUrl) {
  admin.setSignaturePreview(signatureDataUrl);
}

function setActiveTab(tabName) {
  const isFieldTab = tabName === "field";
  elements.fieldSection.classList.toggle("hidden", !isFieldTab);
  elements.adminSection.classList.toggle("hidden", isFieldTab);
  elements.fieldOfficerTab.classList.toggle("is-active", isFieldTab);
  elements.adminTab.classList.toggle("is-active", !isFieldTab);
  elements.fieldOfficerTab.classList.toggle("bg-white", !isFieldTab);
  elements.fieldOfficerTab.classList.toggle("text-slate-600", !isFieldTab);
  elements.fieldOfficerTab.classList.toggle("ring-1", !isFieldTab);
  elements.fieldOfficerTab.classList.toggle("ring-slate-200", !isFieldTab);
  elements.adminTab.classList.toggle("bg-white", isFieldTab);
  elements.adminTab.classList.toggle("text-slate-600", isFieldTab);
  elements.adminTab.classList.toggle("ring-1", isFieldTab);
  elements.adminTab.classList.toggle("ring-slate-200", isFieldTab);
}

function bindUiEvents() {
  elements.fieldOfficerTab.addEventListener("click", () => setActiveTab("field"));
  elements.adminTab.addEventListener("click", () => setActiveTab("admin"));

  elements.startCameraBtn.addEventListener("click", async () => {
    const result = await camera.start();

    if (!result.ok) {
      generator.showToast(result.message, "error");
      return;
    }

    generator.showToast("Camera started successfully.", "success");
  });

  elements.captureBtn.addEventListener("click", () => {
    const image = camera.capture();

    if (!image) {
      generator.showToast("Camera is not ready yet. Start it and try again.", "error");
      return;
    }

    generator.showToast("Photo captured successfully.", "success");
  });

  elements.generateBtn.addEventListener("click", () => {
    const record = generator.generateRecord();

    if (record) {
      setActiveTab("admin");
    }
  });

  elements.flipCardBtn.addEventListener("click", () => {
    elements.cardPreview.classList.toggle("is-flipped");
  });
}

bindUiEvents();
setActiveTab("field");

const environmentIssue = camera.getEnvironmentIssue();
if (environmentIssue) {
  generator.showToast(environmentIssue.message, "info");
}
