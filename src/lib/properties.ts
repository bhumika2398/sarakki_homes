import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Property, MediaTone, PropertyCategorySlug } from "@/lib/data";
import { safeDbCall } from "@/lib/db-safe";
import { buildDetailSections, parseJsonList, propertyKindFor, type DetailSection } from "@/lib/propertyDetails";

// Every exported query below is wrapped in unstable_cache (Next's
// persistent Data Cache, keyed separately from route-level `revalidate`)
// rather than relying only on each page's own `export const revalidate`.
// That setting only populates the Full Route Cache, which `next dev`
// never does — so every local navigation re-ran these Prisma queries from
// scratch against the production Supabase DB in ap-northeast-1, at
// 1.3-3s+ measured round-trip per query from this project's dev network
// (see db-safe.ts). Wrapping here means repeat loads within the 60s
// window are served from cache with zero DB round trip, in dev exactly
// as in production.

// The public site's `Property` shape (src/lib/data.ts) was designed around
// a richer static dataset than what the admin CMS actually captures today
// (no amenities list, investment highlights, or multi-flat configurations
// in the schema). Every field the DB doesn't have is left `undefined`/`[]`
// below — the existing presentation components already render those
// sections conditionally, so this degrades gracefully rather than needing
// each component rewritten for the DB shape.

const PROPERTY_INCLUDE = {
  category: true,
  builder: true,
  propertyType: true,
  images: { orderBy: { order: "asc" as const } },
  auctionInfo: true,
  loanEligibility: true,
  documents: true,
} satisfies Prisma.PropertyInclude;

type DbProperty = Prisma.PropertyGetPayload<{ include: typeof PROPERTY_INCLUDE }>;

// Every card/list view (homepage featured grid, /properties, related
// properties) only ever reads title/location/price/beds/baths/area/the
// cover photo/the category tone from a Property — never gallery,
// auctionInfo, loanEligibility, or documents (confirmed: PropertyCard and
// PropertyListItem only touch `.image` and `.gallery[0]`, and
// auctionInfo is structurally impossible here anyway since these
// functions all exclude the bank-auctions category). The old
// PROPERTY_INCLUDE pulled every relation — the full image gallery, both
// optional 1:1 relations, every document row — for every property on
// every listing page regardless. This trims each list query to exactly
// what a card renders: one cover photo instead of the whole gallery, and
// none of the three detail-only relations at all.
const PROPERTY_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  location: true,
  price: true,
  priceValueLakh: true,
  propertyType: { select: { name: true } },
  beds: true,
  baths: true,
  area: true,
  areaSqft: true,
  featured: true,
  description: true,
  mapQuery: true,
  category: { select: { slug: true, tone: true } },
  images: { select: { url: true }, orderBy: { order: "asc" as const }, take: 1 },
} satisfies Prisma.PropertySelect;

type DbPropertyListItem = Prisma.PropertyGetPayload<{ select: typeof PROPERTY_LIST_SELECT }>;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  // Server-only formatting (this module imports prisma), so this can't
  // cause a hydration mismatch by itself -- the resulting string is
  // baked in once here and passed down as plain data. Pinned anyway so
  // the date is actually IST rather than whatever timezone the Node
  // process happens to be running in ("en-IN" already implied IST).
  timeZone: "Asia/Kolkata",
};

