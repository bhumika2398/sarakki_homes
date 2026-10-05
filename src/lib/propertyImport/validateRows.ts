import {
  DEFAULT_CATEGORY_TITLE,
  DEFAULT_PRICE_TEXT,
  DEFAULT_TYPE,
  PROPERTY_STATUS_VALUES,
} from "./columnMapping";
import { firstNumber, parseBathrooms, parseBhk, parsePrice, parsePriceRupees, parseSqft } from "./fieldResolver";
import { formatRupees, looksLikeLakhs, rupeesToLakh } from "@/lib/formatPrice";
import { matchLocality } from "@/lib/localityMatch";
import type { RawImportRow } from "./workbook";

// A null on any of these means "the sheet didn't give this" — on an
// UPDATE that means "leave the field exactly as it is" (same principle
// as images never being touched); on a CREATE it falls back to the same
// safe default the manual "Add Property" form uses.
export interface ValidatedRowData {
  title: string;
  propertyTypeId: string | null;
  propertyTypeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  builderId: string | null;
  builderName: string | null;
  price: string | null;
  priceValueLakh: number | null;
  /** Whole rupees — the source of truth; price/priceValueLakh derive from it. */
  expectedPrice: number | null;
  location: string | null;
  /** Locality-list name when the Location text matched one; null otherwise. */
  locality: string | null;
  address: string | null;
  mapQuery: string | null;
  beds: number | null;
  baths: number | null;
  area: string | null;
  areaSqft: number | null;
  description: string | null;
  status: string | null;
  featured: string | null;
}

export interface ValidRow {
  rowNumber: number;
  sourceLabel: string;
  action: "create" | "update";
  targetId?: string;
  propertyId: string;
  data: ValidatedRowData;
  /** Non-blocking assumptions made about this row (guessed category,
   *  created-as-new because no ID, etc.) — surfaced in the preview so
   *  nothing is a silent surprise. */
  notes: string[];
}

export interface ErrorRow {
  rowNumber: number;
  sourceLabel: string;
  propertyId: string;
  propertyName: string;
  errors: string[];
}

export interface ReferenceData {
  categories: Map<string, { id: string; title: string }>;
  builders: Map<string, { id: string; name: string }>;
  propertyTypes: Map<string, { id: string; name: string }>;
  /** Shared Bengaluru locality list. */
  localities?: string[];
  existingPropertyIds: Map<string, string>;
}

export interface ValidationResult {
  validRows: ValidRow[];
  errorRows: ErrorRow[];
  newCount: number;
  updateCount: number;
  /** De-duplicated, counted summary of the assumptions above, for the
   *  preview screen. */
  assumptions: string[];
}

/** "rental income properties" and "rental income" should match the same
 *  category — try the value as-is, then with a trailing
 *  "property"/"properties" trimmed off each side. */
function matchByName<T>(map: Map<string, T>, raw: string): T | undefined {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\bproperties?\b/g, "").replace(/[^a-z0-9]/g, "");
  const direct = map.get(raw.toLowerCase().trim());
  if (direct) return direct;
  const target = norm(raw);
  for (const [key, val] of map) {
    if (norm(key) === target) return val;
  }
  return undefined;
}

