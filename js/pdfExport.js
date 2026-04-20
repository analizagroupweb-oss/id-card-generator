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
          displayValue: true,
          fontSize: 11,
          height: 40,
          margin: 0,
          width: 1.15,
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

    pdf.save(`id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    pdfSheetElement.classList.add("hidden");
    pdfSheetElement.innerHTML = "";
  }
}
