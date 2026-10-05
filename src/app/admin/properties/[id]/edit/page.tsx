import { prisma } from "@/lib/prisma";
import { PropertyWizard } from "@/components/admin/PropertyWizard";
import { notFound } from "next/navigation";
import { parseJsonList } from "@/lib/propertyDetails";
import { getLocalityNames } from "@/lib/localities";

/** Older listings stored area only as display text ("3,200 sq.ft") with
 *  areaSqft left at 0. Recover the number from the text so the single
 *  "Area (sqft)" field opens pre-filled instead of blank. */
function resolveAreaSqft(areaSqft: number, area: string): string {
  if (areaSqft > 0) return String(areaSqft);
  const m = area.replace(/,/g, "").match(/d+(.d+)?/);
  return m ? String(Math.round(parseFloat(m[0]))) : "";
}

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Retrieve property with relations
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      auctionInfo: true,
      loanEligibility: true,
      images: { orderBy: { order: "asc" } },
      videos: true,
    },
  });

  if (!property) {
    notFound();
  }

  // Load lists
  const categories = await prisma.category.findMany({
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });

  const builders = await prisma.builder.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const localities = await getLocalityNames();

  const propertyTypes = await prisma.propertyType.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Map database entity to form friendly format
  const initialData = {
    id: property.id,
    title: property.title,
    categoryId: property.categoryId,
    builderId: property.builderId ?? "",
    propertyTypeId: property.propertyTypeId,
    price: property.price,
    location: property.location,
    address: property.address,
    mapQuery: property.mapQuery,
    description: property.description,
    status: property.status,
    featured: property.featured,
    beds: String(property.beds),
    baths: String(property.baths),
    area: property.area,
    areaSqft: resolveAreaSqft(property.areaSqft, property.area),
    purpose: property.purpose as "Sale" | "Rent",
    ownershipType: str(property.ownershipType),
    availabilityStatus: str(property.availabilityStatus),
    possessionDate: str(property.possessionDate),
    locality: str(property.locality),
    city: property.city,
    pincode: str(property.pincode),
    landmark: str(property.landmark),
    nearbyFacilities: parseJsonList(property.nearbyFacilities),
    plotArea: str(property.plotArea),
    builtUpArea: str(property.builtUpArea),
    carpetArea: str(property.carpetArea),
    dimLength: str(property.dimLength),
    dimWidth: str(property.dimWidth),
    roadWidth: str(property.roadWidth),
    totalFloors: str(property.totalFloors),
    floorDetails: str(property.floorDetails),
    balconies: str(property.balconies),
    parkingCars: str(property.parkingCars),
    parkingBikes: str(property.parkingBikes),
    propertyAge: str(property.propertyAge),
    furnishing: str(property.furnishing),
    facing: str(property.facing),
    waterSupply: str(property.waterSupply),
    electricity: str(property.electricity),
    lift: str(property.lift),
    powerBackup: str(property.powerBackup),
    amenities: parseJsonList(property.amenities),
    // Rupees are the source of truth; an un-migrated row falls back to
    // its lakh figure converted (see prisma/backfill-price-rupees.ts).
    expectedPrice: String(property.expectedPrice ?? Math.round(property.priceValueLakh * 100000)),
    negotiable: str(property.negotiable),
    videoUrl: property.videos[0]?.url ?? "",
    // Full ordered gallery, not just the cover — the wizard now manages
    // every image, so passing only images[0] here would silently drop
    // the rest of an existing property's photos on save.
    images: property.images.map((img) => ({ url: img.url })),
    seoTitle: property.title,
    seoDescription: property.description.substring(0, 155),
    slug: property.slug,
    auctionInfo: property.auctionInfo
      ? {
          bankName: property.auctionInfo.bankName,
          auctionDate: property.auctionInfo.auctionDate.toISOString().split("T")[0],
          emd: property.auctionInfo.emd,
          reservePrice: property.auctionInfo.reservePrice,
          physicalPossession: property.auctionInfo.physicalPossession,
          legalStatus: property.auctionInfo.legalStatus,
        }
      : undefined,
    loanEligibility: property.loanEligibility
      ? {
          maxLoanAmount: property.loanEligibility.maxLoanAmount,
          indicativeEmi: property.loanEligibility.indicativeEmi,
          partnerBanks: JSON.parse(property.loanEligibility.partnerBanks || "[]"),
        }
      : undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-title tracking-wide">
          Modify Listing
        </h1>
        <p className="text-sm text-crm-text-secondary mt-1">
          Edit listing details, update pricing, or change auction statuses.
        </p>
      </div>

      <PropertyWizard
        categories={categories}
        builders={builders}
        propertyTypes={propertyTypes}
        localities={localities}
        initialData={initialData}
      />
    </div>
  );
}
