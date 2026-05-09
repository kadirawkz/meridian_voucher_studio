import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { getTemplatePath, resolveVoucherOutputDirectory } from "../config.js";
import type { DocumentFormat, GeneratedDocument, VoucherPayload } from "../../shared/types.js";

const docxtemplaterTagPattern = /{[#/A-Za-z][^}]*}/;
const supportedTemplateTags = new Set([
  "voucherTypeLabel",
  "pageNumber",
  "page_number",
  "date",
  "hotelName",
  "HotelName",
  "Hotel_name",
  "requisitionNo",
  "requisition_no",
  "tourNo",
  "tour-no",
  "tourName",
  "tour_name",
  "customerName",
  "Customer",
  "confirmedBy",
  "rateApplicable",
  "rateApplicableText",
  "employeeName",
  "EmployeeName",
  "Employee_name",
  "employeeEmail",
  "employeeMail",
  "remarks",
  "reamrks",
  "Billing_instructions.",
  "BillingInstructions.",
  "billingInstructions",
  "generatedAt",
  "totalRooms",
  "isReservation",
  "isAmendment",
  "isPptp",
  "lineItems",
  "requiredDate",
  "RequiredDate",
  "required_date",
  "requiredDateDisplay",
  "roomCategory",
  "RoomCategory",
  "room-category",
  "basis",
  "singleRooms",
  "sgl",
  "doubleRooms",
  "dbl",
  "twinRooms",
  "twin",
  "tripleRooms",
  "tpl",
  "guide",
  "Guide",
  "guid",
  "guideBasis",
  "GuideBasis",
  "guide_basis",
  "guide-basis",
  "guideorDriver",
  "guideOrDriver",
  "GuideOrDriver",
  "guideWithBasis",
  "arrivingFor",
  "ArrivingFor",
  "arriving_for"
]);

function normalizeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function escapeXml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDisplayDate(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
    .format(date)
    .replace(/ /g, "-");
}

function voucherTitle(voucher: VoucherPayload): string {
  if (voucher.voucherType === "amendment") {
    return "Amendment Voucher";
  }

  if (voucher.voucherType === "pptp") {
    return "PPTP Voucher";
  }

  return "Hotel Reservation Voucher";
}

function replaceTextNode(xml: string, search: string, replacement: string): string {
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.replace(new RegExp(`(<w:t(?: [^>]*)?>)${escapedSearch}(</w:t>)`, "u"), `$1${escapeXml(replacement)}$2`);
}

function replaceTextNodeOccurrences(xml: string, search: string, replacements: string[]): string {
  let index = 0;
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return xml.replace(new RegExp(`(<w:t(?: [^>]*)?>)${escapedSearch}(</w:t>)`, "gu"), (match, open, close) => {
    if (index >= replacements.length) {
      return match;
    }

    const replacement = replacements[index];
    index += 1;
    return `${open}${escapeXml(replacement)}${close}`;
  });
}

function insertValueAfterLabel(xml: string, label: string, value: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<w:t(?: [^>]*)?>${escapedLabel}</w:t>[\\s\\S]*?<w:t(?: [^>]*)?>:\\s*)(</w:t>)`, "u");

  return xml.replace(pattern, (_match, before, after) => `${before}${escapeXml(value)}${after}`);
}

function renderLegacyStaticTemplate(zip: PizZip, voucher: VoucherPayload): void {
  const document = zip.file("word/document.xml");
  const originalXml = document?.asText();

  if (!originalXml) {
    throw new Error("Template is missing word/document.xml");
  }

  const rows = voucher.lineItems.slice(0, 2);
  const rowOne = rows[0];
  const rowTwo = rows[1];

  let xml = originalXml;
  xml = replaceTextNode(xml, "Hotel Reservation Voucher", voucherTitle(voucher));
  xml = replaceTextNode(xml, "Hotel name", voucher.hotelName);
  xml = insertValueAfterLabel(xml, "Requisition No", voucher.requisitionNo);
  xml = insertValueAfterLabel(xml, "Tour No", voucher.tourNo);
  xml = insertValueAfterLabel(xml, "Tour Name", voucher.tourName);
  xml = insertValueAfterLabel(xml, "Customer", voucher.customerName);

  xml = replaceTextNodeOccurrences(xml, "13-Feb-2026", [formatDisplayDate(rowOne?.requiredDate ?? "")]);
  xml = replaceTextNodeOccurrences(xml, "14-Feb-2026", [formatDisplayDate(rowTwo?.requiredDate ?? "")]);
  xml = replaceTextNodeOccurrences(xml, "BB", [rowOne?.basis ?? "", rowTwo?.basis ?? ""]);
  xml = replaceTextNodeOccurrences(xml, "6", [String(rowOne?.singleRooms ?? ""), String(rowTwo?.singleRooms ?? "")]);
  xml = replaceTextNodeOccurrences(xml, "4", [String(rowOne?.twinRooms ?? ""), String(rowTwo?.twinRooms ?? "")]);
  xml = replaceTextNodeOccurrences(xml, "1 (HB)", [String(rowOne?.guide ?? ""), String(rowTwo?.guide ?? "")]);
  xml = replaceTextNode(xml, "Employee name", voucher.employeeName);
  xml = replaceTextNode(xml, "employeename@merid.com", voucher.employeeEmail);

  const rateDetails = [
    `Confirmed By: ${voucher.confirmedBy}`,
    `Rate Applicable: ${voucher.rateApplicableText || (voucher.rateApplicable != null ? String(voucher.rateApplicable) : "")}`,
    voucher.remarks ? `Remarks: ${voucher.remarks}` : "Remarks:",
    "Please reserve and confirm the above arrangements."
  ].join("\n");

  xml = xml.replace(/Confirmed By:\s*[\s\S]*?Please reserve and confirm the above arrangements\./u, escapeXml(rateDetails));

  zip.file("word/document.xml", xml);
}

function buildTemplateData(voucher: VoucherPayload): Record<string, unknown> {
  const totalRooms = voucher.lineItems.reduce(
    (total, item) => total + item.singleRooms + item.doubleRooms + item.twinRooms + item.tripleRooms,
    0
  );
  const firstLineItem = voucher.lineItems[0];
  const billingInstructions =
    voucher.billingInstructions?.trim() ||
    "All payments will be made based on the room categories provided above.\n" +
      "All extras to be collected directly from the client.\n" +
      "Please forward the Tax Invoice addressed to Meridian (Pvt) Ltd along with the signed off voucher.";

  const lineItems = voucher.lineItems.map((item) => ({
    ...item,
    RequiredDate: item.requiredDate,
    requiredDateDisplay: formatDisplayDate(item.requiredDate),
    required_date: formatDisplayDate(item.requiredDate),
    RoomCategory: item.roomCategory,
    "room-category": item.roomCategory,
    sgl: item.singleRooms,
    dbl: item.doubleRooms,
    twin: item.twinRooms,
    tpl: item.tripleRooms,
    Guide: item.guide,
    guid: item.guide,
    GuideBasis: item.guideBasis,
    guideBasis: item.guideBasis,
    guide_basis: item.guideBasis,
    "guide-basis": item.guideBasis,
    guideWithBasis: [item.guide, item.guideBasis ? `(${item.guideBasis})` : ""].filter(Boolean).join(" "),
    ArrivingFor: item.arrivingFor,
    arriving_for: item.arrivingFor
  }));

  const resolvedRateApplicable =
    voucher.rateApplicableText?.trim() ||
    (voucher.rateApplicable != null ? String(voucher.rateApplicable) : "");

  return {
    ...voucher,
    voucherTypeLabel: voucher.voucherType.replace(/^\w/, (letter) => letter.toUpperCase()),
    page_number: voucher.pageNumber,
    Hotel_name: voucher.hotelName,
    HotelName: voucher.hotelName,
    requisition_no: voucher.requisitionNo,
    "tour-no": voucher.tourNo,
    tour_name: voucher.tourName,
    Customer: voucher.customerName,
    Employee_name: voucher.employeeName,
    EmployeeName: voucher.employeeName,
    employeeMail: voucher.employeeEmail,
    reamrks: voucher.remarks,
    billingInstructions,
    "Billing_instructions.": billingInstructions,
    "BillingInstructions.": billingInstructions,
    RequiredDate: firstLineItem?.requiredDate ?? "",
    required_date: firstLineItem ? formatDisplayDate(firstLineItem.requiredDate) : "",
    RoomCategory: firstLineItem?.roomCategory ?? "",
    "room-category": firstLineItem?.roomCategory ?? "",
    basis: firstLineItem?.basis ?? "",
    sgl: firstLineItem?.singleRooms ?? "",
    dbl: firstLineItem?.doubleRooms ?? "",
    twin: firstLineItem?.twinRooms ?? "",
    tpl: firstLineItem?.tripleRooms ?? "",
    Guide: firstLineItem?.guide ?? "",
    guid: firstLineItem?.guide ?? "",
    GuideBasis: firstLineItem?.guideBasis ?? "",
    guideBasis: firstLineItem?.guideBasis ?? "",
    guide_basis: firstLineItem?.guideBasis ?? "",
    "guide-basis": firstLineItem?.guideBasis ?? "",
    guideorDriver: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    guideOrDriver: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    GuideOrDriver: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    guideWithBasis: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    ArrivingFor: firstLineItem?.arrivingFor ?? "",
    arriving_for: firstLineItem?.arrivingFor ?? "",
    isReservation: voucher.voucherType === "reservation",
    isAmendment: voucher.voucherType === "amendment",
    isPptp: voucher.voucherType === "pptp",
    generatedAt: new Date().toLocaleString(),
    totalRooms,
    totalPax: voucher.totalPax ?? 0,
    market: voucher.market ?? "",
    rateApplicable: resolvedRateApplicable,
    rateApplicableText: voucher.rateApplicableText ?? "",
    guideDriverText: voucher.guideDriverText ?? "",
    surchargeText: voucher.surchargeText ?? "",
    eventSupplementText: voucher.eventSupplementText ?? "",
    cancellationText: voucher.cancellationText ?? "",
    autoTextNotes: voucher.autoTextNotes ?? "",
    manuallyEdited: voucher.manuallyEdited ?? false,
    lineItems
  };
}

function extractSupportedDocxtemplaterTags(xml: string): string[] {
  const text = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t[^>]*>/g, "")
    .replace(/<[^>]+>/g, "");

  return [...text.matchAll(/\{([^{}]+)\}/gu)]
    .map((match) => match[1].trim())
    .filter((tag) => !/^[0-9A-F-]{36}$/iu.test(tag));
}

function assertTemplateTagsAreUsable(xml: string): void {
  const tags = extractSupportedDocxtemplaterTags(xml);

  if (tags.length === 0) {
    return;
  }

  const unsupportedTags = tags
    .map((tag) => tag.replace(/^#|^\//, ""))
    .filter((tag) => !supportedTemplateTags.has(tag));

  if (unsupportedTags.length > 0) {
    const uniqueTags = [...new Set(unsupportedTags)];
    const previewTags = uniqueTags.slice(0, 8).join(", ");
    const extraCount = uniqueTags.length > 8 ? `, and ${uniqueTags.length - 8} more` : "";

    throw new Error(
      `Voucher template has unsupported tags: ${previewTags}${extraCount}. ` +
        "Replace sample-value tags with field-name tags, for example {hotelName}, {requisitionNo}, {tourNo}, {tourName}, {customerName}, " +
        "and table loop tags {#lineItems}...{/lineItems}."
    );
  }
}

async function convertDocxToPdf(docxPath: string, outputDirectory: string): Promise<string | undefined> {
  const libreOfficePath = process.env.LIBREOFFICE_PATH || "soffice";

  return new Promise((resolve) => {
    const child = spawn(libreOfficePath, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDirectory,
      docxPath
    ]);

    child.on("error", () => resolve(undefined));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(undefined);
        return;
      }

      resolve(path.join(outputDirectory, `${path.basename(docxPath, ".docx")}.pdf`));
    });
  });
}

export async function generateDocuments(voucher: VoucherPayload, format: DocumentFormat = "pdf"): Promise<GeneratedDocument> {
  const templatePath = getTemplatePath();
  const outputDirectory = resolveVoucherOutputDirectory(voucher.tourType || "", voucher.hotelName || "");
  await fs.mkdir(outputDirectory, { recursive: true });

  const template = await fs.readFile(templatePath);
  const zip = new PizZip(template);
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";

  if (docxtemplaterTagPattern.test(documentXml)) {
    assertTemplateTagsAreUsable(documentXml);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    doc.render(buildTemplateData(voucher));
  } else {
    renderLegacyStaticTemplate(zip, voucher);
  }

  const fileBase = [
    voucher.date,
    voucher.voucherType,
    voucher.requisitionNo,
    normalizeFileName(voucher.hotelName)
  ]
    .filter(Boolean)
    .join("-");

  const docxPath = path.join(outputDirectory, `${fileBase}.docx`);
  await fs.writeFile(docxPath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

  const pdfPath = format === "pdf" ? await convertDocxToPdf(docxPath, outputDirectory) : undefined;

  if (format === "pdf" && !pdfPath) {
    throw new Error("PDF conversion failed. Check that LibreOffice is installed and LIBREOFFICE_PATH points to soffice.");
  }

  return {
    docxPath,
    pdfPath
  };
}
