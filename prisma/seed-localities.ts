/**
 * Seeds the Locality table from src/lib/bengaluruLocalities.ts (the
 * existing website list — nothing invented). Idempotent: names already
 * present are skipped. Additions beyond that list go through the CRM's
 * /admin/localities screen after review.
 *
 *   npx tsx prisma/seed-localities.ts          # dry run
 *   npx tsx prisma/seed-localities.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { BENGALURU_LOCALITIES } from "../src/lib/bengaluruLocalities";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const existing = new Set((await prisma.locality.findMany({ select: { name: true } })).map((l) => l.name.toLowerCase()));
  const toAdd = BENGALURU_LOCALITIES.filter((n) => !existing.has(n.toLowerCase()));
  console.log(
    `${toAdd.length} of ${BENGALURU_LOCALITIES.length} localities ${apply ? "added" : "would be added"}; ${existing.size} already present.`
  );
  if (apply && toAdd.length) await prisma.locality.createMany({ data: toAdd.map((name) => ({ name })), skipDuplicates: true });
}

main().finally(() => prisma.$disconnect());