function toPublicProperty(p: DbProperty): Property {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    location: p.location,
    price: p.price,
    priceValueLakh: p.priceValueLakh,
    type: p.propertyType.name,
    // Categories are seeded from the same six slugs PropertyCategorySlug
    // covers, but the DB stores it as a plain string — cast at the
    // boundary rather than threading a wider type through every consumer.
    categorySlug: p.category.slug as PropertyCategorySlug,
    beds: p.beds,
    baths: p.baths,
    area: p.area,
    areaSqft: p.areaSqft,
    featured: p.featured === "true",
    description: p.description,
    image: p.images[0]?.url,
    gallery: [(p.category.tone as MediaTone) || "warm"],
    amenities: parseJsonList(p.amenities),
    investmentHighlights: [],
    auctionInfo: p.auctionInfo
      ? {
          bankName: p.auctionInfo.bankName,
          auctionDate: p.auctionInfo.auctionDate.toLocaleDateString("en-IN", DATE_FORMAT),
          reservePrice: p.auctionInfo.reservePrice,
          emd: p.auctionInfo.emd,
        }
      : undefined,
    loanEligibility: p.loanEligibility
      ? {
          maxLoanAmount: p.loanEligibility.maxLoanAmount,
          indicativeEmi: p.loanEligibility.indicativeEmi,
          partnerBanks: JSON.parse(p.loanEligibility.partnerBanks || "[]"),
        }
      : { maxLoanAmount: "Contact us for details", indicativeEmi: "Contact us for details", partnerBanks: [] },
    documents: p.documents.map((d) => d.name),
    mapQuery: p.mapQuery,
  };
}

/** Real, uploaded photo URLs for the gallery — separate from the `Property.image`
 *  cover shot and `gallery` placeholder-tone fallback, since PropertyGallery
 *  needs the *full* set, not just the first. */
export function getGalleryImages(p: DbProperty): string[] {
  return p.images.map((img) => img.url);
}

// Card/list counterpart of toPublicProperty — same output shape (still a
// full `Property`), but the detail-only fields it can't know without the
// relations this query never fetched are filled with the same constant
// fallback toPublicProperty already uses when a property genuinely has no
// loan/document data, rather than left to query for it.
function toPublicPropertyListItem(p: DbPropertyListItem): Property {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    location: p.location,
    price: p.price,
    priceValueLakh: p.priceValueLakh,
    type: p.propertyType.name,
    categorySlug: p.category.slug as PropertyCategorySlug,
    beds: p.beds,
    baths: p.baths,
    area: p.area,
    areaSqft: p.areaSqft,
    featured: p.featured === "true",
    description: p.description,
    image: p.images[0]?.url,
    gallery: [(p.category.tone as MediaTone) || "warm"],
    amenities: [],
    investmentHighlights: [],
    auctionInfo: undefined,
    loanEligibility: { maxLoanAmount: "Contact us for details", indicativeEmi: "Contact us for details", partnerBanks: [] },
    documents: [],
    mapQuery: p.mapQuery,
  };
}

// Bank auction properties have their own dedicated section
// (/properties/bank-auctions) with its own data layer (src/lib/auctions.ts)
// and never appear in the general property listing, homepage featured
// grid, or generic /properties/[slug] detail route — kept as a fully
// separate track per the client's explicit request that the two not mix.
const EXCLUDE_BANK_AUCTIONS = { category: { slug: { not: "bank-auctions" } } };

