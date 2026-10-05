/**
 * One-off: recover Property.areaSqft from the legacy display text.
 *
 * Older listings stored area only as text in `area` ("3,200 sq.ft") with
 * `areaSqft` left at 0. The wizard now has a single numeric "Area (sqft)"
 * input, so those rows would open blank. This copies the first number in
 * `area` into `areaSqft` where areaSqft is 0 and the text holds a valid
 * positive number. Nothing is deleted; rows with no parseable number are
 * left alone and listed.
 *
 *   npx tsx prisma/backfill-area-sqft.ts          # dry run
 *   npx tsx prisma/backfill-area-sqft.ts --apply  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.property.findMany({
    where: { areaSqft: 0 },
    select: { id: true, propertyId: true, area: true },
  });

  let migrated = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const m = r.area.replace(/,/g, "").match(/\d+(\.\d+)?/);
    const n = m ? Math.round(parseFloat(m[0])) : 0;
    if (n > 0) {
      console.log(`${r.propertyId}: "${r.area}" -> ${n}`);
      if (apply) await prisma.property.update({ where: { id: r.id }, data: { areaSqft: n } });
      migrated++;
    } else {
      skipped.push(`${r.propertyId} ("${r.area}")`);
    }
  }
  console.log(`\n${apply ? "Updated" : "Would update"} ${migrated} of ${rows.length} properties with areaSqft = 0.`);
  if (skipped.length) console.log(`No number found, left unchanged: ${skipped.join(", ")}`);
}

main().finally(() => prisma.$disconnect());
