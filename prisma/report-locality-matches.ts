/**
 * Maps legacy free-text locations onto the Locality list and REPORTS
 * what matched and what didn't. Read-only by default. With --apply it
 * only fills Property.locality where that is currently empty and the
 * match is exact/near; it never overwrites Property.location,
 * Lead.location or an existing Property.locality.
 *
 *   npx tsx prisma/report-locality-matches.ts          # report only
 *   npx tsx prisma/report-locality-matches.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { matchLocality } from "../src/lib/localityMatch";
import { BENGALURU_LOCALITIES } from "../src/lib/bengaluruLocalities";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.locality.findMany({ select: { name: true } });
  const names = rows.length ? rows.map((r) => r.name) : [...BENGALURU_LOCALITIES];
  console.log(`Using ${names.length} localities (${rows.length ? "Locality table" : "seed list — table empty"}).\n`);

  const props = await prisma.property.findMany({ select: { id: true, propertyId: true, location: true, locality: true } });
  let exact = 0;
  let near = 0;
  let filled = 0;
  const unmatched: string[] = [];
  for (const p of props) {
    const m = matchLocality(p.locality || p.location, names);
    if (!m) {
      unmatched.push(`${p.propertyId}: "${p.location}"`);
      continue;
    }
    if (m.kind === "exact") exact++;
    else {
      near++;
      console.log(`  near  ${p.propertyId}: "${p.location}" -> ${m.name}`);
    }
    if (apply && !p.locality) {
      await prisma.property.update({ where: { id: p.id }, data: { locality: m.name } });
      filled++;
    }
  }
  console.log(
    `\nProperties: ${props.length} total — ${exact} exact, ${near} near, ${unmatched.length} unmatched.${apply ? ` Filled locality on ${filled}.` : ""}`
  );
  unmatched.forEach((u) => console.log("  UNMATCHED " + u));

  const leads = await prisma.lead.findMany({ where: { location: { not: null } }, select: { id: true, name: true, location: true } });
  const leadUnmatched = leads.filter((l) => !matchLocality(l.location, names));
  console.log(
    `\nLeads with a location: ${leads.length} — ${leads.length - leadUnmatched.length} match, ${leadUnmatched.length} unmatched (never modified).`
  );
  leadUnmatched.forEach((l) => console.log(`  UNMATCHED lead "${l.name}": "${l.location}"`));
}

main().finally(() => prisma.$disconnect());
