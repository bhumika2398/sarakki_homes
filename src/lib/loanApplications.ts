import { prisma } from "@/lib/prisma";
import {
  LOAN_DOCUMENTS,
  LOAN_FINAL_STATUSES,
  normalizePhone,
  type LoanApplicantInput,
} from "@/lib/loanDocuments";

/**
 * The one place a loan-eligibility submission is persisted. Both the
 * public website form (/api/loan-eligibility) and the CRM form
 * (/api/admin/loan-applications) call this, so they write to the same
 * tables and apply the same de-duplication:
 *
 *  - An open application (not APPROVED / REJECTED / CLOSED) for the same
 *    phone + applicant type is returned as-is instead of creating a
 *    second one.
 *  - The application is linked to the existing Lead with that phone
 *    number, or a new Lead is created when there isn't one — so a person
 *    who is already in the pipeline isn't duplicated as a second lead.
 */

export type LoanSource = "Website" | "CRM";

export async function submitLoanApplication(
  input: LoanApplicantInput,
  opts: { source: LoanSource; author: string }
) {
  const open = await prisma.loanApplication.findFirst({
    where: {
      phone: input.phone,
      applicantType: input.applicantType,
      status: { notIn: [...LOAN_FINAL_STATUSES] },
    },
    include: { documents: true },
    orderBy: { createdAt: "desc" },
  });

  if (open) {
    if (open.leadId) {
      await prisma.leadTimelineEntry.create({
        data: {
          leadId: open.leadId,
          type: "NOTE",
          title: "Loan eligibility re-submitted",
          description: `Submitted again via ${opts.source} (${input.applicantType}); the existing open application was kept.`,
          author: opts.author,
        },
      });
    }
    return { application: open, duplicate: true as const };
  }

  // Lead.phone is free text (staff type "+91 98450 12345"), so narrow by
  // the last four digits in SQL and compare normalised numbers in JS.
  const candidates = await prisma.lead.findMany({
    where: { phone: { contains: input.phone.slice(-4) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true },
  });
  const existingLead = candidates.find((l) => normalizePhone(l.phone) === input.phone);

  const timelineDescription = `Loan eligibility check submitted (${input.applicantType}) via ${opts.source}.`;

  const leadId = existingLead
    ? existingLead.id
    : (
        await prisma.lead.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            source: "Loan Eligibility Form",
            purpose: "Buy",
            propertyType: `Loan Eligibility – ${input.applicantType}`,
            stage: "NEW",
            priority: "MEDIUM",
            notes: {
              create: {
                author: opts.author,
                content: `Submitted the "Check Your Loan Eligibility" form as ${input.applicantType} (${opts.source}).`,
              },
            },
            timeline: {
              create: {
                type: "CREATED",
                title: "Lead created",
                description: timelineDescription,
                author: opts.author,
              },
            },
          },
          select: { id: true },
        })
      ).id;

  if (existingLead) {
    await prisma.leadTimelineEntry.create({
      data: {
        leadId,
        type: "NOTE",
        title: "Loan eligibility submitted",
        description: timelineDescription,
        author: opts.author,
      },
    });
  }

  const application = await prisma.loanApplication.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      applicantType: input.applicantType,
      source: opts.source,
      status: "NEW",
      leadId,
      documents: {
        create: LOAN_DOCUMENTS[input.applicantType].map((d) => ({ key: d.key, label: d.label })),
      },
    },
    include: { documents: true },
  });

  return { application, duplicate: false as const };
}

/**
 * Keeps the early statuses in step with the document checklist: all
 * documents received → DOCS_COMPLETE, some → DOCS_PENDING. Statuses a
 * person set by hand later in the process (IN_PROCESS onwards) are never
 * overridden.
 */
export async function syncStatusWithDocuments(applicationId: string) {
  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    select: { status: true, documents: { select: { received: true } } },
  });
  if (!app || !["NEW", "DOCS_PENDING", "DOCS_COMPLETE"].includes(app.status)) return;

  const total = app.documents.length;
  const got = app.documents.filter((d) => d.received).length;
  let next = app.status;
  if (total > 0 && got === total) next = "DOCS_COMPLETE";
  else if (got > 0) next = "DOCS_PENDING";
  else if (app.status === "DOCS_COMPLETE") next = "DOCS_PENDING";

  if (next !== app.status) {
    await prisma.loanApplication.update({ where: { id: applicationId }, data: { status: next } });
  }
}
