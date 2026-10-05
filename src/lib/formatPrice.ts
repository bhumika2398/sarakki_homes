/**
 * Prices are stored and entered as whole rupees (Property.expectedPrice)
 * and shown with Indian digit grouping: 12500000 -> "₹1,25,00,000".
 * Lakh/crore abbreviations are never the primary display.
 */

export function formatRupees(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "Price on request";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Listing display string stored in Property.price. Rent is per month. */
export function priceDisplay(amount: number, purpose: string | null | undefined): string {
  const base = formatRupees(amount);
  return purpose === "Rent" && amount > 0 ? `${base} / month` : base;
}

/** Derived value for the deprecated Property.priceValueLakh column
 *  (still used by the public budget filter and admin sort). */
export function rupeesToLakh(amount: number): number {
  return Math.round((amount / 100000) * 100) / 100;
}

/** Sale prices under ₹1,00,000 are almost certainly lakhs typed by habit. */
export function looksLikeLakhs(amount: number, purpose: string | null | undefined): boolean {
  return purpose !== "Rent" && amount > 0 && amount < 100000;
}
