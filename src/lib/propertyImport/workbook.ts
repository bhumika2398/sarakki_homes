import { Readable } from "stream";
import ExcelJS from "exceljs";
import { ALL_HEADERS, COLUMN_DEFS, PROPERTY_ID_HEADER } from "./columnMapping";
import { resolveFieldName, type CanonicalField } from "./fieldResolver";
import { formatRupees } from "@/lib/formatPrice";

export interface RawImportRow {
  /** Human-readable location in the file, for error/summary messages —
   *  "Row 5" for a normal table, "Columns A–B" for a key-value block. */
  sourceLabel: string;
  /** Canonical field name -> raw cell value (trimmed text). Only the
   *  fields the sheet actually provided are present. */
  values: Partial<Record<CanonicalField, string>>;
  /** Labels the sheet had that don't map to a property field, folded as
   *  "LABEL: value" lines so the info still lands in the Description
   *  instead of being dropped. */
  extra: string;
}

const MAX_ROWS_SCAN = 20000;
const MAX_COLS_SCAN = 200;

/** Reads an uploaded file — .xlsx or .csv, any sheet shape — into
 *  canonical property rows. Handles both a normal one-property-per-row
 *  table (headers anywhere in the first few rows, in any wording) and a
 *  transposed "field name in column A, value in column B" layout with
 *  several property blocks side by side. Returns null only when the file
 *  isn't a readable spreadsheet at all. */
export async function parseUploadedWorkbook(buffer: ArrayBuffer): Promise<{
  rows: RawImportRow[];
} | null> {
  let workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.csv.read(Readable.from(Buffer.from(buffer)));
    } catch {
      return null;
    }
  }
  if (workbook.worksheets.length === 0) return null;

  const rows: RawImportRow[] = [];
  for (const sheet of workbook.worksheets) {
    const grid = sheetToGrid(sheet);
    if (grid.length === 0) continue;
    rows.push(...parseGrid(grid));
  }
  return { rows };
}

function sheetToGrid(sheet: ExcelJS.Worksheet): string[][] {
  const rowCount = Math.min(sheet.rowCount || 0, MAX_ROWS_SCAN);
  const colCount = Math.min(Math.max(sheet.columnCount || 0, 1), MAX_COLS_SCAN);
  const grid: string[][] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const arr: string[] = [];
    for (let c = 1; c <= colCount; c++) arr.push(cellToText(row.getCell(c).value));
    grid.push(arr);
  }
  return grid;
}

function colLetter(index0: number): string {
  let n = index0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Decide table vs. transposed for one sheet, then emit rows. */
function parseGrid(grid: string[][]): RawImportRow[] {
  const scanDepth = Math.min(grid.length, 12);

  // --- Try a normal header row somewhere near the top -------------------
  // A real table header has several DIFFERENT field names across it; a
  // transposed sheet whose first label happens to be "Name" would only
  // ever show one or two distinct fields on any single row, so counting
  // distinct fields (not cells) keeps the two layouts apart.
  let bestHeader = { rowIdx: -1, distinct: 0 };
  for (let r = 0; r < scanDepth; r++) {
    const fields = new Set<CanonicalField>();
    let hasAnchor = false;
    for (const cell of grid[r]) {
      const f = resolveFieldName(cell);
      if (f) {
        fields.add(f);
        if (f === "title" || f === "price" || f === "propertyId") hasAnchor = true;
      }
    }
    if (hasAnchor && fields.size >= 3 && fields.size > bestHeader.distinct) {
      bestHeader = { rowIdx: r, distinct: fields.size };
    }
  }

  if (bestHeader.rowIdx >= 0) return parseAsTable(grid, bestHeader.rowIdx);

  // --- Otherwise look for transposed key-value blocks ------------------
  const transposed = parseAsTransposed(grid);
  if (transposed.length > 0) return transposed;

  return [];
}

function parseAsTable(grid: string[][], headerIdx: number): RawImportRow[] {
  const header = grid[headerIdx];
  const colField: (CanonicalField | null)[] = header.map(resolveFieldName);

  const out: RawImportRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.every((c) => c === "")) continue;

    const values: Partial<Record<CanonicalField, string>> = {};
    const extraParts: string[] = [];
    cells.forEach((cell, c) => {
      if (cell === "") return;
      const field = colField[c];
      if (field) {
        if (!values[field]) values[field] = cell;
      } else if (header[c]) {
        extraParts.push(`${header[c].trim()}: ${cell}`);
      }
    });

    if (Object.keys(values).length === 0 && extraParts.length === 0) continue;
    out.push({ sourceLabel: `Row ${r + 1}`, values, extra: extraParts.join("\n") });
  }
  return out;
}

