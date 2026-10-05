/**
 * Makes full-rupee price the single source of truth for every Property:
 *
 *   expectedPrice   = existing expectedPrice, else priceValueLakh × 100000
 *   priceValueLakh  = expectedPrice / 100000        (deprecated, derived)
 *   price           = "₹1,25,00,000" [/ month]     (display string)
 *
 * The old priceValueLakh column is kept (public budget filter + admin
 * sort still read it) and is never dropped. Properties with no price
 * (0 lakh, no expectedPrice) are left as "Price on request".
 *
 * Where a property already had an explicit expectedPrice that disagrees
 * with its lakh figure by more than 1%, the explicit rupee value wins
 * and the row is listed as a MISMATCH so you can eyeball it.
 *
 *   npx tsx prisma/backfill-price-rupees.ts          # dry run (default)
 *   npx tsx prisma/backfill-price-rupees.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { priceDisplay, rupeesToLakh } from "../src/lib/formatPrice";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const props = await prisma.property.findMany({
    select: { id: true, propertyId: true, title: true, price: true, priceValueLakh: true, expectedPrice: true, purpose: true },
    orderBy: { propertyId: "asc" },
  });

  let changed = 0;
  let unchanged = 0;
  let noPrice = 0;
  const mismatches: string[] = [];

  for (const p of props) {
    const fromLakh = Math.round(p.priceValueLakh * 100000);
    const rupees = p.expectedPrice != null && p.expectedPrice > 0 ? Math.round(p.expectedPrice) : fromLakh;

    if (rupees <= 0) {
      noPrice++;
      console.log(`  skip     ${p.propertyId} "${p.title}" — no price ("${p.price}")`);
      continue;
    }
    if (p.expectedPrice != null && fromLakh > 0 && Math.abs(p.expectedPrice - fromLakh) / fromLakh > 0.01) {
      mismatches.push(`${p.propertyId}: expectedPrice ${p.expectedPrice} vs lakh ${p.priceValueLakh} (= ${fromLakh})`);
    }

    const data = { expectedPrice: rupees, priceValueLakh: rupeesToLakh(rupees), price: priceDisplay(rupees, p.purpose) };
    const same = p.expectedPrice === data.expectedPrice && p.price === data.price && p.priceValueLakh === data.priceValueLakh;
    if (same) {
      unchanged++;
      continue;
    }
    changed++;
    console.log(`  convert  ${p.propertyId} "${p.title}": "${p.price}" (${p.priceValueLakh} lakh) -> "${data.price}"`);
    if (apply) await prisma.property.update({ where: { id: p.id }, data });
  }

  console.log(
    `\n${props.length} properties — ${changed} ${apply ? "converted" : "would be converted"}, ${unchanged} already correct, ${noPrice} without a price.`
  );
  if (mismatches.length) {
    console.log("\nMISMATCH (explicit rupee value kept):");
    mismatches.forEach((m) => console.log("  " + m));
  }
  if (!apply) console.log("\nDry run only. Re-run with --apply to write.");
}

main().finally(() => prisma.$disconnect());
