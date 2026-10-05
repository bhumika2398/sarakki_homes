import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { LOCALITY_ZONES } from "@/lib/localityMatch";
import { isMissingSchemaError } from "@/lib/localities";

const MISSING_TABLE = "The Locality table has not been created yet. Run prisma db push (see prisma/sql/2026-10-locality.sql).";

const GENERIC_ERROR = "Something went wrong. Please try again.";
type Ctx = { params: Promise<{ id: string }> };

/** Rename/correct a locality. Records whose Property.locality or
 *  Lead.location equal the OLD name exactly are moved to the new name so
 *  a spelling correction doesn't orphan them; free-text addresses
 *  (Property.location) are never rewritten. */
export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = await req.json();
    const existing = await prisma.locality.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Locality not found" }, { status: 404 });

    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : existing.name;
    if (name.length < 2) return NextResponse.json({ error: "Locality name is required." }, { status: 400 });
    const zone =
      body.zone === undefined
        ? existing.zone
        : (LOCALITY_ZONES as readonly string[]).includes(body.zone)
          ? body.zone
          : null;

    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      const clash = await prisma.locality.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (clash) return NextResponse.json({ error: `"${clash.name}" is already in the list.` }, { status: 409 });
    }

    const renamed = name !== existing.name;
    const locality = await prisma.locality.update({ where: { id }, data: { name, zone } });
    let properties = 0;
    let leads = 0;
    if (renamed) {
      properties = (await prisma.property.updateMany({ where: { locality: existing.name }, data: { locality: name } })).count;
      leads = (await prisma.lead.updateMany({ where: { location: existing.name }, data: { location: name } })).count;
    }
    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE_LOCALITY",
        details: `Locality "${existing.name}" → "${name}" (${properties} properties, ${leads} leads updated)`,
      },
    });
    revalidateTag("localities", { expire: 0 });
    revalidateTag("properties", { expire: 0 });
    return NextResponse.json({ locality, updated: { properties, leads } });
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: MISSING_TABLE, missingTable: true }, { status: 503 });
    console.error("[api/admin/localities/[id]] PUT failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole(CAN.DELETE_CONTENT);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const existing = await prisma.locality.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Locality not found" }, { status: 404 });
    await prisma.locality.delete({ where: { id } });
    await prisma.activityLog.create({
      data: { userId: auth.user.id, action: "DELETE_LOCALITY", details: `Removed locality: ${existing.name}` },
    });
    revalidateTag("localities", { expire: 0 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: MISSING_TABLE, missingTable: true }, { status: 503 });
    console.error("[api/admin/localities/[id]] DELETE failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
