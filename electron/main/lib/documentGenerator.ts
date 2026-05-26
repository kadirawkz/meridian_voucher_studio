import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
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
  "guideText",
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
  "guideOnly",
  "GuideOnly",
  "guideWithBasis",
  "arrivingFor",
  "ArrivingFor",
  "arriving_for",
  "child2_5Sharing", "c25s",
  "child2_5Bed", "c25b",
  "child2_5OwnRoom", "c25i",
  "child6_11Sharing", "c611s",
  "child6_11Bed", "c611b",
  "child6_11OwnRoom", "c611i",
  "totalPax", "total_pax", "market",
  "surchargeText", "eventSupplementText", "manuallyEdited",
  "guideorDriver", "child", "roomCategor"
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
  const getGuideStr = (row: typeof rowOne) => row?.guide ? `${row.guide} ${row.guideBasis || ""}`.trim() : "";
  xml = replaceTextNodeOccurrences(xml, "1 (HB)", [getGuideStr(rowOne), getGuideStr(rowTwo)]);
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
    voucher.billingInstructions?.trim() || "";

  const totalChildren = voucher.lineItems.reduce(
    (total, item) => total + (item.child2_5Sharing || 0) + (item.child2_5Bed || 0) + (item.child2_5OwnRoom || 0) + 
                             (item.child6_11Sharing || 0) + (item.child6_11Bed || 0) + (item.child6_11OwnRoom || 0),
    0
  );

  const lineItems = voucher.lineItems.map((item) => ({
    ...item,
    RequiredDate: item.requiredDate,
    requiredDateDisplay: formatDisplayDate(item.requiredDate),
    required_date: formatDisplayDate(item.requiredDate),
    RoomCategory: item.roomCategory,
    "room-category": item.roomCategory,
    roomCategor: item.roomCategory,
    sgl: item.singleRooms || "",
    dbl: item.doubleRooms || "",
    twin: item.twinRooms || "",
    tpl: item.tripleRooms || "",
    Guide: item.guide || "",
    guid: item.guide || "",
    GuideBasis: item.guideBasis,
    guideBasis: item.guideBasis,
    guide_basis: item.guideBasis,
    "guide-basis": item.guideBasis,
    guideWithBasis: [item.guide, item.guideBasis ? `(${item.guideBasis})` : ""].filter(Boolean).join(" "),
    ArrivingFor: item.arrivingFor,
    arriving_for: item.arrivingFor,
    child2_5Sharing: item.child2_5Sharing || "",
    c25s: item.child2_5Sharing || "",
    child2_5Bed: item.child2_5Bed || "",
    c25b: item.child2_5Bed || "",
    child2_5OwnRoom: item.child2_5OwnRoom || "",
    c25i: item.child2_5OwnRoom || "",
    child6_11Sharing: item.child6_11Sharing || "",
    c611s: item.child6_11Sharing || "",
    child6_11Bed: item.child6_11Bed || "",
    c611b: item.child6_11Bed || "",
    child6_11OwnRoom: item.child6_11OwnRoom || "",
    c611i: item.child6_11OwnRoom || "",
    guideorDriver: item.guide || "",
    child: ((item.child2_5Sharing || 0) + (item.child2_5Bed || 0) + (item.child2_5OwnRoom || 0) + 
           (item.child6_11Sharing || 0) + (item.child6_11Bed || 0) + (item.child6_11OwnRoom || 0)) || ""
  }));

  const resolvedRateApplicable =
    voucher.rateApplicableText?.trim() ||
    (voucher.rateApplicable != null ? String(voucher.rateApplicable) : "");

  return {
    ...voucher,
    voucherTypeLabel: voucherTitle(voucher),
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
    roomCategor: firstLineItem?.roomCategory ?? "",
    basis: firstLineItem?.basis ?? "",
    sgl: firstLineItem?.singleRooms || "",
    dbl: firstLineItem?.doubleRooms || "",
    twin: firstLineItem?.twinRooms || "",
    tpl: firstLineItem?.tripleRooms || "",
    Guide: firstLineItem?.guide || "",
    guid: firstLineItem?.guide || "",
    GuideBasis: firstLineItem?.guideBasis ?? "",
    guideBasis: firstLineItem?.guideBasis ?? "",
    guide_basis: firstLineItem?.guideBasis ?? "",
    "guide-basis": firstLineItem?.guideBasis ?? "",
    guideOnly: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    GuideOnly: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    guideWithBasis: firstLineItem
      ? [firstLineItem.guide, firstLineItem.guideBasis ? `(${firstLineItem.guideBasis})` : ""].filter(Boolean).join(" ")
      : "",
    ArrivingFor: firstLineItem?.arrivingFor ?? "",
    arriving_for: firstLineItem?.arrivingFor ?? "",
    child2_5Sharing: firstLineItem?.child2_5Sharing || "",
    c25s: firstLineItem?.child2_5Sharing || "",
    child2_5Bed: firstLineItem?.child2_5Bed || "",
    c25b: firstLineItem?.child2_5Bed || "",
    child2_5OwnRoom: firstLineItem?.child2_5OwnRoom || "",
    c25i: firstLineItem?.child2_5OwnRoom || "",
    child6_11Sharing: firstLineItem?.child6_11Sharing || "",
    c611s: firstLineItem?.child6_11Sharing || "",
    child6_11Bed: firstLineItem?.child6_11Bed || "",
    c611b: firstLineItem?.child6_11Bed || "",
    child6_11OwnRoom: firstLineItem?.child6_11OwnRoom || "",
    c611i: firstLineItem?.child6_11OwnRoom || "",
    guideorDriver: firstLineItem?.guide || "",
    isReservation: voucher.voucherType === "reservation",
    isAmendment: voucher.voucherType === "amendment",
    isPptp: voucher.voucherType === "pptp",
    generatedAt: new Date().toLocaleString(),
    totalRooms,
    totalChildren: totalChildren || "",
    child: totalChildren || "",
    totalPax: voucher.totalPax || "",
    market: voucher.market ?? "",
    rateApplicable: resolvedRateApplicable,
    rateApplicableText: voucher.rateApplicableText ?? "",
    guideText: voucher.guideText ?? "",
    surchargeText: voucher.surchargeText ?? "",
    eventSupplementText: voucher.eventSupplementText ?? "",
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
    ]) as ChildProcess;

    child.on("error", () => resolve(undefined));
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve(undefined);
        return;
      }

      resolve(path.join(outputDirectory, `${path.basename(docxPath, ".docx")}.pdf`));
    });
  });
}

