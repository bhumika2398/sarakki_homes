import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { LOAN_FINAL_STATUSES, normalizePhone } from "@/lib/loanDocuments";
import {
  CORRECTABLE_FIELDS,
  validateLeadCorrection,
  type CorrectableField,
  type CorrectionValue,
} from "@/lib/leadCorrection";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/**
 * Correct recorded details on the EXISTING lead (never a duplicate).
 * Restricted to CAN.CORRECT_LEADS. Each changed field becomes one
 * timeline entry (who / field / old → new / when), so the audit trail
 * shows in the lead's Timeline tab.
 *
 * A phone that already belongs to a different lead is refused with 409
 * and the other lead's id, so the user can open it instead.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CAN.CORRECT_LEADS);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validateLeadCorrection(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // Only fields whose value actually differs.
    const changes: { field: CorrectableField; oldValue: unknown; newValue: CorrectionValue }[] = [];
    for (const field of Object.keys(parsed.value) as CorrectableField[]) {
      const newValue = parsed.value[field] ?? null;
      const oldValue = existing[field] ?? null;
      const same =
        field === "phone" ? normalizePhone(String(oldValue ?? "")) === newValue : String(oldValue ?? "") === String(newValue ?? "");
      if (!same) changes.push({ field, oldValue, newValue });
    }
    if (changes.length === 0) return NextResponse.json({ lead: existing, changed: [] });

    const phoneChange = changes.find((c) => c.field === "phone");
    if (phoneChange) {
      const digits = phoneChange.newValue as string;
      const candidates = await prisma.lead.findMany({
        where: { id: { not: id }, phone: { contains: digits.slice(-4) } },
        select: { id: true, name: true, phone: true },
      });
      const clash = candidates.find((l) => normalizePhone(l.phone) === digits);
      if (clash) {
        return NextResponse.json(
          {
            error: `This phone number already belongs to another lead (${clash.name}). Open that lead instead, or use a different number.`,
            conflict: { id: clash.id, name: clash.name },
          },
          { status: 409 }
        );
      }
    }

    const author = auth.user.name ?? auth.user.email ?? "Admin";
    const data = Object.fromEntries(changes.map((c) => [c.field, c.newValue]));

    const [lead] = await prisma.$transaction([
      prisma.lead.update({ where: { id }, data }),
      ...changes.map((c) =>
        prisma.leadTimelineEntry.create({
          data: {
            leadId: id,
            type: "CORRECTION",
            title: `Corrected ${CORRECTABLE_FIELDS[c.field]}`,
            description: `${show(c.oldValue)} → ${show(c.newValue)}`,
            author,
          },
        })
      ),
    ]);

    // Loan applications keep a copy of name/phone/email (used for their
    // de-duplication). Keep open applications in step so the link and the
    // "same person" check still work after a correction; finished ones
    // keep what was recorded at the time.
    const contact: Record<string, string> = {};
    for (const c of changes) {
      if (c.field === "name" || c.field === "phone" || c.field === "email") contact[c.field] = c.newValue as string;
    }
    let loanApplicationsUpdated = 0;
    if (Object.keys(contact).length > 0) {
      loanApplicationsUpdated = (
        await prisma.loanApplication.updateMany({
          where: { leadId: id, status: { notIn: [...LOAN_FINAL_STATUSES] } },
          data: contact,
        })
      ).count;
    }

    return NextResponse.json({ lead, changed: changes.map((c) => c.field), loanApplicationsUpdated });
  } catch (error: unknown) {
    console.error("[api/admin/leads/[id]/correct] PATCH failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
