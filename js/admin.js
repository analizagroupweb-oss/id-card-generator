export function createAdminController({
  generator,
  elements,
  onExportSelected,
}) {
  let records = [];
  let searchTerm = "";

  function matchesSearch(record) {
    if (!searchTerm) {
      return true;
    }

    const needle = searchTerm.toLowerCase();
    return (
      record.name.toLowerCase().includes(needle) ||
      record.idNumber.toLowerCase().includes(needle)
    );
  }

  function getFilteredRecords() {
    return records.filter(matchesSearch);
  }

  function renderMonthlyReport() {
    const selectedMonth = elements.reportMonthInput.value;
    elements.totalIdsStat.textContent = String(records.length);

    if (!selectedMonth) {
      elements.monthlyCount.textContent = String(records.length);
      return;
    }

    const count = records.filter((record) => record.createdAt.startsWith(selectedMonth)).length;
    elements.monthlyCount.textContent = String(count);
  }

  function renderTable() {
    const filtered = getFilteredRecords();
    elements.selectAllCheckbox.checked = false;

    if (!filtered.length) {
      elements.recordsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-400">
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
          <tr class="text-sm text-slate-700">
            <td class="px-4 py-3 align-middle">
              <input
                type="checkbox"
                data-id="${record.idNumber}"
                class="record-checkbox h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-700"
              />
            </td>
            <td class="px-4 py-3 font-semibold text-slate-900">${record.name}</td>
            <td class="px-4 py-3">${record.idNumber}</td>
            <td class="px-4 py-3">${record.designation}</td>
            <td class="px-4 py-3">${generator.formatDisplayDate(record.createdAt.slice(0, 10))}</td>
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

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim();
      renderTable();
    });

    elements.reportMonthInput.addEventListener("change", renderMonthlyReport);

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
  }

  populateSettings();
  bindEvents();

  return {
    updateRecords,
    setSignaturePreview,
    renderTable,
    populateSettings,
  };
}
