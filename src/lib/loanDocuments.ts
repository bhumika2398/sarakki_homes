/**
 * Loan-eligibility definitions shared by the public website form, the
 * CRM form and the API routes — one source of truth for the applicant
 * types, the required-document checklist for each, the status set, and
 * the contact-field validation. No server imports, so client components
 * can use it too.
 */

export const APPLICANT_TYPES = ["Salaried", "Self Employed"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export interface LoanDocumentDef {
  key: string;
  label: string;
}

export const LOAN_DOCUMENTS: Record<ApplicantType, LoanDocumentDef[]> = {
  Salaried: [
    { key: "salary_slips_3m", label: "Last 3 months' salary slips" },
    { key: "bank_statement_6m", label: "6 months' bank statement" },
    { key: "pan", label: "PAN card" },
    { key: "aadhaar", label: "Aadhaar card" },
    // One checklist item: either document satisfies it.
    { key: "form16_or_itr", label: "Form 16 (last 2 years) OR 2 years' ITR" },
  ],
  "Self Employed": [
    { key: "itr_2y", label: "2 years' ITR" },
    { key: "bank_statement_1y", label: "1 year's bank statement" },
    { key: "business_proof", label: "Business proof" },
    { key: "pan", label: "PAN card" },
    { key: "aadhaar", label: "Aadhaar card" },
  ],
};

/** Application lifecycle. The website had no statuses before (it only
 *  created a Lead), so this set is new. DOCS_PENDING / DOCS_COMPLETE are
 *  moved automatically as documents are marked received. */
export const LOAN_STATUSES = [
  "NEW",
  "DOCS_PENDING",
  "DOCS_COMPLETE",
  "IN_PROCESS",
  "APPROVED",
  "REJECTED",
  "CLOSED",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  NEW: "New",
  DOCS_PENDING: "Docs pending",
  DOCS_COMPLETE: "Docs complete",
  IN_PROCESS: "In process",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export const LOAN_STATUS_BADGE_CLASS: Record<LoanStatus, string> = {
  NEW: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  DOCS_PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  DOCS_COMPLETE: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  IN_PROCESS: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  REJECTED: "border-red-500/30 bg-red-500/10 text-red-400",
  CLOSED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

/** Statuses after which a repeat submission from the same person starts a
 *  fresh application instead of being treated as a duplicate. */
export const LOAN_FINAL_STATUSES: readonly string[] = ["APPROVED", "REJECTED", "CLOSED"];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 10-digit Indian mobile number: starts 6-9, exactly 10 digits.
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Strips spaces / +91 / dashes a person might type; keeps the last 10 digits. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export function isApplicantType(v: unknown): v is ApplicantType {
  return typeof v === "string" && (APPLICANT_TYPES as readonly string[]).includes(v);
}

export interface LoanApplicantInput {
  name: string;
  phone: string;
  email: string;
  applicantType: ApplicantType;
}

/** Same rules and messages for the website form, the CRM form and both
 *  API routes. Returns the cleaned input or an error message. */
export function validateLoanApplicant(
  raw: Record<string, unknown>
): { ok: true; value: LoanApplicantInput } | { ok: false; error: string } {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const phone = normalizePhone(typeof raw.phone === "string" ? raw.phone.trim() : "");
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (!INDIAN_MOBILE_RE.test(phone)) return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!isApplicantType(raw.employmentType ?? raw.applicantType)) {
    return { ok: false, error: "Please select whether you are salaried or self employed." };
  }
  return {
    ok: true,
    value: { name, phone, email, applicantType: (raw.employmentType ?? raw.applicantType) as ApplicantType },
  };
}
