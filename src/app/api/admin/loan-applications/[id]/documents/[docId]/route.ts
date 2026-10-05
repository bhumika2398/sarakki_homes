import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { syncStatusWithDocuments } from "@/lib/loanApplications";

/**
 * One checklist document on a loan application:
 *   PATCH  { received: boolean }  — mark received / not received
 *   POST   multipart "file"       — upload the document (marks it received)
 *   GET                           — redirect to a short-lived signed URL
 *
 * SECURITY: these are KYC documents (PAN, Aadhaar, bank statements), so
 * unlike property images and brochures they go to a PRIVATE Storage
 * bucket and are only ever served through a signed URL that requires a
 * signed-in staff session to obtain. Create a bucket named
 * 'loan-documents' in Supabase and leave it NOT public.
 */

const BUCKET = "loan-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const GENERIC_ERROR = "Something went wrong. Please try again.";

type Ctx = { params: Promise<{ id: string; docId: string }> };

async function loadDocument(id: string, docId: string) {
  return prisma.loanDocument.findFirst({ where: { id: docId, applicationId: id } });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;
  const { id, docId } = await params;

  try {
    const body = await req.json();
    if (typeof body.received !== "boolean") {
      return NextResponse.json({ error: "received must be true or false." }, { status: 400 });
    }
    const doc = await loadDocument(id, docId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const document = await prisma.loanDocument.update({
      where: { id: docId },
      data: { received: body.received, receivedAt: body.received ? new Date() : null },
    });
    await syncStatusWithDocuments(id);
    const application = await prisma.loanApplication.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json({ document, status: application?.status });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications/documents] PATCH failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;
  const { id, docId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "File uploads are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and create a PRIVATE Storage bucket named 'loan-documents' in Supabase. You can still mark the document as received.",
      },
      { status: 501 }
    );
  }

  try {
    const doc = await loadDocument(id, docId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was received." }, { status: 400 });
    const ext = ALLOWED_EXTENSIONS[file.type];
    if (!ext) return NextResponse.json({ error: "Only PDF, JPEG or PNG files are allowed." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).` }, { status: 400 });
    }

    // Client filename is never reused; path is namespaced per application.
    const objectPath = `${id}/${crypto.randomUUID()}.${ext}`;
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": file.type },
      body: await file.arrayBuffer(),
    });
    if (!uploadRes.ok) {
      console.error("[loan-documents] Storage rejected the upload:", uploadRes.status, await uploadRes.text());
      return NextResponse.json(
        {
          error:
            uploadRes.status === 404
              ? `Storage bucket '${BUCKET}' does not exist. Create it in Supabase → Storage (keep it private).`
              : "Upload failed. Please try again.",
        },
        { status: 502 }
      );
    }

    const document = await prisma.loanDocument.update({
      where: { id: docId },
      data: { fileUrl: objectPath, received: true, receivedAt: doc.receivedAt ?? new Date() },
    });
    await syncStatusWithDocuments(id);
    const application = await prisma.loanApplication.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json({ document, status: application?.status });
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications/documents] POST failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireRole(CAN.MANAGE_CRM);
  if (!auth.ok) return auth.response;
  const { id, docId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 501 });
  }

  try {
    const doc = await loadDocument(id, docId);
    if (!doc?.fileUrl) return NextResponse.json({ error: "No file uploaded." }, { status: 404 });

    const signRes = await fetch(`${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${doc.fileUrl}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 120 }),
    });
    if (!signRes.ok) {
      console.error("[loan-documents] sign failed:", signRes.status, await signRes.text());
      return NextResponse.json({ error: "Couldn't open the file." }, { status: 502 });
    }
    const { signedURL } = (await signRes.json()) as { signedURL: string };
    return NextResponse.redirect(`${supabaseUrl}/storage/v1${signedURL}`);
  } catch (error: unknown) {
    console.error("[api/admin/loan-applications/documents] GET failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
