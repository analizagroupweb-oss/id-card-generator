import { createCameraController } from "./camera.js";
import { createIdGenerator } from "./idGenerator.js";
import { createAdminController } from "./admin.js";
import { exportRecordsToPdf, exportReportPdf } from "./pdfExport.js";
import {
  getRouteForRole,
  getSessionUser,
  getUserProfileByUid,
  isAdminUser,
  isFirebaseConfigured,
  isStaffUser,
  logoutCurrentUser,
  observeAuthState,
} from "./auth.js";

const elements = {
  fieldOfficerTab: document.getElementById("fieldOfficerTab"),
  adminTab: document.getElementById("adminTab"),
  fieldSection: document.getElementById("fieldSection"),
  adminSection: document.getElementById("adminSection"),
  adminSessionBar: document.getElementById("adminSessionBar"),
  adminUserEmail: document.getElementById("adminUserEmail"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  headerUserInfo: document.getElementById("userInfo"),
  headerLogoutBtn: document.getElementById("headerLogoutBtn"),
  staffForm: document.getElementById("staffForm"),
  staffNameInput: document.getElementById("staffNameInput"),
  staffEmailInput: document.getElementById("staffEmailInput"),
  staffPasswordInput: document.getElementById("staffPasswordInput"),
  staffRoleInput: document.getElementById("staffRoleInput"),
  addStaffBtn: document.getElementById("addStaffBtn"),
  staffTableBody: document.getElementById("staffTableBody"),
  cameraFeed: document.getElementById("cameraFeed"),
  cameraStatus: document.getElementById("cameraStatus"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  captureBtn: document.getElementById("captureBtn"),
  flipCameraBtn: document.getElementById("flipCameraBtn"),
  dummyPhotoBtn: document.getElementById("dummyPhotoBtn"),
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
  reportFilterType: document.getElementById("reportFilterType"),
  reportMonthInput: document.getElementById("reportMonthInput"),
  reportDayInput: document.getElementById("reportDayInput"),
  reportFilterHint: document.getElementById("reportFilterHint"),
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
  exportReportBtn: document.getElementById("exportReportBtn"),
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
    reportFilterType: elements.reportFilterType,
    reportMonthInput: elements.reportMonthInput,
    reportDayInput: elements.reportDayInput,
    reportFilterHint: elements.reportFilterHint,
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
    exportReportBtn: elements.exportReportBtn,
    selectAllCheckbox: elements.selectAllCheckbox,
    staffForm: elements.staffForm,
    staffNameInput: elements.staffNameInput,
    staffEmailInput: elements.staffEmailInput,
    staffPasswordInput: elements.staffPasswordInput,
    staffRoleInput: elements.staffRoleInput,
    addStaffBtn: elements.addStaffBtn,
    staffTableBody: elements.staffTableBody,
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
  onExportReport: async (records, options) => {
    if (!records.length) {
      generator.showToast("No ID records match the current report filters.", "error");
      return;
    }

    try {
      generator.showToast("Preparing report PDF...", "info");
      exportReportPdf(records, options);
      generator.showToast("Report PDF exported successfully.", "success");
    } catch (error) {
      console.error("Report PDF export failed:", error);
      generator.showToast(error.message || "Report PDF export failed.", "error");
    }
  },
});

let currentAuthUser = null;
let currentUserProfile = null;
let authReady = false;
const initialSessionUser = getSessionUser();
let appReady = false;

function handleRecordsChange(records) {
  admin.updateRecords(records);
}

function handleSignatureChange(signatureDataUrl) {
  admin.setSignaturePreview(signatureDataUrl);
}

function redirectToLogin() {
  document.body.dataset.appReady = "false";
  window.location.replace("./login.html");
}

function markAppReady() {
  if (appReady) {
    return;
  }

  document.body.dataset.appReady = "true";
  appReady = true;
}

function requireSessionUser() {
  const sessionUser = getSessionUser();

  if (!sessionUser?.uid) {
    redirectToLogin();
    return null;
  }

  return sessionUser;
}

function updateAdminSessionUi() {
  const hasAdminAccess = isAdminUser(currentUserProfile);
  const sessionUser = getSessionUser();
  const displayName = sessionUser?.name || currentUserProfile?.name || "User";
  const displayRole = sessionUser?.role || currentUserProfile?.role || "";

  elements.adminSessionBar.classList.toggle("hidden", !hasAdminAccess);
  elements.adminSessionBar.classList.toggle("flex", hasAdminAccess);
  elements.adminUserEmail.textContent = hasAdminAccess
    ? `${displayName} (${displayRole || "admin"})${currentAuthUser?.email ? ` - ${currentAuthUser.email}` : ""}`
    : "Not signed in";
  elements.headerUserInfo.textContent = sessionUser?.uid
    ? `${displayName} (${displayRole || "user"})`
    : "No active session";
  elements.headerLogoutBtn.classList.toggle("hidden", !sessionUser?.uid);
}

function applyRoleAccess() {
  const isAdmin = isAdminUser(currentUserProfile);
  const isStaff = isStaffUser(currentUserProfile);

  elements.fieldOfficerTab.classList.toggle("hidden", isAdmin);
  elements.adminTab.classList.toggle("hidden", isStaff);
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
  window.location.hash = isFieldTab ? "field" : "admin";
}

async function openAdminArea() {
  if (!isFirebaseConfigured()) {
    generator.showToast("Firebase config is missing. Update js/auth.js before using admin login.", "error");
    return;
  }

  if (!isAdminUser(currentUserProfile)) {
    setActiveTab("field");
    return;
  }

  await admin.refreshDashboardData();
  setActiveTab("admin");
}

async function syncTabWithHash() {
  const hash = window.location.hash.toLowerCase();

  if (hash === "#admin") {
    if (!authReady) {
      if (initialSessionUser?.uid && initialSessionUser?.role === "admin") {
        setActiveTab("admin");
        return;
      }

      setActiveTab("field");
      return;
    }

    if (!isAdminUser(currentUserProfile)) {
      setActiveTab("field");
      return;
    }

    await admin.refreshDashboardData();
    setActiveTab("admin");
    return;
  }

  setActiveTab("field");
}

function applyInitialSessionView() {
  const hash = window.location.hash.toLowerCase();

  if (hash === "#admin" && initialSessionUser?.uid && initialSessionUser?.role === "admin") {
    setActiveTab("admin");
    return;
  }

  setActiveTab("field");
}

function createDummyPhotoDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0b3a64" />
          <stop offset="100%" stop-color="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="480" height="640" fill="url(#bg)" />
      <circle cx="240" cy="220" r="92" fill="#f8fafc" fill-opacity="0.95" />
      <path d="M104 548c18-106 96-162 136-162s118 56 136 162" fill="#f8fafc" fill-opacity="0.95" />
      <text x="240" y="84" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">
        TEST PHOTO
      </text>
      <text x="240" y="602" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="#dbeafe">
        No camera connected
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function bindUiEvents() {
  elements.fieldOfficerTab.addEventListener("click", () => setActiveTab("field"));
  elements.adminTab.addEventListener("click", () => {
    openAdminArea();
  });

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

  elements.flipCameraBtn.addEventListener("click", async () => {
    const result = await camera.flipCamera();

    if (!result.ok) {
      generator.showToast(result.message, "error");
      return;
    }

    generator.showToast(`Switched to ${result.facingLabel} camera.`, "success");
  });

  elements.dummyPhotoBtn.addEventListener("click", () => {
    generator.setCapturedPhoto(createDummyPhotoDataUrl());
    elements.cameraStatus.textContent = "Test Mode";
    generator.showToast("Dummy photo loaded. You can continue generating the ID card.", "success");
  });

  elements.generateBtn.addEventListener("click", async () => {
    elements.generateBtn.disabled = true;
    const originalLabel = elements.generateBtn.textContent;
    elements.generateBtn.textContent = "Generating...";

    let record = null;

    try {
      record = await generator.generateRecord();
    } catch (error) {
      console.error("Generate ID failed:", error);
      generator.showToast(error.message || "Generate ID failed.", "error");
    } finally {
      elements.generateBtn.disabled = false;
      elements.generateBtn.textContent = originalLabel;
    }

    if (record && isAdminUser(currentUserProfile)) {
      await openAdminArea();
    }
  });

  elements.flipCardBtn.addEventListener("click", () => {
    elements.cardPreview.classList.toggle("is-flipped");
  });

  elements.adminLogoutBtn.addEventListener("click", async () => {
    try {
      document.body.dataset.appReady = "false";
      await logoutCurrentUser();
      currentAuthUser = null;
      currentUserProfile = null;
      updateAdminSessionUi();
      applyRoleAccess();
      window.location.replace("./login.html");
    } catch (error) {
      generator.showToast(error.message || "Logout failed.", "error");
    }
  });

  elements.headerLogoutBtn.addEventListener("click", async () => {
    try {
      document.body.dataset.appReady = "false";
      await logoutCurrentUser();
      currentAuthUser = null;
      currentUserProfile = null;
      updateAdminSessionUi();
      applyRoleAccess();
      redirectToLogin();
    } catch (error) {
      generator.showToast(error.message || "Logout failed.", "error");
    }
  });
}

bindUiEvents();
window.addEventListener("hashchange", syncTabWithHash);
applyInitialSessionView();

const environmentIssue = camera.getEnvironmentIssue();
if (environmentIssue) {
  generator.showToast(environmentIssue.message, "info");
}

generator.initialize();

if (!requireSessionUser()) {
  updateAdminSessionUi();
}

if (!isFirebaseConfigured()) {
  authReady = true;
  updateAdminSessionUi();
  syncTabWithHash();
  markAppReady();
} else {
  observeAuthState(async (user) => {
    if (!user) {
      currentAuthUser = null;
      currentUserProfile = null;
      authReady = true;
      updateAdminSessionUi();
      applyRoleAccess();
      redirectToLogin();
      return;
    }

    try {
      const profile = await getUserProfileByUid(user.uid, { forceRefresh: true });
      currentAuthUser = user;
      currentUserProfile = profile;
      authReady = true;
      updateAdminSessionUi();
      applyRoleAccess();

      if (profile.role === "admin") {
        window.location.hash = "admin";
      } else if (!window.location.hash || window.location.hash.toLowerCase() === "#admin") {
        window.location.hash = "field";
      }

      await syncTabWithHash();
      markAppReady();
    } catch (error) {
      console.error("User role lookup failed:", error);
      await logoutCurrentUser();
      redirectToLogin();
    }
  });
}