export async function generateDocuments(voucher: VoucherPayload, format: DocumentFormat = "pdf", customOutputDir?: string): Promise<GeneratedDocument> {
  const templatePath = getTemplatePath();
  const outputDirectory = customOutputDir || resolveVoucherOutputDirectory(voucher.tourType || "", voucher.hotelName || "");
  await fs.mkdir(outputDirectory, { recursive: true });

  const template = await fs.readFile(templatePath);
  const zip = new PizZip(template);
  let documentXml = zip.file("word/document.xml")?.asText() ?? "";

  if (docxtemplaterTagPattern.test(documentXml)) {
    // Auto-fix legacy templates that use {RequiredDate} but lack a {#lineItems} loop
    const rawText = documentXml.replace(/<[^>]+>/g, "");
    if (!rawText.includes("{#lineItems}") && rawText.includes("{RequiredDate}")) {
      const requiredDateRegex = /<w:tr[\s>](?:(?!<w:tr[\s>]).)*?R(?:<[^>]+>)*e(?:<[^>]+>)*q(?:<[^>]+>)*u(?:<[^>]+>)*i(?:<[^>]+>)*r(?:<[^>]+>)*e(?:<[^>]+>)*d(?:<[^>]+>)*D(?:<[^>]+>)*a(?:<[^>]+>)*t(?:<[^>]+>)*e(?:<[^>]+>)*.*?(?:<\/w:tr>)/g;
      
      const newXml = documentXml.replace(requiredDateRegex, (match) => {
        let replaced = match.replace(/(<w:t(?: [^>]*)?>)/, "$1{#lineItems}");
        const lastIndex = replaced.lastIndexOf("</w:t>");
        if (lastIndex !== -1) {
          replaced = replaced.substring(0, lastIndex) + "{/lineItems}" + replaced.substring(lastIndex);
        }
        return replaced;
      });
      
      if (newXml !== documentXml) {
        documentXml = newXml;
        zip.file("word/document.xml", documentXml);
      }
    }

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
    normalizeFileName(voucher.tourType || ""),
    normalizeFileName(voucher.market || ""),
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
