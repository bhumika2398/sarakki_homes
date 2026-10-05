import { EMAIL_RE, INDIAN_MOBILE_RE, normalizePhone } from "@/lib/loanDocuments";

/**
 * Fields an authorised admin can correct on an existing lead, with the
 * validation shared by the correction form and /api/admin/leads/[id]/correct.
 * Phone and email use the exact same rules as the loan-eligibility forms.
 * Stage / priority / agent / deal fields are deliberately NOT here — those
 * are workflow changes, not corrections of what was recorded.
 */
export const CORRECTABLE_FIELDS = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  location: "Location",
  propertyType: "Requirement (property type)",
  purpose: "Purpose",
  source: "Source",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  areaRequired: "Area required",
  possession: "Possession",
  budgetMinLakh: "Budget min (lakh)",
  budgetMaxLakh: "Budget max (lakh)",
} as const;
export type CorrectableField = keyof typeof CORRECTABLE_FIELDS;

const NUMBER_FIELDS: CorrectableField[] = ["bedrooms", "bathrooms", "budgetMinLakh", "budgetMaxLakh"];
const REQUIRED_FIELDS: CorrectableField[] = ["name", "phone", "purpose", "source"];

export type CorrectionValue = string | number | null;

export function validateLeadCorrection(
  input: Record<string, unknown>
): { ok: true; value: Partial<Record<CorrectableField, CorrectionValue>> } | { ok: false; error: string } {
  const out: Partial<Record<CorrectableField, CorrectionValue>> = {};

  for (const field of Object.keys(CORRECTABLE_FIELDS) as CorrectableField[]) {
    if (!(field in input)) continue;
    const raw = input[field];
    const label = CORRECTABLE_FIELDS[field];
    const text = raw === null || raw === undefined ? "" : String(raw).trim();

    if (text === "") {
      if (REQUIRED_FIELDS.includes(field)) return { ok: false, error: `${label} can't be empty.` };
      out[field] = null;
      continue;
    }

    if (NUMBER_FIELDS.includes(field)) {
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${label} must be a positive number.` };
      out[field] = field === "bedrooms" || field === "bathrooms" ? Math.trunc(n) : n;
    } else if (field === "phone") {
      const digits = normalizePhone(text);
      if (!INDIAN_MOBILE_RE.test(digits)) return { ok: false, error: "Please enter a valid 10-digit mobile number." };
      out[field] = digits;
    } else if (field === "email") {
      const email = text.toLowerCase();
      if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
      out[field] = email;
    } else if (field === "name") {
      if (text.length < 2) return { ok: false, error: "Please enter the full name." };
      out[field] = text;
    } else {
      if (text.length > 160) return { ok: false, error: `${label} is too long.` };
      out[field] = text;
    }
  }

  const min = out.budgetMinLakh;
  const max = out.budgetMaxLakh;
  if (typeof min === "number" && typeof max === "number" && min > max) {
    return { ok: false, error: "Budget min can't be higher than budget max." };
  }
  return { ok: true, value: out };
}
