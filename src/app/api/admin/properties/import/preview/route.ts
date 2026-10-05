import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { parseUploadedWorkbook } from "@/lib/propertyImport/workbook";
import { validateAndResolveRows, type ReferenceData } from "@/lib/propertyImport/validateRows";
import { getLocalityNames } from "@/lib/localities";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — hundreds of text rows, plenty of headroom
const MAX_ROWS = 5000; // sanity cap so a malformed/huge file can't hang the request

// Parses + validates an uploaded workbook and returns what WOULD happen —
// no database writes here. The browser gets back the full set of
// already-resolved valid rows (categoryId/builderId looked up, create-vs-
// -update decided) so the confirm step can commit them in chunks without
// re-uploading or re-parsing the file.
export async function POST(req: Request) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = await parseUploadedWorkbook(buffer);
    if (!parsed) {
      return NextResponse.json(
        { error: "That file couldn't be read. Please upload an Excel (.xlsx) or CSV file — the template downloaded from this page works." },
        { status: 400 }
      );
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "That file has no property rows to import." }, { status: 400 });
    }
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That file has too many rows (max ${MAX_ROWS} at a time). Please split it into smaller files.` },
        { status: 400 }
      );
    }

    const localities = await getLocalityNames();
    const [categories, builders, propertyTypes, existingProperties] = await Promise.all([
      prisma.category.findMany({ select: { id: true, title: true } }),
      prisma.builder.findMany({ select: { id: true, name: true } }),
      prisma.propertyType.findMany({ select: { id: true, name: true } }),
      prisma.property.findMany({ select: { id: true, propertyId: true } }),
    ]);

    const ref: ReferenceData = {
      categories: new Map(categories.map((c) => [c.title.toLowerCase().trim(), c])),
      builders: new Map(builders.map((b) => [b.name.toLowerCase().trim(), b])),
      propertyTypes: new Map(propertyTypes.map((t) => [t.name.toLowerCase().trim(), t])),
      localities,
      existingPropertyIds: new Map(existingProperties.map((p) => [p.propertyId, p.id])),
    };

    const result = validateAndResolveRows(parsed.rows, ref);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[api/admin/properties/import/preview] failed:", error);
    return NextResponse.json({ error: "Something went wrong reading that file. Please try again." }, { status: 500 });
  }
}
