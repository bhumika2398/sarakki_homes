import * as z from "zod";

/**
 * Listing-detail fields (99acres / Housing.com style) shared by the CRM
 * wizard (client-side validation + field visibility) and the
 * /api/admin/properties routes (server-side validation + persistence), so
 * the two can never drift apart. Everything is string-typed at the
 * validation boundary — the wizard's inputs are strings, and the server
 * stringifies whatever JSON it receives (number / null / "") before
 * running the same schema.
 */

export const PURPOSES = ["Sale", "Rent"] as const;
export const OWNERSHIP_TYPES = ["Freehold", "Leasehold"] as const;
export const AVAILABILITY_STATUSES = ["Ready to Move", "Under Construction"] as const;
export const FURNISHING = ["Unfurnished", "Semi-Furnished", "Fully Furnished"] as const;
export const FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"] as const;
export const YES_NO = ["Yes", "No"] as const;
export const POWER_BACKUP = ["None", "Partial", "Full"] as const;

export const NEARBY_FACILITY_OPTIONS = [
  "Metro",
  "Bus Stop",
  "School",
  "College",
  "Hospital",
  "Market",
  "Mall",
  "Park",
  "Airport",
  "Railway Station",
  "IT Park",
  "Bank / ATM",
] as const;

export const AMENITY_OPTIONS = [
  "Swimming Pool",
  "Gym",
  "Clubhouse",
  "Children's Play Area",
  "Garden",
  "24x7 Security",
  "CCTV",
  "Gated Community",
  "Covered Parking",
  "Visitor Parking",
  "Intercom",
  "Rainwater Harvesting",
  "Sewage Treatment",
  "Solar Power",
  "Jogging Track",
  "Indoor Games",
  "Community Hall",
  "Fire Safety",
] as const;

// ---------------------------------------------------------------------
// Which fields apply to which kind of property
// ---------------------------------------------------------------------

export type PropertyKind = "plot" | "commercial" | "apartment" | "house";

/** Maps the admin-managed PropertyType name (free text, editable in the
 *  CRM) onto a kind. Unknown names fall back to "house" — the most
 *  permissive set — so a newly added type never hides fields by accident. */
export function propertyKindFor(typeName?: string | null): PropertyKind {
  const n = (typeName ?? "").toLowerCase();
  if (/(plot|land|site)/.test(n)) return "plot";
  if (/(commercial|office|shop|retail|warehouse|showroom)/.test(n)) return "commercial";
  if (/(flat|apartment|studio|penthouse)/.test(n)) return "apartment";
  return "house";
}

const HIDDEN_BY_KIND: Record<PropertyKind, readonly string[]> = {
  plot: [
    "beds", "baths", "balconies", "totalFloors", "floorDetails", "parkingCars", "parkingBikes",
    "propertyAge", "furnishing", "lift", "powerBackup", "builtUpArea", "carpetArea",
  ],
  commercial: ["beds", "balconies"],
  apartment: ["plotArea", "dimLength", "dimWidth"],
  house: [],
};

/** True when `field` should be shown for a property of this type. */
export function isFieldVisible(kind: PropertyKind, field: string): boolean {
  return !HIDDEN_BY_KIND[kind].includes(field);
}

/** Fields the server clears for this kind, so a value typed before the
 *  admin switched Property Type can't persist invisibly. */
export function hiddenFieldsFor(kind: PropertyKind): readonly string[] {
  return HIDDEN_BY_KIND[kind];
}

// ---------------------------------------------------------------------
// Validation (identical on client and server)
// ---------------------------------------------------------------------

const optionalNumber = (label: string) =>
  z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d+)?$/.test(v.trim()), `${label} must be a positive number.`);

const optionalInt = (label: string) =>
  z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v.trim()), `${label} must be a whole number.`);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .string()
    .optional()
    .refine((v) => !v || (values as readonly string[]).includes(v), `${label} has an invalid value.`);

