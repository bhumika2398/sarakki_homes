/**
 * Matching free-text locations ("Whitefield, Bengaluru", "koramangala 4th
 * block") onto the shared Locality list. Pure and client-safe. Never
 * guesses between two candidates: an ambiguous input returns null so the
 * caller reports it instead of picking one.
 */

export type LocalityMatchKind = "exact" | "near";
export interface LocalityMatch {
  name: string;
  kind: LocalityMatchKind;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function matchLocality(raw: string | null | undefined, names: readonly string[]): LocalityMatch | null {
  const text = norm(raw ?? "");
  if (!text) return null;

  const byNorm = new Map(names.map((n) => [norm(n), n]));
  const exact = byNorm.get(text);
  if (exact) return { name: exact, kind: "exact" };

  // The first comma-separated segment is usually the area ("Whitefield, Bengaluru").
  const first = norm((raw ?? "").split(",")[0]);
  const firstExact = byNorm.get(first);
  if (firstExact) return { name: firstExact, kind: "near" };

  // A locality name appearing as whole words inside the text ("koramangala 4th block").
  const padded = ` ${text} `;
  const contained = [...byNorm].filter(([n]) => padded.includes(` ${n} `));
  if (contained.length > 0) {
    const longest = Math.max(...contained.map(([n]) => n.length));
    const best = contained.filter(([n]) => n.length === longest);
    return best.length === 1 ? { name: best[0][1], kind: "near" } : null;
  }

  // Small typos on the leading segment ("koramangla"); only for names long enough to be safe.
  if (first.length >= 6) {
    const close = [...byNorm].filter(([n]) => n.length >= 6 && editDistance(first, n) <= 1);
    if (close.length === 1) return { name: close[0][1], kind: "near" };
  }
  return null;
}
export const LOCALITY_ZONES = ["North", "South", "East", "West", "Central"] as const;
