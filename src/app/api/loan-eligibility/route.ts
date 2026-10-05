import { NextResponse } from "next/server";
import { validateLoanApplicant } from "@/lib/loanDocuments";
import { submitLoanApplication } from "@/lib/loanApplications";

// SECURITY: this route is public (no auth — it's the "Check Your Loan
// Eligibility" form on the Bank Loan Arrangement service page), so every
// response is deliberately generic. Raw Prisma/DB errors are logged
// server-side only, never echoed to the browser. Mirrors
// /api/enquiries's shape (honeypot, generic errors).
//
// Persistence lives in src/lib/loanApplications.ts and is shared with the
// CRM's "New application" form: both create the same LoanApplication
// (+ Lead link) and de-duplicate the same way, so nothing is stored twice.
const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request.");
  }

  // Honeypot — same convention as /api/enquiries: a field a real visitor
  // never sees or fills, a bot scraping the form usually does.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ success: true });
  }

  const parsed = validateLoanApplicant(body);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const { application } = await submitLoanApplication(parsed.value, { source: "Website", author: "Website" });
    return NextResponse.json({ success: true, leadId: application.leadId, applicationId: application.id });
  } catch (error: unknown) {
    console.error("[api/loan-eligibility] POST failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