export const propertyDetailsShape = {
  // Required
  purpose: z.enum(PURPOSES, { message: "Purpose is required (Sale or Rent)." }),
  city: z
    .string()
    .min(1, "City is required.")
    .refine((v) => v.trim().length >= 2, "City is required."),

  // Basic
  ownershipType: optionalEnum(OWNERSHIP_TYPES, "Ownership type"),
  availabilityStatus: optionalEnum(AVAILABILITY_STATUSES, "Availability"),
  possessionDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Possession date must be a valid date."),

  // Location
  locality: z.string().optional(),
  pincode: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{6}$/.test(v.trim()), "PIN code must be exactly 6 digits."),
  landmark: z.string().optional(),
  nearbyFacilities: z.array(z.string()).optional(),

  // Area & dimensions
  plotArea: optionalNumber("Plot area"),
  builtUpArea: optionalNumber("Built-up area"),
  carpetArea: optionalNumber("Carpet area"),
  dimLength: optionalNumber("Length"),
  dimWidth: optionalNumber("Width"),
  roadWidth: optionalNumber("Road width"),

  // Building
  totalFloors: z.string().optional(),
  floorDetails: z.string().optional(),
  balconies: optionalInt("Balconies"),
  parkingCars: optionalInt("Car parking"),
  parkingBikes: optionalInt("Bike parking"),
  propertyAge: z.string().optional(),
  furnishing: optionalEnum(FURNISHING, "Furnishing"),
  facing: optionalEnum(FACINGS, "Facing"),

  // Utilities & amenities
  waterSupply: z.string().optional(),
  electricity: z.string().optional(),
  lift: optionalEnum(YES_NO, "Lift"),
  powerBackup: optionalEnum(POWER_BACKUP, "Power backup"),
  amenities: z.array(z.string()).optional(),

  // Pricing — whole rupees, the single source of truth for price.
  // (priceValueLakh and the display string are derived from this.)
  expectedPrice: z
    .string({ message: "Price is required." })
    .min(1, "Price is required.")
    .refine(
      (v) => /^\d+$/.test(v.trim()) && Number(v) > 0,
      "Price must be a whole number of rupees greater than zero (no commas, decimals or symbols)."
    ),
  negotiable: optionalEnum(YES_NO, "Negotiable"),

  // Media
  videoUrl: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v.trim()), "Video must be a valid http(s) link."),
};

export const propertyDetailsSchema = z.object(propertyDetailsShape);

/** Stringifies a JSON-body value the way the wizard's inputs would hold
 *  it, so the server can run the exact same string-based schema. */
function asFormString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return "";
  return String(v);
}

/** Server-side: validates the detail fields of a request body against the
 *  same schema the wizard uses. Returns the first error message, or null. */
export function validateDetailsBody(body: Record<string, unknown>): string | null {
  const input: Record<string, unknown> = {};
  for (const key of Object.keys(propertyDetailsShape)) {
    const raw = body[key];
    if (key === "nearbyFacilities" || key === "amenities") {
      input[key] = Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? safeJsonArray(raw) : undefined;
    } else {
      input[key] = asFormString(raw);
    }
  }
  const result = propertyDetailsSchema.safeParse(input);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid property details.");
}

