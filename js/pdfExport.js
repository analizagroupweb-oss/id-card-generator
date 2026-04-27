const PDF_PAGE_WIDTH_MM = 54;
const PDF_PAGE_HEIGHT_MM = 86;

function createPdfCardMarkup(record) {
  const photoHtml = record.photo
    ? `<img src="${record.photo}" alt="ID Photo" class="h-full w-full object-cover" />`
    : `<div class="card-photo-placeholder">PHOTO</div>`;

  const signatureHtml = record.signature
    ? `<img src="${record.signature}" alt="Signature" class="h-10 object-contain" />`
    : `<div class="card-signature-placeholder">Authorized Signature</div>`;

  return `
    <div class="pdf-record-export">
      <section class="pdf-export-page" data-side="front">
        <article class="id-card card-face card-front pdf-export-card">
        <div class="card-front-shell">
          <div class="card-header-wave"></div>
          <div class="card-bottom-wave"></div>
          <p class="card-company-name">COMPANY NAME</p>
          <p class="card-company-tagline">TAGLINE GOES HERE</p>
          <div class="card-photo-wrap">
            <div class="card-photo-ring">${photoHtml}</div>
          </div>
          <div class="card-front-body">
            <p class="card-name">${record.name}</p>
            <p class="card-designation">${record.designation}</p>
            <div class="card-front-meta">
              <div class="card-meta-row"><span>ID NO</span><strong>${record.idNumber}</strong></div>
              <div class="card-meta-row"><span>DOB</span><strong>${formatDisplayDate(record.dob)}</strong></div>
              <div class="card-meta-row"><span>ISSUE</span><strong>${formatDisplayDate(record.issueDate)}</strong></div>
              <div class="card-meta-row"><span>VALID</span><strong>${formatDisplayDate(record.validUpto)}</strong></div>
            </div>
            <div class="card-barcode-wrap"><svg class="pdf-barcode" data-value="${record.idNumber}"></svg></div>
          </div>
        </div>
        </article>
      </section>
      <section class="pdf-export-page" data-side="back">
        <article class="id-card card-face pdf-export-card">
        <div class="card-back-shell">
          <div class="card-back-top"></div>
          <div class="card-back-bottom"></div>
          <div class="card-back-body">
            <p class="card-back-title">Terms &amp; Condition</p>
            <ul class="card-terms">
              <li>This card is the property of the issuing company and must be carried during duty hours.</li>
              <li>Loss of this card should be reported immediately to the administration team.</li>
              <li>Unauthorized use, tampering, or transfer of the card is prohibited.</li>
            </ul>
            <div class="card-back-grid">
              <div>
                <p class="card-back-label">CONTACT</p>
                <p class="card-back-value">${record.contactNumber}</p>
              </div>
              <div>
                <p class="card-back-label">BLOOD GROUP</p>
                <p class="card-back-value">${record.bloodGroup}</p>
              </div>
            </div>
            <div class="card-back-grid card-back-dates">
              <div>
                <p class="card-back-label">JOIN DATE</p>
                <p class="card-back-value">${formatDisplayDate(record.issueDate)}</p>
              </div>
              <div>
                <p class="card-back-label">EXPIRY DATE</p>
                <p class="card-back-value">${formatDisplayDate(record.validUpto)}</p>
              </div>
            </div>
            <div class="card-signature-block">
              ${signatureHtml}
              <p class="card-sign-line"></p>
              <p class="card-sign-label">Your Signature</p>
            </div>
            <div class="card-back-company">
              <p class="card-company-name">COMPANY NAME</p>
              <p class="card-company-tagline">TAGLINE GOES HERE</p>
            </div>
          </div>
        </div>
        </article>
      </section>
    </div>
  `;
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

function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  const pendingImages = images.filter((image) => !image.complete);

  if (!pendingImages.length) {
    return Promise.resolve();
  }

  return Promise.all(
    pendingImages.map(
      (image) =>
        new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRecordsPdfFilename(records) {
  const exportDate = new Date().toISOString().slice(0, 10);

  if (records.length === 1) {
    const [record] = records;
    const preferredLabel = sanitizeFilenamePart(record.name) || sanitizeFilenamePart(record.idNumber) || "id-card";
    return `${preferredLabel}.pdf`;
  }

  return `id-cards-${records.length}-${exportDate}.pdf`;
}

export async function exportRecordsToPdf(records, pdfSheetElement) {
  if (!records.length) {
    throw new Error("No records selected for export.");
  }

  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    throw new Error("PDF libraries are not available.");
  }

  pdfSheetElement.classList.remove("hidden");
  pdfSheetElement.innerHTML = records.map(createPdfCardMarkup).join("");

  try {
    if (window.JsBarcode) {
      pdfSheetElement.querySelectorAll(".pdf-barcode").forEach((svg) => {
        window.JsBarcode(svg, svg.dataset.value, {
          format: "CODE128",
          displayValue: false,
          height: 22,
          margin: 0,
          width: 0.9,
          background: "#ffffff",
          lineColor: "#0f172a",
        });
      });
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      unit: "mm",
      format: [PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM],
    });

    const pageNodes = Array.from(pdfSheetElement.querySelectorAll(".pdf-export-page"));
    await waitForImages(pdfSheetElement);

    for (const [index, pageNode] of pageNodes.entries()) {
      const canvas = await window.html2canvas(pageNode, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imageData = canvas.toDataURL("image/png");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (index > 0) {
        pdf.addPage([PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM]);
      }

      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, pageHeight);
    }

    pdf.save(getRecordsPdfFilename(records));
  } finally {
    pdfSheetElement.classList.add("hidden");
    pdfSheetElement.innerHTML = "";
  }
}

function formatReportDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  return new Date(dateValue).toLocaleDateString("en-GB");
}

