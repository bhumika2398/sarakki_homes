import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { LOAN_STATUSES } from "@/lib/loanDocuments";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const application = await prisma.loanApplication.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { label: "asc" } },
        lead: { select: { id: true, name: true } },
      },
    });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json({ application });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications/[id]] GET failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const body = await req.json();
    const data: { status?: string; notes?: string | null } = {};

    if (body.status !== undefined) {
      if (!(LOAN_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      data.status = body.status;
    }
    if (body.notes !== undefined) {
      data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const existing = await prisma.loanApplication.findUnique({ where: { id }, select: { status: true, leadId: true } });
    if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const application = await prisma.loanApplication.update({ where: { id }, data });

    if (data.status && data.status !== existing.status && existing.leadId) {
      await prisma.leadTimelineEntry.create({
        data: {
          leadId: existing.leadId,
          type: "NOTE",
          title: "Loan application status changed",
          description: `${existing.status} → ${data.status}`,
          author: auth.user.name ?? "Staff",
        },
      });
    }

    return NextResponse.json({ application });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications/[id]] PATCH failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
