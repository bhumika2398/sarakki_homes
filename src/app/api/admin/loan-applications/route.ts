import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { validateLoanApplicant } from "@/lib/loanDocuments";
import { submitLoanApplication } from "@/lib/loanApplications";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function GET() {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;

  try {
    const applications = await prisma.loanApplication.findMany({
      include: {
        documents: { select: { id: true, received: true } },
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications] GET failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    // Same validator (and messages) as the public website route.
    const parsed = validateLoanApplicant(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { application, duplicate } = await submitLoanApplication(parsed.value, {
      source: "CRM",
      author: auth.user.name ?? "Staff",
    });
    return NextResponse.json({ application, duplicate });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications] POST failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
