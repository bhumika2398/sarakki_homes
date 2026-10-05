import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { priceDisplay } from "@/lib/formatPrice";
import type { ValidRow } from "./validateRows";

export interface CommitRowResult {
  rowNumber: number;
  propertyId: string;
  propertyName: string;
  slug?: string;
  action: "create" | "update";
  ok: boolean;
  error?: string;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "property";
}

/** Same core write logic as the manual Property create/update API routes
 *  (src/app/api/admin/properties/route.ts and [id]/route.ts) — reused
 *  here rather than duplicated, so an Excel-imported property follows
 *  exactly the same business rules (propertyId format, slug generation,
 *  images/auction/loan relations left untouched unless explicitly sent)
 *  as one entered by hand through the wizard.
 *
 *  Processes one chunk of already-validated rows in a single DB
 *  transaction — atomic within the chunk (all-or-nothing for these rows),
 *  but chunks are independent of each other so one bad chunk can't roll
 *  back rows a previous chunk already committed. This is what lets the
 *  UI show real progress across a 200+ row file without either doing
 *  hundreds of individual requests or risking one giant transaction
 *  timing out. */
export async function commitRowsChunk(rows: ValidRow[], userId: string): Promise<CommitRowResult[]> {
  if (rows.length === 0) return [];

  // Property IDs are assigned sequentially (SH-1001, SH-1002, ...) — read
  // the current high-water mark once, then hand out increments in-memory
  // for every "create" row in this chunk so two new rows in the same
  // chunk never collide with each other.
  const lastProperty = await prisma.property.findFirst({ orderBy: { propertyId: "desc" } });
  let nextIdNum = 1001;
  if (lastProperty?.propertyId) {
    const match = lastProperty.propertyId.match(/SH-(\d+)/);
    if (match) nextIdNum = parseInt(match[1], 10) + 1;
  }

  // Slugs must be unique too — track every slug this chunk has already
  // claimed (plus what's already in the DB) so two similarly-named new
  // properties in the same file don't collide on the unique constraint.
  const existingSlugs = new Set(
    (await prisma.property.findMany({ select: { slug: true } })).map((p) => p.slug)
  );

  const results: CommitRowResult[] = [];

  for (const row of rows) {
    try {
      if (row.action === "create") {
        const propertyId = `SH-${nextIdNum++}`;
        let slug = slugify(row.data.title);
        let suffix = 2;
        while (existingSlugs.has(slug)) {
          slug = `${slugify(row.data.title)}-${suffix++}`;
        }
        existingSlugs.add(slug);

        // For a brand-new property anything the sheet didn't give (null)
        // falls back to the exact same default the manual "Add Property"
        // form uses. `categoryId`/`propertyTypeId` are guaranteed non-null
        // for a create by validateAndResolveRows (matched, or the
        // fallback category/type).
        const d = row.data;
        const created = await prisma.property.create({
          data: {
            propertyId,
            slug,
            title: d.title,
            location: d.location ?? "",
            price: d.price ?? "Price on request",
            priceValueLakh: d.priceValueLakh ?? 0,
            expectedPrice: d.expectedPrice,
            locality: d.locality,
            propertyTypeId: d.propertyTypeId!,
            // Client decision: imported properties should appear on the
            // website immediately rather than sit as an unreviewed draft
            // (previously defaulted to UNPUBLISHED here) — an explicit
            // Status column in the sheet still overrides this per row.
            status: d.status ?? "PUBLISHED",
            featured: d.featured ?? "false",
            beds: d.beds ?? 0,
            baths: d.baths ?? 0,
            area: d.area ?? "",
            areaSqft: d.areaSqft ?? 0,
            description: d.description ?? "",
            address: d.address ?? "",
            mapQuery: d.mapQuery ?? "",
            categoryId: d.categoryId!,
            builderId: d.builderId,
          },
        });

        results.push({
          rowNumber: row.rowNumber,
          propertyId: created.propertyId,
          propertyName: created.title,
          slug: created.slug,
          action: "create",
          ok: true,
        });
      } else {
        // Update — ONLY the 4 always-required fields plus whatever
        // optional cells the sheet actually filled in are written. A
        // blank optional cell (null) is left exactly as it is, so
        // exporting, changing one column, and re-importing never wipes
        // the fields you didn't touch. `images` is never part of this
        // write at all, so existing Cover Image / Gallery photos are
        // always left completely alone.
        const d = row.data;
        // title is the one field always present (a row with no name is
        // rejected earlier); everything else is written only when the
        // sheet actually gave it, so an update never blanks a field the
        // upload left out.
        const updateData: Prisma.PropertyUpdateInput = { title: d.title };
        if (d.price !== null) updateData.price = d.price;
        if (d.propertyTypeId !== null) updateData.propertyType = { connect: { id: d.propertyTypeId } };
        if (d.categoryId !== null) updateData.category = { connect: { id: d.categoryId } };
        if (d.priceValueLakh !== null) updateData.priceValueLakh = d.priceValueLakh;
        if (d.expectedPrice !== null) {
          updateData.expectedPrice = d.expectedPrice;
          // Rent listings show "/ month"; the sheet has no Purpose column,
          // so honour the property's existing purpose.
          const current = await prisma.property.findUnique({ where: { id: row.targetId! }, select: { purpose: true } });
          updateData.price = priceDisplay(d.expectedPrice, current?.purpose);
        }
        if (d.locality !== null) updateData.locality = d.locality;
        if (d.location !== null) updateData.location = d.location;
        if (d.address !== null) updateData.address = d.address;
        if (d.mapQuery !== null) updateData.mapQuery = d.mapQuery;
        if (d.beds !== null) updateData.beds = d.beds;
        if (d.baths !== null) updateData.baths = d.baths;
        if (d.area !== null) updateData.area = d.area;
        if (d.areaSqft !== null) updateData.areaSqft = d.areaSqft;
        if (d.description !== null) updateData.description = d.description;
        if (d.status !== null) updateData.status = d.status;
        if (d.featured !== null) updateData.featured = d.featured;
        if (d.builderId !== null) updateData.builder = { connect: { id: d.builderId } };

        const updated = await prisma.property.update({ where: { id: row.targetId! }, data: updateData });

        results.push({
          rowNumber: row.rowNumber,
          propertyId: updated.propertyId,
          propertyName: updated.title,
          slug: updated.slug,
          action: "update",
          ok: true,
        });
      }
    } catch (error: unknown) {
      results.push({
        rowNumber: row.rowNumber,
        propertyId: row.propertyId,
        propertyName: row.data.title,
        action: row.action,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error while saving this row.",
      });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: "IMPORT_PROPERTIES",
      details: `Excel import: ${results.filter((r) => r.ok && r.action === "create").length} created, ${
        results.filter((r) => r.ok && r.action === "update").length
      } updated, ${results.filter((r) => !r.ok).length} failed (this chunk).`,
    },
  });

  return results;
}