function getRecordStatus(record) {
  return new Date(record.validUpto) < new Date() ? "Expired" : "Active";
}

function resolveAutoTable(doc) {
  if (typeof doc.autoTable === "function") {
    return doc.autoTable.bind(doc);
  }

  const jsPdfApiAutoTable = window.jspdf?.jsPDF?.API?.autoTable;
  if (typeof jsPdfApiAutoTable === "function") {
    return (...args) => jsPdfApiAutoTable.apply(doc, args);
  }

  if (typeof window.autoTable === "function") {
    return (...args) => window.autoTable(doc, ...args);
  }

  return null;
}

export function exportReportPdf(records, { reportMonth = "", reportDay = "", reportScopeLabel = "" } = {}) {
  if (!records.length) {
    throw new Error("No records available for report export.");
  }

  if (!window.jspdf?.jsPDF) {
    throw new Error("Report PDF libraries are not available.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const autoTable = resolveAutoTable(doc);

  if (!autoTable) {
    throw new Error("Report PDF table library is not available.");
  }

  const total = records.length;
  const active = records.filter((record) => getRecordStatus(record) === "Active").length;
  const expired = total - active;
  const generatedOn = new Date().toLocaleDateString("en-GB");
  const reportScope = reportScopeLabel || (
    reportDay
      ? `Report Day: ${formatReportDate(reportDay)}`
      : reportMonth
        ? `Report Month: ${formatReportDate(`${reportMonth}-01`)}`
        : "Report Scope: All Records"
  );

  const tableData = records.map((record) => [
    record.name || "",
    record.idNumber || "",
    record.designation || "",
    formatReportDate(record.issueDate),
    formatReportDate(record.validUpto),
    record.createdByName || "",
    getRecordStatus(record),
  ]);

  doc.setFontSize(16);
  doc.text("ID Card Generation Report", 14, 15);

  doc.setFontSize(10);
  doc.text(`Generated on: ${generatedOn}`, 14, 22);
  doc.text(reportScope, 14, 28);

  doc.text(`Total IDs: ${total}`, 14, 36);
  doc.text(`Active: ${active} | Expired: ${expired}`, 14, 42);

  autoTable({
    startY: 48,
    head: [[
      "Name",
      "ID No",
      "Designation",
      "Issue Date",
      "Valid Upto",
      "Created By",
      "Status",
    ]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: {
      top: 14,
      right: 14,
      bottom: 14,
      left: 14,
    },
  });

  const suffix = reportDay || reportMonth || new Date().toISOString().slice(0, 10);
  doc.save(`id-report-${suffix}.pdf`);
}
