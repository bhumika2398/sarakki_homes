// =============================================================================
// Turning "any spreadsheet shape" into property fields.
// =============================================================================
// Real sheets the client uses come in two very different shapes:
//
//   A) Clean table  — one property per row, headers across row 1
//                     (this is also exactly what the CRM's own Export
//                     produces, so an export -> edit -> re-import round
//                     trip stays lossless).
//
//   B) Key-value    — field names down a column, the value beside it,
//                     often several property blocks side by side
//                     ("Name / LOCATION / AREA / BHK / PRICE ..." in
//                     column A with values in B, another block in C/D).
//
// Both are handled by resolving whatever label text a sheet uses to one
// of the canonical field names below, via a generous synonym list plus
// loose normalisation (case-, space- and punctuation-insensitive). Any
// label that still doesn't resolve isn't thrown away — it's folded into
// the property's Description as a "LABEL: value" line so nothing is lost.

export type CanonicalField =
  | "propertyId"
  | "title"
  | "type"
  | "category"
  | "builder"
  | "price"
  | "priceValueLakh"
  | "location"
  | "address"
  | "mapQuery"
  | "beds"
  | "baths"
  | "area"
  | "areaSqft"
  | "description"
  | "status"
  | "featured";

const SYNONYMS: Record<CanonicalField, string[]> = {
  propertyId: ["propertyid", "id", "propid", "listingid", "ref", "refno", "referenceno", "code"],
  title: ["propertyname", "name", "title", "projectname", "project", "building", "buildingname", "property", "listingname", "propertytitle"],
  type: ["propertytype", "type", "listingtype", "unittype", "propertytypeflatplothouse"],
  category: ["category", "propertycategory", "segment", "listingcategory"],
  builder: ["builder", "developer", "builderdeveloper", "buildername", "developername", "promoter"],
  price: ["price", "cost", "rate", "askingprice", "pricing", "expectedprice", "quotedprice", "amount", "value"],
  priceValueLakh: ["priceinlakh", "pricelakh", "pricelakhs", "lakh", "lakhs", "priceinlakhs", "valueinlakh"],
  location: ["location", "area", "locality", "place", "neighbourhood", "neighborhood", "zone", "region", "landmark"],
  address: ["address", "fulladdress", "siteaddress", "propertyaddress", "completeaddress"],
  mapQuery: ["googlemapslocation", "googlemaps", "maps", "maplocation", "mapquery", "gmap", "googlemap", "locationlink", "maplink", "geolocation"],
  beds: ["bedrooms", "bedroom", "bed", "beds", "bhk", "bhkconfig", "bhkconfiguration", "configuration", "config", "noofbedrooms", "nobedrooms", "bhktype"],
  baths: ["bathrooms", "bathroom", "bath", "baths", "toilets", "toilet", "washrooms", "washroom", "bathroomcount"],
  area: ["area", "superbuiltuparea", "builtuparea", "sba", "sbua", "size", "carpetarea", "saleablearea", "plotarea", "areadetails", "dimension", "dimensions"],
  areaSqft: ["areasqft", "sqft", "sft", "squarefeet", "areainsqft", "sqfeet", "areasft"],
  description: ["description", "details", "otherdetails", "remarks", "notes", "about", "additionaldetails", "moredetails", "comments"],
  status: ["status", "publishstatus", "liststatus", "listingstatus", "availability"],
  featured: ["featured", "showonhomepage", "highlight", "ishighlighted", "topproperty"],
};

/** Lowercase, strip everything that isn't a letter or digit. So
 *  "Google Maps Location", "google_maps_location" and "GoogleMapsLocation"
 *  all collapse to the same key. */
export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LOOKUP: Map<string, CanonicalField> = (() => {
  const m = new Map<string, CanonicalField>();
  for (const [field, aliases] of Object.entries(SYNONYMS) as [CanonicalField, string[]][]) {
    m.set(normalizeKey(field), field);
    for (const a of aliases) m.set(normalizeKey(a), field);
  }
  return m;
})();

/** Resolve a sheet's label/header text to a canonical field, or null if
 *  it isn't something we know how to store. Exact normalised match first,
 *  then a contains-match so "Approx Built-up Area (sq ft)" still lands on
 *  `areaSqft` / `area`. */