function safeJsonArray(raw: string): string[] | undefined {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------
// Persistence mapping (body -> Prisma data)
// ---------------------------------------------------------------------

const trimOrNull = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const floatOrNull = (v: unknown): number | null | undefined => {
  const s = trimOrNull(v);
  if (s === undefined || s === null) return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (v: unknown): number | null | undefined => {
  const n = floatOrNull(v);
  return n === undefined || n === null ? n : Math.trunc(n);
};
const jsonArray = (v: unknown): string | undefined => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return JSON.stringify(v.map(String));
  if (typeof v === "string" && safeJsonArray(v)) return v;
  return "[]";
};

/**
 * Maps a request body onto the Property columns added for listing
 * details. A key absent from the body maps to `undefined` (Prisma leaves
 * the column alone) — important because the CRM list page PUTs a
 * property back with only a couple of fields changed (feature / archive),
 * and that must not wipe anything.
 *
 * `kind` clears fields hidden for that property type. `purpose`/`city`
 * are NOT NULL columns, so they're only included when provided.
 */
export function detailsToPrismaData(body: Record<string, unknown>, kind: PropertyKind) {
  const hidden = new Set(hiddenFieldsFor(kind));
  const clear = <T>(field: string, value: T): T | null | undefined =>
    hidden.has(field) && value !== undefined ? null : value;

  const availability = trimOrNull(body.availabilityStatus);
  const underConstruction = availability === "Under Construction";

  return {
    purpose: trimOrNull(body.purpose) ?? undefined,
    ownershipType: trimOrNull(body.ownershipType),
    availabilityStatus: availability,
    // Possession date only means something while under construction.
    possessionDate:
      availability === undefined
        ? trimOrNull(body.possessionDate)
        : underConstruction
          ? trimOrNull(body.possessionDate)
          : null,

    locality: trimOrNull(body.locality),
    city: trimOrNull(body.city) ?? undefined,
    pincode: trimOrNull(body.pincode),
    landmark: trimOrNull(body.landmark),
    nearbyFacilities: jsonArray(body.nearbyFacilities),

    plotArea: clear("plotArea", floatOrNull(body.plotArea)),
    builtUpArea: clear("builtUpArea", floatOrNull(body.builtUpArea)),
    carpetArea: clear("carpetArea", floatOrNull(body.carpetArea)),
    dimLength: clear("dimLength", floatOrNull(body.dimLength)),
    dimWidth: clear("dimWidth", floatOrNull(body.dimWidth)),
    roadWidth: floatOrNull(body.roadWidth),

    totalFloors: clear("totalFloors", trimOrNull(body.totalFloors)),
    floorDetails: clear("floorDetails", trimOrNull(body.floorDetails)),
    balconies: clear("balconies", intOrNull(body.balconies)),
    parkingCars: clear("parkingCars", intOrNull(body.parkingCars)),
    parkingBikes: clear("parkingBikes", intOrNull(body.parkingBikes)),
    propertyAge: clear("propertyAge", trimOrNull(body.propertyAge)),
    furnishing: clear("furnishing", trimOrNull(body.furnishing)),
    facing: trimOrNull(body.facing),

    waterSupply: trimOrNull(body.waterSupply),
    electricity: trimOrNull(body.electricity),
    lift: clear("lift", trimOrNull(body.lift)),
    powerBackup: clear("powerBackup", trimOrNull(body.powerBackup)),
    amenities: jsonArray(body.amenities),

    expectedPrice: floatOrNull(body.expectedPrice),
    negotiable: trimOrNull(body.negotiable),
  };
}

// ---------------------------------------------------------------------
// Read-only display (public property detail page)
// ---------------------------------------------------------------------

export interface DetailRow {
  label: string;
  value: string;
}
export interface DetailSection {
  title: string;
  rows: DetailRow[];
  tags?: string[];
}

interface DetailSource {
  purpose: string;
  ownershipType: string | null;
  availabilityStatus: string | null;
  possessionDate: string | null;
  locality: string | null;
  city: string;
  pincode: string | null;
  landmark: string | null;
  nearbyFacilities: string;
  plotArea: number | null;
  builtUpArea: number | null;
  carpetArea: number | null;
  dimLength: number | null;
  dimWidth: number | null;
  roadWidth: number | null;
  totalFloors: string | null;
  floorDetails: string | null;
  balconies: number | null;
  parkingCars: number | null;
  parkingBikes: number | null;
  propertyAge: string | null;
  furnishing: string | null;
  facing: string | null;
  waterSupply: string | null;
  electricity: string | null;
  lift: string | null;
  powerBackup: string | null;
  amenities: string;
  expectedPrice: number | null;
  negotiable: string | null;
}

export function parseJsonList(raw: string | null | undefined): string[] {
  return safeJsonArray(raw ?? "[]") ?? [];
}

const sqft = (n: number | null) => (n ? `${n.toLocaleString("en-IN")} sq.ft` : null);
const ft = (n: number | null) => (n ? `${n.toLocaleString("en-IN")} ft` : null);

/** Groups only the details that actually have a value, so a listing with
 *  none of the new fields filled in renders nothing extra. */
export function buildDetailSections(p: DetailSource, kind: PropertyKind): DetailSection[] {
  const sections: DetailSection[] = [];
  const add = (title: string, entries: Array<[string, string | null | undefined]>, tags?: string[]) => {
    const rows = entries.filter(([, v]) => v).map(([label, value]) => ({ label, value: value as string }));
    if (rows.length || (tags && tags.length)) sections.push({ title, rows, tags });
  };

  add("Overview", [
    ["Purpose", p.purpose],
    ["Ownership", p.ownershipType],
    ["Availability", p.availabilityStatus],
    ["Possession", p.possessionDate ? new Date(p.possessionDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : null],
    ["Negotiable", p.negotiable],
  ]);
  add(
    "Location",
    [
      ["Locality", p.locality],
      ["City", p.city],
      ["PIN code", p.pincode],
      ["Landmark", p.landmark],
    ],
    parseJsonList(p.nearbyFacilities)
  );
  add("Area & dimensions", [
    ["Plot area", sqft(p.plotArea)],
    ["Built-up area", sqft(p.builtUpArea)],
    ["Carpet area", sqft(p.carpetArea)],
    ["Dimensions", p.dimLength && p.dimWidth ? `${p.dimLength} × ${p.dimWidth} ft` : null],
    ["Road width", ft(p.roadWidth)],
  ]);
  if (kind !== "plot") {
    add("Building", [
      ["Total floors", p.totalFloors],
      ["Floor details", p.floorDetails],
      ["Balconies", p.balconies != null ? String(p.balconies) : null],
      [
        "Parking",
        p.parkingCars != null || p.parkingBikes != null
          ? `${p.parkingCars ?? 0} car · ${p.parkingBikes ?? 0} bike`
          : null,
      ],
      ["Property age", p.propertyAge],
      ["Furnishing", p.furnishing],
      ["Facing", p.facing],
    ]);
  } else {
    add("Plot", [["Facing", p.facing]]);
  }
  // Amenities themselves are rendered by the existing PropertyAmenities
  // component (fed from Property.amenities), so only utilities go here.
  add("Utilities", [
    ["Water supply", p.waterSupply],
    ["Electricity", p.electricity],
    ["Lift", p.lift],
    ["Power backup", p.powerBackup],
  ]);
  return sections;
}
