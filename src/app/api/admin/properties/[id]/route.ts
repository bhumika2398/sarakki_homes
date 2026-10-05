import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN } from "@/lib/authz";
import { propertyKindFor, validateDetailsBody, detailsToPrismaData } from "@/lib/propertyDetails";
import { priceDisplay, rupeesToLakh } from "@/lib/formatPrice";

// SECURITY: unexpected exceptions are logged server-side but never echoed
// to the client — raw Prisma errors leak schema and connection details.
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        category: true,
        builder: true,
        propertyType: true,
        auctionInfo: true,
        loanEligibility: true,
        images: { orderBy: { order: "asc" } },
        videos: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (error: unknown) {
    console.error("[api/admin/properties/[id]] request failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const body = await req.json();

    // Check if property exists
    const existing = await prisma.property.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Same rules as the create route / wizard. purpose + city are NOT NULL
    // columns that other callers (the list page's feature/archive
    // toggles) pass straight through from the stored row; an absent value
    // falls back to what is already saved rather than failing.
    if (typeof body.title !== "string" || body.title.trim().length < 3) {
      return NextResponse.json({ error: "Property name must be at least 3 characters." }, { status: 400 });
    }
    if (!body.propertyTypeId) {
      return NextResponse.json({ error: "Property type is required." }, { status: 400 });
    }
    // Price is whole rupees (expectedPrice). A caller that omits it
    // (older client, un-migrated row) keeps the stored value, falling back
    // to the legacy lakh figure converted to rupees.
    const detailsInput = {
      ...body,
      purpose: body.purpose ?? existing.purpose,
      city: body.city ?? existing.city,
      expectedPrice:
        body.expectedPrice ?? existing.expectedPrice ?? Math.round(existing.priceValueLakh * 100000),
    };
    const detailsError = validateDetailsBody(detailsInput);
    if (detailsError) {
      return NextResponse.json({ error: detailsError }, { status: 400 });
    }
    const propertyType = await prisma.propertyType.findUnique({
      where: { id: body.propertyTypeId },
      select: { name: true },
    });
    if (!propertyType) {
      return NextResponse.json({ error: "Property type is required." }, { status: 400 });
    }
    const details = detailsToPrismaData(detailsInput, propertyKindFor(propertyType.name));
    const expectedPrice = Math.round(Number(detailsInput.expectedPrice));
    const priceValueLakh = rupeesToLakh(expectedPrice);

    // Same guard as the create route: only accept a hand-entered slug if
    // it's actually URL-safe (a stray paste like a Google Maps link would
    // otherwise silently break this property's own /properties/[slug]
    // page). Falls back to the existing slug rather than the blank/
    // invalid value so an edit can never wipe or corrupt it by accident.
    const safeCustomSlug =
      typeof body.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug) ? body.slug : existing.slug;

    // Update property details in transaction
    const property = await prisma.property.update({
      where: { id },
      data: {
        title: body.title,
        slug: safeCustomSlug,
        location: body.location,
        price: priceDisplay(expectedPrice, details.purpose),
        priceValueLakh,
        propertyTypeId: body.propertyTypeId,
        status: body.status,
        featured: body.featured,
        beds: parseInt(body.beds || "0"),
        baths: parseInt(body.baths || "0"),
        area: body.area,
        areaSqft: parseInt(body.areaSqft || "0") || 0,
        description: body.description,
        address: body.address,
        mapQuery: body.mapQuery,
        categoryId: body.categoryId,
        ...details,
        expectedPrice,
        // "" (the wizard's "None" option) is not a valid Builder id —
        // Prisma needs an actual null to clear the relation, not an
        // empty string, which would fail the foreign-key write.
        builderId: body.builderId || null,
      },
    });

    // Whether this listing is a bank auction is driven by its Category
    // (slug "bank-auctions"), not the free-standing Property Type field
    // — those used to be conflated when Property Type still had a "Bank
    // Auction" option.
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { slug: true },
    });
    const isBankAuction = category?.slug === "bank-auctions";

    // AuctionInfo, LoanEligibility, Images, and the activity log entry
    // are all independent of each other (each only needs the property id
    // already in hand) but were previously awaited one after another --
    // up to 5 sequential round trips. This dev environment's round trip
    // to Supabase (Tokyo) runs ~600ms+ per query right now, so that
    // chain alone could add 3+ seconds to every save. Running them
    // concurrently costs roughly one round trip's worth of latency
    // instead of the sum of all of them. The images delete-then-create
    // pair must stay sequential relative to each other (can't insert
    // before the old rows are gone), so that pair is wrapped as one
    // promise in the batch rather than two separate entries.
    const followUpWrites: Promise<unknown>[] = [];

    if (isBankAuction && body.auctionInfo) {
      followUpWrites.push(
        prisma.auctionInfo.upsert({
          where: { propertyId: id },
          update: {
            bankName: body.auctionInfo.bankName,
            auctionDate: new Date(body.auctionInfo.auctionDate),
            emd: body.auctionInfo.emd,
            reservePrice: body.auctionInfo.reservePrice,
            physicalPossession: body.auctionInfo.physicalPossession === true,
            legalStatus: body.auctionInfo.legalStatus,
          },
          create: {
            propertyId: id,
            bankName: body.auctionInfo.bankName,
            auctionDate: new Date(body.auctionInfo.auctionDate),
            emd: body.auctionInfo.emd,
            reservePrice: body.auctionInfo.reservePrice,
            physicalPossession: body.auctionInfo.physicalPossession === true,
            legalStatus: body.auctionInfo.legalStatus,
          },
        })
      );
    } else {
      // If the category changed away from Bank Auction, clean it up
      followUpWrites.push(prisma.auctionInfo.deleteMany({ where: { propertyId: id } }));
    }

    if (body.loanEligibility) {
      followUpWrites.push(
        prisma.loanEligibility.upsert({
          where: { propertyId: id },
          update: {
            maxLoanAmount: body.loanEligibility.maxLoanAmount,
            indicativeEmi: body.loanEligibility.indicativeEmi,
            partnerBanks: JSON.stringify(body.loanEligibility.partnerBanks || []),
          },
          create: {
            propertyId: id,
            maxLoanAmount: body.loanEligibility.maxLoanAmount,
            indicativeEmi: body.loanEligibility.indicativeEmi,
            partnerBanks: JSON.stringify(body.loanEligibility.partnerBanks || []),
          },
        })
      );
    }

    if (body.images) {
      followUpWrites.push(
        (async () => {
          await prisma.propertyImage.deleteMany({ where: { propertyId: id } });
          if (body.images.length > 0) {
            await prisma.propertyImage.createMany({
              data: body.images.map((img: { url: string; publicId?: string }, idx: number) => ({
                url: img.url,
                publicId: img.publicId || `manual_${property.slug}_${idx}`,
                order: idx,
                propertyId: id,
              })),
            });
          }
        })()
      );
    }

    // Only touched when the caller sent videoUrl (the wizard always does;
    // the list page's feature/archive toggles don't).
    if (body.videoUrl !== undefined) {
      followUpWrites.push(
        (async () => {
          await prisma.propertyVideo.deleteMany({ where: { propertyId: id } });
          const url = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
          if (url) await prisma.propertyVideo.create({ data: { url, propertyId: id } });
        })()
      );
    }

    followUpWrites.push(
      prisma.activityLog.create({
        data: {
          userId: auth.user.id,
          action: "UPDATE_PROPERTY",
          details: `Updated property ${property.title} (${property.propertyId})`,
        },
      })
    );

    await Promise.all(followUpWrites);

    revalidatePath("/");
    revalidatePath("/properties");
    revalidatePath("/properties/bank-auctions");
    revalidatePath(`/properties/${existing.slug}`);
    if (property.slug !== existing.slug) revalidatePath(`/properties/${property.slug}`);
    revalidatePath(`/properties/bank-auctions/${property.propertyId}`);
    revalidateTag("properties", { expire: 0 });

    return NextResponse.json({ property });
  } catch (error: unknown) {
    console.error("[api/admin/properties/[id]] request failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Deleting a live listing is destructive and public-facing — narrower
  // than general content editing (see CAN.DELETE_CONTENT in src/lib/authz).
  const auth = await requireRole(CAN.DELETE_CONTENT);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const existing = await prisma.property.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Delete property
    await prisma.property.delete({
      where: { id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "DELETE_PROPERTY",
        details: `Deleted property ${existing.title} (${existing.propertyId})`,
      },
    });

    revalidatePath("/");
    revalidatePath("/properties");
    revalidatePath("/properties/bank-auctions");
    revalidatePath(`/properties/${existing.slug}`);
    revalidateTag("properties", { expire: 0 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[api/admin/properties/[id]] request failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