export function validateAndResolveRows(rawRows: RawImportRow[], ref: ReferenceData): ValidationResult {
  const validRows: ValidRow[] = [];
  const errorRows: ErrorRow[] = [];
  const seenIdsInFile = new Map<string, number>();
  const assumptionCounts = new Map<string, number>();
  const bump = (key: string) => assumptionCounts.set(key, (assumptionCounts.get(key) ?? 0) + 1);

  const defaultCategory = matchByName(ref.categories, DEFAULT_CATEGORY_TITLE);
  const defaultPropertyType = matchByName(ref.propertyTypes, DEFAULT_TYPE);

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 1; // position among data rows, for the error report
    const v = row.values;
    const errors: string[] = [];
    const notes: string[] = [];

    const title = (v.title ?? "").trim();
    const propertyIdRaw = (v.propertyId ?? "").trim();

    if (!title) {
      errorRows.push({
        rowNumber,
        sourceLabel: row.sourceLabel,
        propertyId: propertyIdRaw,
        propertyName: "",
        errors: ["No property name found in this row."],
      });
      return;
    }

    // --- create vs. update -------------------------------------------------
    let action: "create" | "update" = "create";
    let targetId: string | undefined;
    if (propertyIdRaw) {
      const firstSeenAt = seenIdsInFile.get(propertyIdRaw);
      if (firstSeenAt !== undefined) {
        errors.push(`Duplicate Property ID "${propertyIdRaw}" — already used in row ${firstSeenAt}.`);
      } else {
        seenIdsInFile.set(propertyIdRaw, rowNumber);
      }
      const existingDbId = ref.existingPropertyIds.get(propertyIdRaw);
      if (!existingDbId) {
        errors.push(`Property ID "${propertyIdRaw}" was not found in the CRM.`);
      } else {
        action = "update";
        targetId = existingDbId;
      }
    } else {
      bump("no-id");
    }

    // --- category --------------------------------------------------------
    let categoryId: string | null = null;
    let categoryName: string | null = null;
    const categoryRaw = (v.category ?? "").trim();
    if (categoryRaw) {
      const matched = matchByName(ref.categories, categoryRaw);
      if (matched) {
        categoryId = matched.id;
        categoryName = matched.title;
      } else if (action === "create") {
        if (!defaultCategory) {
          errors.push(
            `Category "${categoryRaw}" doesn't exist, and the fallback category "${DEFAULT_CATEGORY_TITLE}" isn't set up either.`
          );
        } else {
          categoryId = defaultCategory.id;
          categoryName = defaultCategory.title;
          notes.push(`Category "${categoryRaw}" not found — imported into "${defaultCategory.title}".`);
          bump("category-guessed");
        }
      } else {
        notes.push(`Category "${categoryRaw}" not found — kept its current category.`);
        bump("category-kept");
      }
    } else if (action === "create") {
      if (!defaultCategory) {
        errors.push(`No Category given and the fallback category "${DEFAULT_CATEGORY_TITLE}" isn't set up.`);
      } else {
        categoryId = defaultCategory.id;
        categoryName = defaultCategory.title;
        bump("category-defaulted");
      }
    }

    // --- builder (optional, never blocks) --------------------------------
    let builderId: string | null = null;
    let builderName: string | null = null;
    const builderRaw = (v.builder ?? "").trim();
    if (builderRaw) {
      const matched = matchByName(ref.builders, builderRaw);
      if (matched) {
        builderId = matched.id;
        builderName = matched.name;
      } else {
        notes.push(`Builder "${builderRaw}" not found — left unset.`);
        bump("builder-missing");
      }
    }

    // --- price ----------------------------------------------------------
    // Price is whole rupees. Text with a unit ("1.25 Cr", "93 Lakhs") is
    // converted; a bare number is rupees. The deprecated "Price in Lakh"
    // column still wins when present, so old sheets import unchanged.
    const priceRaw = (v.price ?? "").trim();
    let price: string | null = null;
    let priceValueLakh: number | null = null;
    let expectedPrice: number | null = null;
    const explicitLakh = firstNumber((v.priceValueLakh ?? "").trim());
    if (explicitLakh !== null && explicitLakh > 0) {
      expectedPrice = Math.round(explicitLakh * 100000);
    } else if (priceRaw) {
      const parsed = parsePriceRupees(priceRaw);
      expectedPrice = parsed.rupees;
      if (parsed.rupees !== null && parsed.unitless && looksLikeLakhs(parsed.rupees, "Sale")) {
        notes.push(`Price "${priceRaw}" is under ₹1,00,000 — imported as rupees. If it's in lakhs, correct the sheet.`);
        bump("price-small");
      }
    }
    if (expectedPrice !== null && expectedPrice > 0) {
      price = formatRupees(expectedPrice);
      priceValueLakh = rupeesToLakh(expectedPrice);
    } else if (priceRaw) {
      // Per-sqft or otherwise non-total quote: keep the text, no numeric price.
      price = parsePrice(priceRaw).display;
      expectedPrice = null;
    } else if (action === "create") {
      price = DEFAULT_PRICE_TEXT;
      bump("price-missing");
    }

    // --- property type — same resolution shape as Category above -------
    let propertyTypeId: string | null = null;
    let propertyTypeName: string | null = null;
    const typeRaw = (v.type ?? "").trim();
    if (typeRaw) {
      const matched = matchByName(ref.propertyTypes, typeRaw);
      if (matched) {
        propertyTypeId = matched.id;
        propertyTypeName = matched.name;
      } else if (action === "create") {
        if (!defaultPropertyType) {
          errors.push(
            `Property Type "${typeRaw}" doesn't exist, and the fallback type "${DEFAULT_TYPE}" isn't set up either.`
          );
        } else {
          propertyTypeId = defaultPropertyType.id;
          propertyTypeName = defaultPropertyType.name;
          notes.push(`Property Type "${typeRaw}" not found — imported as "${defaultPropertyType.name}".`);
          bump("type-guessed");
        }
      } else {
        notes.push(`Property Type "${typeRaw}" not found — kept its current type.`);
        bump("type-kept");
      }
    } else if (action === "create") {
      if (!defaultPropertyType) {
        errors.push(`No Property Type given and the fallback type "${DEFAULT_TYPE}" isn't set up.`);
      } else {
        propertyTypeId = defaultPropertyType.id;
        propertyTypeName = defaultPropertyType.name;
        bump("type-defaulted");
      }
    }

    const beds = v.beds != null ? parseBhk(v.beds) : null;
    const baths = v.baths != null ? parseBathrooms(v.baths) : null;
    const area = (v.area ?? "").trim() || null;
    let areaSqft = v.areaSqft != null ? parseSqft(v.areaSqft) : null;
    if (areaSqft === null && area) areaSqft = parseSqft(area);

    const location = (v.location ?? "").trim() || null;
    // Report-don't-overwrite: the Location text is always kept as given;
    // a locality is only recorded when it matches the shared list.
    let locality: string | null = null;
    if (location && ref.localities && ref.localities.length > 0) {
      const m = matchLocality(location, ref.localities);
      if (m) locality = m.name;
      else {
        notes.push(`Location "${location}" isn't on the Bengaluru locality list — kept as typed.`);
        bump("location-unmatched");
      }
    }
    const address = (v.address ?? "").trim() || null;
    const mapQuery = (v.mapQuery ?? "").trim() || null;

    const descBase = (v.description ?? "").trim();
    const description = [descBase, row.extra.trim()].filter(Boolean).join("\n\n") || null;

    let status: string | null = null;
    const statusRaw = (v.status ?? "").trim();
    if (statusRaw) {
      status = PROPERTY_STATUS_VALUES.find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ?? null;
    }

    let featured: string | null = null;
    const featuredRaw = (v.featured ?? "").trim();
    if (/^(yes|true|y|1)$/i.test(featuredRaw)) featured = "true";
    else if (/^(no|false|n|0)$/i.test(featuredRaw)) featured = "false";

    if (errors.length > 0) {
      errorRows.push({
        rowNumber,
        sourceLabel: row.sourceLabel,
        propertyId: propertyIdRaw,
        propertyName: title,
        errors,
      });
      return;
    }

    validRows.push({
      rowNumber,
      sourceLabel: row.sourceLabel,
      action,
      targetId,
      propertyId: propertyIdRaw,
      notes,
      data: {
        title,
        propertyTypeId,
        propertyTypeName,
        categoryId,
        categoryName,
        builderId,
        builderName,
        price,
        priceValueLakh,
        expectedPrice,
        location,
        locality,
        address,
        mapQuery,
        beds,
        baths,
        area,
        areaSqft,
        description,
        status,
        featured,
      },
    });
  });

  const label: Record<string, (n: number) => string> = {
    "no-id": (n) => `${n} row${n === 1 ? "" : "s"} have no Property ID — created as new (re-uploading this file later would add them again).`,
    "category-defaulted": (n) => `${n} row${n === 1 ? "" : "s"} had no Category — imported into "${DEFAULT_CATEGORY_TITLE}".`,
    "category-guessed": (n) => `${n} row${n === 1 ? "" : "s"} had a Category that doesn't exist — imported into "${DEFAULT_CATEGORY_TITLE}".`,
    "category-kept": (n) => `${n} existing propert${n === 1 ? "y" : "ies"} had an unknown Category — their category was left unchanged.`,
    "builder-missing": (n) => `${n} row${n === 1 ? "" : "s"} named a Builder that doesn't exist — left unset.`,
    "price-small": (n) => `${n} row${n === 1 ? "" : "s"} had a Price under ₹1,00,000 — imported as rupees (check they weren't typed in lakhs).`,
    "location-unmatched": (n) => `${n} row${n === 1 ? "" : "s"} had a Location that isn't on the Bengaluru locality list — kept as typed, no locality set.`,
    "price-missing": (n) => `${n} row${n === 1 ? "" : "s"} had no Price — set to "${DEFAULT_PRICE_TEXT}".`,
    "type-defaulted": (n) => `${n} row${n === 1 ? "" : "s"} had no Property Type — imported as "${DEFAULT_TYPE}".`,
    "type-guessed": (n) => `${n} row${n === 1 ? "" : "s"} had a Property Type that doesn't exist — imported as "${DEFAULT_TYPE}".`,
    "type-kept": (n) => `${n} existing propert${n === 1 ? "y" : "ies"} had an unknown Property Type — their type was left unchanged.`,
  };
  const assumptions: string[] = [];
  for (const [key, n] of assumptionCounts) {
    assumptions.push(label[key] ? label[key](n) : `${n} rows: ${key}`);
  }
  if (validRows.some((r) => r.action === "create" && r.data.status === null)) {
    assumptions.push("New properties are published to the website immediately, unless their row sets a Status.");
  }

  return {
    validRows,
    errorRows,
    newCount: validRows.filter((r) => r.action === "create").length,
    updateCount: validRows.filter((r) => r.action === "update").length,
    assumptions,
  };
}
