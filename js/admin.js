import {
  auth,
  db,
  functions,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  getSessionUser,
  httpsCallable,
  normalizeRole,
} from "./auth.js";

export function createAdminController({
  generator,
  elements,
  onExportSelected,
  onExportReport,
}) {
  const createStaff = httpsCallable(functions, "createStaffUser");
  const deleteStaff = httpsCallable(functions, "deleteStaffUser");
  let records = [];
  let staffUsers = [];
  let searchTerm = "";

  function getCreatedDateKey(record) {
    return (record.createdAt || "").slice(0, 10);
  }

  function getSelectedReportFilter() {
    const filterType = elements.reportFilterType?.value || "all";
    const selectedMonth = elements.reportMonthInput?.value || "";
    const selectedDay = elements.reportDayInput?.value || "";

    return {
      filterType,
      selectedMonth,
      selectedDay,
    };
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function toUserDocId(email) {
    return String(email || "").trim().toLowerCase();
  }

  function formatRoleLabel(role) {
    return normalizeRole(role) === "admin" ? "Admin" : "Staff";
  }

  function getPrintStatusMarkup(record) {
    if (record.printed) {
      const printedDate = record.printedAt
        ? generator.formatDisplayDate(record.printedAt.slice(0, 10))
        : "Recorded";
      const printedBy = record.printedByName || "Admin";

      return `
        <div class="inline-flex min-w-[172px] flex-col rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span class="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Printed</span>
          <span class="mt-1 text-xs font-medium text-emerald-700">${printedDate}</span>
          <span class="text-[11px] text-emerald-600">by ${printedBy}</span>
        </div>
      `;
    }

    return `
      <div class="inline-flex min-w-[172px] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <span class="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Pending Print</span>
      </div>
    `;
  }

  function getCreateStaffErrorMessage(error) {
    if (!error) {
      return "Unable to save staff user.";
    }

    if (error.code === "functions/unauthenticated") {
      return "Your admin session expired. Sign in again and retry.";
    }

    if (error.code === "functions/permission-denied") {
      return "Only admins can create staff users.";
    }

    if (error.code === "functions/already-exists") {
      return "This email is already registered.";
    }

    if (error.code === "functions/internal") {
      return "Backend staff creation failed. Check the deployed Cloud Function logs.";
    }

    if (error.code === "functions/not-found") {
      return "Backend staff creation is unavailable. Deploy Firebase Functions first.";
    }

    if (error.code === "functions/failed-precondition") {
      return "Backend staff creation is not ready yet. Complete Firebase setup and deploy again.";
    }

    return error.message || "Unable to save staff user.";
  }

  function getDeleteStaffErrorMessage(error) {
    if (!error) {
      return "Unable to delete staff user.";
    }

    if (error.code === "functions/permission-denied") {
      return "Only admins can delete staff users.";
    }

    if (error.code === "functions/not-found") {
      return "This staff account no longer exists.";
    }

    if (error.code === "functions/unauthenticated") {
      return "Your admin session expired. Sign in again and retry.";
    }

    return error.message || "Unable to delete staff user.";
  }

  function matchesSearch(record) {
    if (!searchTerm) {
      return true;
    }

    const needle = searchTerm.toLowerCase();
    return (
      record.name.toLowerCase().includes(needle) ||
      record.idNumber.toLowerCase().includes(needle) ||
      (record.createdByName || "").toLowerCase().includes(needle)
    );
  }

  function getFilteredRecords() {
    return records.filter(matchesSearch);
  }

  function getVisibleRecords() {
    return getReportRecords();
  }

  function getReportRecords() {
    const { filterType, selectedMonth, selectedDay } = getSelectedReportFilter();
    const filteredRecords = getFilteredRecords();

    if (filterType === "day") {
      if (!selectedDay) {
        return filteredRecords;
      }

      return filteredRecords.filter((record) => getCreatedDateKey(record) === selectedDay);
    }

    if (filterType === "month") {
      if (!selectedMonth) {
        return filteredRecords;
      }

      return filteredRecords.filter((record) => record.createdAt.startsWith(selectedMonth));
    }

    return filteredRecords;
  }

  function renderStaffTable() {
    if (!staffUsers.length) {
      elements.staffTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-400">
            No staff records found.
          </td>
        </tr>
      `;
      return;
    }

    elements.staffTableBody.innerHTML = staffUsers
      .map(
        (staffUser) => `
          <tr class="text-sm text-slate-700">
            <td class="px-4 py-3 font-semibold text-slate-900">${staffUser.name}</td>
            <td class="px-4 py-3">${staffUser.email}</td>
            <td class="px-4 py-3">${formatRoleLabel(staffUser.role)}</td>
            <td class="px-4 py-3">
              <button
                type="button"
                data-staff-id="${staffUser.docId}"
                class="delete-staff-btn rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                ${staffUser.isCurrentUser ? "disabled" : ""}
              >
                ${staffUser.isCurrentUser ? "Current User" : "Delete"}
              </button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderMonthlyReport() {
    const { filterType, selectedMonth, selectedDay } = getSelectedReportFilter();
    elements.totalIdsStat.textContent = String(records.length);
    elements.monthlyCount.textContent = String(getReportRecords().length);

    if (!elements.reportFilterHint) {
      return;
    }

    if (filterType === "day") {
      elements.reportFilterHint.textContent = selectedDay
        ? `Showing records created on ${generator.formatDisplayDate(selectedDay)}.`
        : "Choose a date to view day-wise report totals.";
      return;
    }

    if (filterType === "month") {
      elements.reportFilterHint.textContent = selectedMonth
        ? `Showing records created in ${selectedMonth}.`
        : "Choose a month to view month-wise report totals.";
      return;
    }

    elements.reportFilterHint.textContent = "Showing totals across all generated records.";
  }

  function updateReportFilterInputs() {
    const { filterType } = getSelectedReportFilter();
    const isMonth = filterType === "month";
    const isDay = filterType === "day";

    elements.reportMonthInput.disabled = !isMonth;
    elements.reportDayInput.disabled = !isDay;
    elements.reportMonthInput.classList.toggle("opacity-60", !isMonth);
    elements.reportDayInput.classList.toggle("opacity-60", !isDay);
  }

  function initializeReportFilters() {
    if (elements.reportFilterType) {
      elements.reportFilterType.value = "all";
    }

    if (elements.reportMonthInput) {
      elements.reportMonthInput.value = "";
    }

    if (elements.reportDayInput) {
      elements.reportDayInput.value = "";
    }
  }

  function renderTable() {
    const filtered = getVisibleRecords();
    elements.selectAllCheckbox.checked = false;

    if (!filtered.length) {
      elements.recordsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-8 text-center text-sm text-slate-400">
            No IDs match the current search or filter.
          </td>
        </tr>
      `;
      renderMonthlyReport();
      return;
    }

    elements.recordsTableBody.innerHTML = filtered
      .map(
        (record) => `
          <tr class="text-sm text-slate-700 transition hover:bg-slate-50/80 ${record.printed ? "bg-emerald-50/20" : "bg-white"}">
            <td class="px-4 py-4 align-middle">
              <input
                type="checkbox"
                data-id="${record.idNumber}"
                class="record-checkbox h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700"
              />
            </td>
            <td class="px-4 py-4 font-semibold text-slate-900">${record.name}</td>
            <td class="px-4 py-4 font-medium text-slate-700">${record.idNumber}</td>
            <td class="px-4 py-4 text-slate-600">${record.designation}</td>
            <td class="px-4 py-4 text-slate-600">${record.createdByName || "N/A"}</td>
            <td class="px-4 py-4 text-slate-600">${generator.formatDisplayDate(record.createdAt.slice(0, 10))}</td>
            <td class="px-4 py-4 align-middle">${getPrintStatusMarkup(record)}</td>
            <td class="px-4 py-4">
              <div class="flex flex-col gap-2 xl:flex-row xl:flex-wrap">
                <button
                  type="button"
                  data-action="toggle-print"
                  data-id="${record.idNumber}"
                  class="rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    record.printed
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }"
                >
                  ${record.printed ? "Printed Done" : "Mark Printed"}
                </button>
                <button
                  type="button"
                  data-action="export-record"
                  data-id="${record.idNumber}"
                  class="rounded-xl border border-navy-700 bg-navy-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800"
                >
                  Export Again
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    renderMonthlyReport();
  }

  function updateRecords(nextRecords) {
    records = nextRecords;
    renderTable();
  }

  function updateStaffUsers(nextStaffUsers) {
    staffUsers = nextStaffUsers;
    renderStaffTable();
  }

  function setSignaturePreview(signatureDataUrl) {
    if (signatureDataUrl) {
      elements.signaturePreview.src = signatureDataUrl;
      elements.signaturePreview.classList.remove("hidden");
      elements.signaturePlaceholder.classList.add("hidden");
      return;
    }

    elements.signaturePreview.removeAttribute("src");
    elements.signaturePreview.classList.add("hidden");
    elements.signaturePlaceholder.classList.remove("hidden");
  }

  function populateSettings() {
    const settings = generator.getSettings();
    elements.prefixInput.value = settings.prefix;
    elements.startingNumberInput.value = String(settings.startingNumber);
    setSignaturePreview(settings.signature);
  }

  function getSelectedRecords() {
    const selectedIds = [...document.querySelectorAll(".record-checkbox:checked")].map((checkbox) => checkbox.dataset.id);
    return records.filter((record) => selectedIds.includes(record.idNumber));
  }

  function getRecordById(idNumber) {
    return records.find((record) => record.idNumber === idNumber) || null;
  }

  function normalizeRecord(docId, source) {
    const createdAtValue = source.createdAt?.toDate ? source.createdAt.toDate() : source.createdAt;
    const createdAt = createdAtValue ? new Date(createdAtValue).toISOString() : new Date().toISOString();
    const signature = generator.getSettings().signature;

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
      signature,
      createdAt,
      printed: Boolean(source.printed),
      printedAt: source.printedAt || "",
      printedByName: source.printedByName || "",
    };
  }

  async function updatePrintStatus(idNumber, printed) {
    const record = getRecordById(idNumber);

    if (!record?.docId) {
      throw new Error("Record not found.");
    }

    const sessionUser = getSessionUser();
    const printedByName = sessionUser?.name || auth.currentUser?.email || "Admin";
    const nextPayload = printed
      ? {
          printed: true,
          printedAt: new Date().toISOString(),
          printedByName,
        }
      : {
          printed: false,
          printedAt: "",
          printedByName: "",
        };

    await setDoc(doc(db, "idCards", record.docId), nextPayload, { merge: true });

    updateRecords(
      records.map((currentRecord) =>
        currentRecord.idNumber === idNumber
          ? {
              ...currentRecord,
              ...nextPayload,
            }
          : currentRecord,
      ),
    );
  }

  function normalizeStaffUser(docId, source) {
    const sessionUser = getSessionUser();
    const currentUserEmail = auth.currentUser?.email || "";
    const sourceEmail = source.email || "";

    return {
      docId,
      name: source.name || "User",
      email: sourceEmail || docId,
      role: normalizeRole(source.role || "staff"),
      isCurrentUser:
        sessionUser?.uid === docId ||
        toUserDocId(currentUserEmail) === docId ||
        toUserDocId(sourceEmail) === toUserDocId(currentUserEmail),
    };
  }

  function sortRecordsByCreatedAtDesc(recordsToSort) {
    return [...recordsToSort].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }

  async function refreshRecords() {
    let snapshot;

    try {
      const recordsQuery = query(collection(db, "idCards"), orderBy("createdAt", "desc"));
      snapshot = await getDocs(recordsQuery);
    } catch (error) {
      console.warn("Ordered admin fetch failed, retrying without orderBy:", error);
      snapshot = await getDocs(collection(db, "idCards"));
    }

    const nextRecords = [];
    snapshot.forEach((doc) => {
      nextRecords.push(normalizeRecord(doc.id, doc.data()));
    });

    const sortedRecords = sortRecordsByCreatedAtDesc(nextRecords);
    updateRecords(sortedRecords);
    return sortedRecords;
  }

  async function refreshStaffUsers() {
    let snapshot;

    try {
      snapshot = await getDocs(query(collection(db, "users"), orderBy("name", "asc")));
    } catch (error) {
      console.warn("Ordered users fetch failed, retrying without orderBy:", error);
      snapshot = await getDocs(collection(db, "users"));
    }

    const nextStaffUsers = [];
    snapshot.forEach((staffDoc) => {
      nextStaffUsers.push(normalizeStaffUser(staffDoc.id, staffDoc.data()));
    });

    nextStaffUsers.sort((left, right) => left.name.localeCompare(right.name));
    updateStaffUsers(nextStaffUsers);
    return nextStaffUsers;
  }

  async function createStaffUser() {
    const name = elements.staffNameInput.value.trim();
    const email = elements.staffEmailInput.value.trim().toLowerCase();
    const password = elements.staffPasswordInput.value;
    const role = normalizeRole(elements.staffRoleInput.value);

    if (!name || !email || !password || !role) {
      generator.showToast("Name, email, password, and role are required.", "error");
      return;
    }

    if (!isValidEmail(email)) {
      generator.showToast("Enter a valid email address for the staff user.", "error");
      return;
    }

    if (password.length < 6) {
      generator.showToast("Password must be at least 6 characters long.", "error");
      return;
    }

    elements.addStaffBtn.disabled = true;
    elements.addStaffBtn.textContent = "Saving...";

    try {
      try {
        const result = await createStaff({
          name,
          email,
          password,
          role,
        });

        if (!result.data?.success) {
          throw new Error(result.data?.message || "Staff creation failed.");
        }

        generator.showToast(`Staff user saved for ${name}.`, "success");
      } catch (error) {
        throw error;
      }

      elements.staffForm.reset();
      elements.staffRoleInput.value = "staff";
      await refreshStaffUsers();
    } finally {
      elements.addStaffBtn.disabled = false;
      elements.addStaffBtn.textContent = "Add Staff";
    }
  }

  async function removeStaffUser(docId) {
    const sessionUser = getSessionUser();

    if (!docId) {
      return;
    }

    if (
      sessionUser?.uid === docId ||
      toUserDocId(auth.currentUser?.email || "") === docId
    ) {
      generator.showToast("You cannot delete the currently signed-in admin.", "error");
      return;
    }

    const result = await deleteStaff({ uid: docId });

    if (!result.data?.success) {
      throw new Error(result.data?.message || "Unable to delete staff user.");
    }

    generator.showToast("Staff user deleted.", "success");
    await refreshStaffUsers();
  }

  async function refreshDashboardData() {
    await Promise.all([refreshRecords(), refreshStaffUsers()]);
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim();
      renderTable();
    });

    elements.reportFilterType.addEventListener("change", () => {
      updateReportFilterInputs();
      renderTable();
    });

    elements.reportMonthInput.addEventListener("change", renderTable);
    elements.reportDayInput.addEventListener("change", renderTable);

    elements.saveSettingsBtn.addEventListener("click", () => {
      const savedSettings = generator.saveNumberingSettings({
        prefix: elements.prefixInput.value,
        startingNumber: elements.startingNumberInput.value,
      });
      elements.prefixInput.value = savedSettings.prefix;
      elements.startingNumberInput.value = String(savedSettings.startingNumber);
      generator.showToast("Prefix and starting number updated.", "success");
    });

    elements.signatureInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      generator.handleSignatureUpload(file);
      event.target.value = "";
    });

    elements.selectAllCheckbox.addEventListener("change", (event) => {
      document.querySelectorAll(".record-checkbox").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });
    });

    elements.exportSelectedBtn.addEventListener("click", () => {
      const selectedRecords = getSelectedRecords();
      onExportSelected(selectedRecords);
    });

    elements.exportReportBtn.addEventListener("click", () => {
      const reportRecords = getReportRecords();
      const { filterType, selectedMonth, selectedDay } = getSelectedReportFilter();
      const reportScopeLabel =
        filterType === "day" && selectedDay
          ? `Report Day: ${generator.formatDisplayDate(selectedDay)}`
          : filterType === "month" && selectedMonth
            ? `Report Month: ${selectedMonth}`
            : "Report Scope: All Records";

      onExportReport(reportRecords, {
        reportMonth: selectedMonth,
        reportDay: selectedDay,
        reportScopeLabel,
      });
    });

    elements.recordsTableBody.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("button[data-action]");

      if (!actionButton) {
        return;
      }

      const record = getRecordById(actionButton.dataset.id);

      if (!record) {
        return;
      }

      if (actionButton.dataset.action === "export-record") {
        try {
          await onExportSelected([record]);
        } catch (error) {
          console.error("Single record export failed:", error);
          generator.showToast(error.message || "Unable to export this record.", "error");
        }
        return;
      }

      if (actionButton.dataset.action === "toggle-print") {
        try {
          await updatePrintStatus(record.idNumber, !record.printed);
          generator.showToast(
            record.printed ? "Print reminder removed." : "Marked as printed.",
            "success",
          );
        } catch (error) {
          console.error("Unable to update print status:", error);
          generator.showToast(error.message || "Unable to update print status.", "error");
        }
      }
    });

    elements.staffForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await createStaffUser();
      } catch (error) {
        console.error("Failed to save staff user:", error);
        generator.showToast(getCreateStaffErrorMessage(error), "error");
      }
    });

    elements.staffTableBody.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest(".delete-staff-btn");

      if (!deleteButton || deleteButton.disabled) {
        return;
      }

      if (!window.confirm("Delete this staff account? This removes both Auth and Firestore access.")) {
        return;
      }

      try {
        await removeStaffUser(deleteButton.dataset.staffId);
      } catch (error) {
        console.error("Failed to delete staff user:", error);
        generator.showToast(getDeleteStaffErrorMessage(error), "error");
      }
    });
  }

  initializeReportFilters();
  populateSettings();
  updateReportFilterInputs();
  renderMonthlyReport();
  bindEvents();

  return {
    updateRecords,
    setSignaturePreview,
    renderTable,
    populateSettings,
    refreshRecords,
    refreshStaffUsers,
    refreshDashboardData,
    getReportRecords,
  };
}