export function resolveFieldName(raw: string): CanonicalField | null {
  const key = normalizeKey(raw);
  if (!key) return null;
  const exact = LOOKUP.get(key);
  if (exact) return exact;

  // Longest alias that appears inside the label wins (so "areasqft"
  // beats "area" when both are substrings).
  let best: { field: CanonicalField; len: number } | null = null;
  for (const [alias, field] of LOOKUP) {
    if (alias.length >= 3 && key.includes(alias) && (!best || alias.length > best.len)) {
      best = { field, len: alias.length };
    }
  }
  return best?.field ?? null;
}

// ---------------------------------------------------------------------------
// Free-text value parsers — real sheets write "93 LAKHS -SLIGHTLY
// NEGOTIABLE", "1.10 Cr", "THREE", "2+1", "1650 SFT, UDS 265 SFT".
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** First number found in a string, words ("three") included. null if none. */
export function firstNumber(raw: string): number | null {
  const t = raw.toLowerCase().trim();
  if (t === "") return null;
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  const m = t.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** BHK / bedroom count from things like "THREE", "3 BHK", "2+1", "3.5". */
export function parseBhk(raw: string): number | null {
  const n = firstNumber(raw);
  return n === null ? null : Math.round(n);
}

/** Bathroom count — "2+1" style means 2 full + 1 half, so sum the digits. */
export function parseBathrooms(raw: string): number | null {
  const nums = (raw.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return firstNumber(raw) === null ? null : Math.round(firstNumber(raw)!);
  return nums.reduce((a, b) => a + b, 0);
}

/** Square footage from "1650 SFT, UDS 265 SFT" -> 1650 (first number). */
export function parseSqft(raw: string): number | null {
  const n = firstNumber(raw);
  return n === null || n <= 0 ? null : Math.round(n);
}

/** A price string -> the display text (kept as-is, just tidied) plus a
 *  numeric lakh value derived from it when possible:
 *   "1.10 Cr"                 -> { display: "1.10 Cr",  lakh: 110 }
 *   "₹39,91,000"              -> { display: "₹39,91,000", lakh: 39.91 }
 *   "93 LAKHS -SLIGHTLY NEG"  -> { display: "93 Lakhs -slightly neg", lakh: 93 }
 *   "9,000/sq.ft"            -> { display: "9,000/sq.ft", lakh: null } */
export function parsePrice(raw: string): { display: string; lakh: number | null } {
  const display = raw.trim();
  if (!display) return { display: "", lakh: null };

  const lower = display.toLowerCase();
  const numMatch = lower.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!numMatch) return { display, lakh: null };
  const value = Number(numMatch[0]);
  if (!Number.isFinite(value)) return { display, lakh: null };

  // Per-sqft quotes aren't a total price — don't invent a lakh figure.
  if (/\/\s*(sq|sft|sqft|sq\.?\s*ft)/.test(lower)) return { display, lakh: null };

  if (/\bcr\b|crore/.test(lower)) return { display, lakh: round2(value * 100) };
  if (/\blakh|\blac|\bl\b/.test(lower)) return { display, lakh: round2(value) };

  // A bare number with no unit: a big one is rupees (₹39,91,000), a
  // small one is already lakhs.
  if (value >= 100000) return { display, lakh: round2(value / 100000) };
  if (value > 0 && value < 100000) return { display, lakh: round2(value) };
  return { display, lakh: null };
}

/** Price text -> whole rupees (the CRM's single price unit).
 *   "1.25 Cr" -> 12500000     "93 Lakhs" -> 9300000
 *   "₹39,91,000" / "12500000" -> as written (a bare number is rupees)
 *   "9,000/sq.ft"             -> null (per-sqft quotes aren't a total)
 *  `unitless` flags a bare number so the caller can warn when it's small
 *  enough to have been typed in lakhs. */
export function parsePriceRupees(raw: string): { rupees: number | null; unitless: boolean } {
  const lower = raw.trim().toLowerCase();
  const numMatch = lower.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!numMatch) return { rupees: null, unitless: false };
  const value = Number(numMatch[0]);
  if (!Number.isFinite(value) || value <= 0) return { rupees: null, unitless: false };
  if (/\/\s*(sq|sft|sqft|sq\.?\s*ft)/.test(lower)) return { rupees: null, unitless: false };
  if (/\bcr\b|crore/.test(lower)) return { rupees: Math.round(value * 10000000), unitless: false };
  if (/\blakh|\blac|\bl\b/.test(lower)) return { rupees: Math.round(value * 100000), unitless: false };
  return { rupees: Math.round(value), unitless: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
