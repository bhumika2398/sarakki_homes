import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { buildExportWorkbook } from "@/lib/propertyImport/workbook";

// Exports every property (any status, not just published — this is the
// CRM's own working copy of the data, not the public site) into the same
// column layout the importer reads, so "export, edit in Excel, re-import"
// is a safe round trip: every row already carries its Property ID.
export async function GET() {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  try {
    const properties = await prisma.property.findMany({
      include: {
        category: { select: { title: true } },
        builder: { select: { name: true } },
        propertyType: { select: { name: true } },
      },
      orderBy: { propertyId: "asc" },
    });

    const buffer = await buildExportWorkbook(
      properties.map((p) => ({
        propertyId: p.propertyId,
        title: p.title,
        type: p.propertyType.name,
        categoryTitle: p.category.title,
        builderName: p.builder?.name ?? null,
        price: p.price,
        priceValueLakh: p.priceValueLakh,
        expectedPrice: p.expectedPrice,
        location: p.location,
        address: p.address,
        mapQuery: p.mapQuery,
        beds: p.beds,
        baths: p.baths,
        area: p.area,
        areaSqft: p.areaSqft,
        description: p.description,
        status: p.status,
        featured: p.featured,
      }))
    );

    const dateStamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sarakki-homes-properties-${dateStamp}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("[api/admin/properties/export] failed:", error);
    return NextResponse.json({ error: "Could not export properties. Please try again." }, { status: 500 });
  }
}