function parseAsTransposed(grid: string[][]): RawImportRow[] {
  const colCount = grid.reduce((m, row) => Math.max(m, row.length), 0);

  // A "label column" is one where several cells, read downward, are
  // recognisable field names.
  const labelCols: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let hits = 0;
    for (const row of grid) {
      if (row[c] && resolveFieldName(row[c])) hits++;
    }
    if (hits >= 3) labelCols.push(c);
  }
  if (labelCols.length === 0) return [];

  const out: RawImportRow[] = [];
  labelCols.forEach((lc) => {
    const vc = lc + 1;
    const values: Partial<Record<CanonicalField, string>> = {};
    const extraParts: string[] = [];

    for (const row of grid) {
      const label = (row[lc] ?? "").trim();
      const value = (row[vc] ?? "").trim();
      if (!value && !label) continue;
      const field = resolveFieldName(label);
      if (field) {
        if (!values[field] && value) values[field] = value;
      } else if (label && value) {
        extraParts.push(`${label}: ${value}`);
      } else if (!label && value && !values.title) {
        // A value with no label at the top of a block is almost always
        // the property name (see the sample sheets).
        values.title = value;
      }
    }

    const fieldCount = Object.keys(values).length;
    if (values.title || values.price || fieldCount >= 2) {
      out.push({
        sourceLabel: `Columns ${colLetter(lc)}–${colLetter(vc)}`,
        values,
        extra: extraParts.join("\n"),
      });
    }
  });
  return out;
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // Rich text / formula result / hyperlink objects.
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
    if (value instanceof Date) return value.toISOString();
    return "";
  }
  return String(value).trim();
}

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF171715" } },
  alignment: { vertical: "middle", horizontal: "left" },
};

/** The blank downloadable template: headers only, plus one filled-in
 *  example row so a non-technical admin can see the expected format at a
 *  glance, plus a read-only "Reference" sheet listing the exact category/
 *  builder/type/status values the CRM currently recognizes (so the admin
 *  never has to guess or invent a category name that doesn't exist). */
export async function buildTemplateWorkbook(reference: {
  categories: string[];
  builders: string[];
  propertyTypes: string[];
}): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Properties");

  sheet.columns = ALL_HEADERS.map((header) => ({ header, key: header, width: Math.max(18, header.length + 4) }));
  sheet.getRow(1).eachCell((cell) => Object.assign(cell, { style: HEADER_STYLE }));

  const exampleRow: Record<string, string> = {
    [PROPERTY_ID_HEADER]: "",
    "Property Name": "Prestige Lakeside Habitat",
    "Property Type": reference.propertyTypes[0] ?? "Flat",
    Category: reference.categories[0] ?? "Rental Income Properties",
    Builder: reference.builders[0] ?? "",
    Price: "12500000",
    "Price in Lakh": "",
    Location: "Whitefield",
    Address: "123, Lakeside Habitat, Whitefield, Bengaluru",
    "Google Maps Location": "Prestige Lakeside Habitat Whitefield Bengaluru",
    Bedrooms: "3",
    Bathrooms: "2",
    Area: "1,450 sq.ft",
    "Area (Sqft)": "1450",
    Description: "A well-maintained 3BHK apartment close to Whitefield's tech corridor.",
    Status: "",
    Featured: "No",
  };
  sheet.addRow(exampleRow);

  const refSheet = workbook.addWorksheet("Reference (do not edit)");
  refSheet.columns = [
    { header: "Existing Categories", key: "cat", width: 32 },
    { header: "Existing Builders", key: "builder", width: 32 },
    { header: "Property Type values", key: "type", width: 22 },
    { header: "Status values", key: "status", width: 20 },
  ];
  refSheet.getRow(1).eachCell((cell) => Object.assign(cell, { style: HEADER_STYLE }));
  const statusDef = COLUMN_DEFS.find((c) => c.field === "status");
  const maxLen = Math.max(
    reference.categories.length,
    reference.builders.length,
    reference.propertyTypes.length,
    statusDef?.enumValues?.length ?? 0
  );
  for (let i = 0; i < maxLen; i++) {
    refSheet.addRow({
      cat: reference.categories[i] ?? "",
      builder: reference.builders[i] ?? "",
      type: reference.propertyTypes[i] ?? "",
      status: statusDef?.enumValues?.[i] ?? "",
    });
  }

  return workbook.xlsx.writeBuffer();
}

/** Export: same headers as the template, one row per existing property,
 *  Property ID filled in so a re-upload of the edited file updates
 *  (never duplicates) those exact rows. */
export async function buildExportWorkbook(
  properties: Array<{
    propertyId: string;
    title: string;
    type: string;
    categoryTitle: string;
    builderName: string | null;
    price: string;
    priceValueLakh: number;
    expectedPrice?: number | null;
    location: string;
    address: string;
    mapQuery: string;
    beds: number;
    baths: number;
    area: string;
    areaSqft: number;
    description: string;
    status: string;
    featured: string;
  }>
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Properties");
  sheet.columns = ALL_HEADERS.map((header) => ({ header, key: header, width: Math.max(18, header.length + 4) }));
  sheet.getRow(1).eachCell((cell) => Object.assign(cell, { style: HEADER_STYLE }));

  for (const p of properties) {
    sheet.addRow({
      [PROPERTY_ID_HEADER]: p.propertyId,
      "Property Name": p.title,
      "Property Type": p.type,
      Category: p.categoryTitle,
      Builder: p.builderName ?? "",
      Price: p.expectedPrice != null ? formatRupees(p.expectedPrice) : p.price,
      // Deprecated column left blank on export: a re-import would otherwise
      // let this rounded figure override the exact rupee Price above.
      "Price in Lakh": "",
      Location: p.location,
      Address: p.address,
      "Google Maps Location": p.mapQuery,
      Bedrooms: String(p.beds),
      Bathrooms: String(p.baths),
      Area: p.area,
      "Area (Sqft)": String(p.areaSqft),
      Description: p.description,
      Status: p.status,
      Featured: p.featured === "true" ? "Yes" : "No",
    });
  }

  return workbook.xlsx.writeBuffer();
}
