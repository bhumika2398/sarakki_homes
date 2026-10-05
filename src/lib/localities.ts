import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BENGALURU_LOCALITIES } from "@/lib/bengaluruLocalities";
import { safeDbCall } from "@/lib/db-safe";

/**
 * The shared Bengaluru locality list. The Locality table is the source
 * of truth (edited in /admin/localities); BENGALURU_LOCALITIES is the
 * fallback when the table is missing, empty or unreachable, so the
 * public website and every picker keep working.
 */

/** P2021 = table doesn't exist, P2022 = column doesn't exist: the schema
 *  change hasn't been applied to this database yet. */
export function isMissingSchemaError(error: unknown): boolean {
  // Duck-typed on `code` as well as instanceof: errors that crossed the
  // unstable_cache boundary aren't guaranteed to keep their class.
  const code = (error as { code?: unknown } | null)?.code;
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError || typeof code === "string") &&
    (code === "P2021" || code === "P2022")
  );
}

const fallbackNames = () => [...BENGALURU_LOCALITIES].sort((a, b) => a.localeCompare(b));

// Only real DB results are cached (a thrown error is never cached), and
// only for a minute, so a freshly created/seeded table is picked up fast.
// Admin edits also call revalidateTag("localities").
const getCachedLocalityNames = unstable_cache(
  async () => {
    const rows = await prisma.locality.findMany({ select: { name: true }, orderBy: { name: "asc" } });
    return rows.map((r) => r.name);
  },
  ["locality-names"],
  { revalidate: 60, tags: ["localities"] }
);

let warnedMissing = false;

export async function getLocalityNames(): Promise<string[]> {
  try {
    const names = await safeDbCall(getCachedLocalityNames, [] as string[], "getLocalityNames");
    return names.length > 0 ? names : fallbackNames();
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[localities] Locality table missing, using static list. Run prisma db push.");
    }
    return fallbackNames();
  }
}
