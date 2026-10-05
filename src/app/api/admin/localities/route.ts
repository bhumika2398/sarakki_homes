import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { LOCALITY_ZONES } from "@/lib/localityMatch";
import { isMissingSchemaError } from "@/lib/localities";

const MISSING_TABLE = "The Locality table has not been created yet. Run prisma db push (see prisma/sql/2026-10-locality.sql).";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function GET() {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;
  try {
    const localities = await prisma.locality.findMany({ orderBy: { name: "asc" } });
    // Usage is by exact name (Property.locality / Lead.location are text).
    const [props, leads] = await Promise.all([
      prisma.property.groupBy({ by: ["locality"], _count: { _all: true }, where: { locality: { not: null } } }),
      prisma.lead.groupBy({ by: ["location"], _count: { _all: true }, where: { location: { not: null } } }),
    ]);
    const p = new Map(props.map((r) => [r.locality, r._count._all]));
    const l = new Map(leads.map((r) => [r.location, r._count._all]));
    return NextResponse.json({
      localities: localities.map((x) => ({ ...x, properties: p.get(x.name) ?? 0, leads: l.get(x.name) ?? 0 })),
    });
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) return NextResponse.json({ localities: [], missingTable: true, error: MISSING_TABLE });
    console.error("[api/admin/localities] GET failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2) return NextResponse.json({ error: "Locality name is required." }, { status: 400 });
    const zone = (LOCALITY_ZONES as readonly string[]).includes(body.zone) ? body.zone : null;

    const clash = await prisma.locality.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (clash) return NextResponse.json({ error: `"${clash.name}" is already in the list.` }, { status: 409 });

    const locality = await prisma.locality.create({ data: { name, zone } });
    await prisma.activityLog.create({
      data: { userId: auth.user.id, action: "CREATE_LOCALITY", details: `Added locality: ${name}` },
    });
    revalidateTag("localities", { expire: 0 });
    return NextResponse.json({ locality });
  } catch (error: unknown) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: MISSING_TABLE, missingTable: true }, { status: 503 });
    console.error("[api/admin/localities] POST failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