const getCachedPublishedProperties = unstable_cache(
  async () => {
    const rows = await prisma.property.findMany({
      where: { status: "PUBLISHED", ...EXCLUDE_BANK_AUCTIONS },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return rows;
  },
  ["published-properties"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getPublishedProperties(): Promise<Property[]> {
  return safeDbCall(
    async () => (await getCachedPublishedProperties()).map(toPublicPropertyListItem),
    [],
    "getPublishedProperties"
  );
}

const getCachedFeaturedProperties = unstable_cache(
  async (limit: number) => {
    const rows = await prisma.property.findMany({
      where: { status: "PUBLISHED", featured: "true", ...EXCLUDE_BANK_AUCTIONS },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // "Featured" is an admin-set flag (Property.featured toggle in the
    // CRM) — nothing requires the admin to have set it on anything yet.
    // Before this fallback, an empty flag set meant the homepage's
    // entire Featured Properties section (and this data feeding the
    // FeaturedProperties intro photo collage) rendered completely
    // blank rather than degrading. Falling back to the most recent
    // published listings keeps the section populated with real
    // properties either way — the CRM toggle still fully controls
    // curation once anything is actually flagged featured.
    if (rows.length > 0) return rows;

    return prisma.property.findMany({
      where: { status: "PUBLISHED", ...EXCLUDE_BANK_AUCTIONS },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
  ["featured-properties"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getFeaturedProperties(limit = 6): Promise<Property[]> {
  return safeDbCall(
    async () => (await getCachedFeaturedProperties(limit)).map(toPublicPropertyListItem),
    [],
    "getFeaturedProperties"
  );
}

// The FeaturedProperties intro collage picks its photos separately from
// the grid above — most listings still have no photography uploaded yet,
// so filtering the same "most recent"/"featured" set down to ones with an
// image (as the collage needs) often left only 1 of 3 tiles filled. This
// queries specifically for photographed properties instead, so the
// collage reliably shows real property photos rather than depending on
// whichever properties happen to be newest.
const getCachedCollagePhotoProperties = unstable_cache(
  async (limit: number) => {
    return prisma.property.findMany({
      where: { status: "PUBLISHED", images: { some: {} }, ...EXCLUDE_BANK_AUCTIONS },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
  ["collage-photo-properties"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getCollagePhotoProperties(limit = 3): Promise<Property[]> {
  return safeDbCall(
    async () => (await getCachedCollagePhotoProperties(limit)).map(toPublicPropertyListItem),
    [],
    "getCollagePhotoProperties"
  );
}

const getCachedPropertiesByCategory = unstable_cache(
  async (categorySlug: string, limit: number) => {
    const rows = await prisma.property.findMany({
      where: { status: "PUBLISHED", category: { slug: categorySlug } },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows;
  },
  ["properties-by-category"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getPropertiesByCategory(categorySlug: string, limit = 6): Promise<Property[]> {
  // Bank auctions are served exclusively via src/lib/auctions.ts — never
  // surfaced through this generic adapter, even when explicitly requested.
  if (categorySlug === "bank-auctions") return [];
  return safeDbCall(
    async () => (await getCachedPropertiesByCategory(categorySlug, limit)).map(toPublicPropertyListItem),
    [],
    "getPropertiesByCategory"
  );
}

/** Returns both the mapped `Property` and its raw gallery image URLs, since
 *  the detail page needs the full photo set that `Property.gallery` doesn't
 *  carry. */
const getCachedPropertyBySlug = unstable_cache(
  async (slug: string) => {
    const row = await prisma.property.findUnique({
      where: { slug, status: "PUBLISHED" },
      include: PROPERTY_INCLUDE,
    });
    if (!row || row.category.slug === "bank-auctions") return null;
    return row;
  },
  ["property-by-slug"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getPropertyBySlug(
  slug: string
): Promise<{ property: Property; galleryImages: string[]; details: DetailSection[] } | null> {
  return safeDbCall(
    async () => {
      const row = await getCachedPropertyBySlug(slug);
      if (!row) return null;
      return {
        property: toPublicProperty(row),
        galleryImages: getGalleryImages(row),
        details: buildDetailSections(row, propertyKindFor(row.propertyType.name)),
      };
    },
    null,
    "getPropertyBySlug"
  );
}

const getCachedRelatedProperties = unstable_cache(
  async (categorySlug: string, excludeId: string, limit: number) => {
    const rows = await prisma.property.findMany({
      where: {
        status: "PUBLISHED",
        id: { not: excludeId },
        category: { slug: categorySlug },
      },
      select: PROPERTY_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows;
  },
  ["related-properties"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getRelatedProperties(property: Property, limit = 3): Promise<Property[]> {
  return safeDbCall(
    async () =>
      (await getCachedRelatedProperties(property.categorySlug, property.id, limit)).map(
        toPublicPropertyListItem
      ),
    [],
    "getRelatedProperties"
  );
}

const getCachedAllPublishedSlugs = unstable_cache(
  async () => {
    const rows = await prisma.property.findMany({
      where: { status: "PUBLISHED", ...EXCLUDE_BANK_AUCTIONS },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  },
  ["all-published-slugs"],
  { revalidate: 60, tags: ["properties"] }
);

export async function getAllPublishedSlugs(): Promise<string[]> {
  return safeDbCall(getCachedAllPublishedSlugs, [], "getAllPublishedSlugs");
}
