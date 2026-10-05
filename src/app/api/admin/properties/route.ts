import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, CAN } from "@/lib/authz";
import { propertyKindFor, validateDetailsBody, detailsToPrismaData } from "@/lib/propertyDetails";
import { priceDisplay, rupeesToLakh } from "@/lib/formatPrice";

// SECURITY: unexpected exceptions are logged server-side but never echoed
// to the client — raw Prisma errors leak schema and connection details.
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function GET(req: Request) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const category = searchParams.get("category") || "";
  const builder = searchParams.get("builder") || "";
  const propertyType = searchParams.get("propertyType") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  // Client-facing sort keys mapped to Prisma orderBy — kept out of the
  // querystring's raw shape so the URL stays readable ("sort=price_desc")
  // without exposing/depending on the Prisma field names directly.
  const SORT_MAP: Record<string, Prisma.PropertyOrderByWithRelationInput[]> = {
    newest: [{ createdAt: "desc" }],
    oldest: [{ createdAt: "asc" }],
    price_desc: [{ priceValueLakh: "desc" }],
    price_asc: [{ priceValueLakh: "asc" }],
    name_asc: [{ title: "asc" }],
    name_desc: [{ title: "desc" }],
  };
  const orderBy = SORT_MAP[sort] ?? SORT_MAP.newest;

  try {
    const where: Prisma.PropertyWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { location: { contains: search } },
        { propertyId: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = { slug: category };
    }
    if (builder) {
      where.builderId = builder;
    }
    if (propertyType) {
      where.propertyTypeId = propertyType;
    }

    const [properties, total] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        include: {
          category: true,
          builder: true,
          propertyType: true,
          images: { orderBy: { order: "asc" }, take: 1 },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.property.count({ where }),
    ]);

    return NextResponse.json({ properties, total, page, limit });
  } catch (error: unknown) {
    console.error("[api/admin/properties] request failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(CAN.MANAGE_CONTENT);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // Server-side counterpart of the wizard's zod schema (same rules for
    // the detail fields via src/lib/propertyDetails.ts). Required:
    // Property Type, Purpose, Title, City, Price.
    if (typeof body.title !== "string" || body.title.trim().length < 3) {
      return NextResponse.json({ error: "Property name must be at least 3 characters." }, { status: 400 });
    }
    if (!body.propertyTypeId) {
      return NextResponse.json({ error: "Property type is required." }, { status: 400 });
    }
    if (!body.categoryId) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
    // Price is entered in whole rupees (expectedPrice). A body that only
    // carries the legacy lakh figure (an un-migrated row being
    // duplicated) is converted rather than rejected.
    const detailsInput = {
      ...body,
      purpose: body.purpose ?? "Sale",
      city: body.city ?? "Bengaluru",
      expectedPrice:
        body.expectedPrice ?? (Number(body.priceValueLakh) > 0 ? Math.round(Number(body.priceValueLakh) * 100000) : undefined),
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
    // Rupees are the source of truth; the lakh column and the display
    // string are derived from them so nothing can drift.
    const expectedPrice = Math.round(Number(detailsInput.expectedPrice));
    const priceValueLakh = rupeesToLakh(expectedPrice);

    // Auto-generate Property ID: find the last property and increment
    const lastProperty = await prisma.property.findFirst({
      orderBy: { propertyId: "desc" },
    });

    let newPropertyId = "SH-1001";
    if (lastProperty && lastProperty.propertyId) {
      const match = lastProperty.propertyId.match(/SH-(\d+)/);
      if (match) {
        const lastNum = parseInt(match[1]);
        newPropertyId = `SH-${lastNum + 1}`;
      }
    }

    // Generate slug from title if not provided. The wizard's "Slug (URL
    // endpoint)" field is free text, so a stray paste (e.g. a Google Maps
    // link meant for the mapQuery field) can land here — a slug like
    // "https://maps.app.goo.gl/..." doesn't just look wrong, it breaks
    // the property's own /properties/[slug] page (colons and slashes
    // don't match the dynamic segment). Only accept a hand-entered slug
    // if it's actually URL-safe; anything else falls back to the
    // auto-generated one instead of silently breaking the route.
    const safeCustomSlug =
      typeof body.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug) ? body.slug : "";
    const slug =
      safeCustomSlug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    // Create property in transaction
    const property = await prisma.property.create({
      data: {
        propertyId: newPropertyId,
        slug,
        title: body.title,
        location: body.location,
        price: priceDisplay(expectedPrice, details.purpose),
        priceValueLakh,
        propertyTypeId: body.propertyTypeId,
        status: body.status || "UNPUBLISHED",
        featured: body.featured || "false",
        beds: parseInt(body.beds || "0"),
        baths: parseInt(body.baths || "0"),
        area: body.area ?? "",
        areaSqft: parseInt(body.areaSqft || "0") || 0,
        description: body.description ?? "",
        address: body.address ?? "",
        mapQuery: body.mapQuery ?? "",
        categoryId: body.categoryId,
        ...details,
        expectedPrice,
        // "" (the wizard's "None" option) is not a valid Builder id —
        // Prisma needs an actual null to clear/skip the relation, not
        // an empty string, which would fail the foreign-key write.
        builderId: body.builderId || null,
      },
    });

    // Whether this listing is a bank auction is driven by its Category
    // (slug "bank-auctions"), not the free-standing Property Type field
    // — those used to be conflated when Property Type still had a "Bank
    // Auction" option. One extra lookup, but keeps this correct even if
    // Property Type's available values change again later.
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { slug: true },
    });
    const isBankAuction = category?.slug === "bank-auctions";

    // These four writes are all independent of each other (each only
    // needs property.id, already in hand) but were previously awaited
    // one after another. This dev environment's round trip to Supabase
    // (Tokyo) runs ~600ms+ per query right now, so four sequential
    // awaits here alone added 2+ seconds to every publish. Running them
    // concurrently costs roughly one round trip's worth of latency
    // instead of the sum of four.
    const followUpWrites: Promise<unknown>[] = [];

    if (isBankAuction && body.auctionInfo) {
      followUpWrites.push(
        prisma.auctionInfo.create({
          data: {
            propertyId: property.id,
            bankName: body.auctionInfo.bankName,
            auctionDate: new Date(body.auctionInfo.auctionDate),
            emd: body.auctionInfo.emd,
            reservePrice: body.auctionInfo.reservePrice,
            physicalPossession: body.auctionInfo.physicalPossession === true,
            legalStatus: body.auctionInfo.legalStatus,
          },
        })
      );
    }

    if (body.loanEligibility) {
      followUpWrites.push(
        prisma.loanEligibility.create({
          data: {
            propertyId: property.id,
            maxLoanAmount: body.loanEligibility.maxLoanAmount,
            indicativeEmi: body.loanEligibility.indicativeEmi,
            partnerBanks: JSON.stringify(body.loanEligibility.partnerBanks || []),
          },
        })
      );
    }

    if (body.images && body.images.length > 0) {
      followUpWrites.push(
        prisma.propertyImage.createMany({
          data: body.images.map((img: { url: string; publicId?: string }, idx: number) => ({
            url: img.url,
            publicId: img.publicId || `manual_${property.slug}_${idx}`,
            order: idx,
            propertyId: property.id,
          })),
        })
      );
    }

    if (typeof body.videoUrl === "string" && body.videoUrl.trim()) {
      followUpWrites.push(
        prisma.propertyVideo.create({ data: { url: body.videoUrl.trim(), propertyId: property.id } })
      );
    }

    followUpWrites.push(
      prisma.activityLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_PROPERTY",
          details: `Created property ${property.title} (${property.propertyId})`,
        },
      })
    );

    await Promise.all(followUpWrites);

    // Public listings/detail pages are ISR-cached (revalidate = 60) —
    // bust that so a newly published property shows up immediately.
    // revalidateTag clears the underlying Data Cache (src/lib/properties.ts)
    // that the route cache above reads from — without it the page would
    // regenerate but still serve the stale cached query result.
    revalidatePath("/");
    revalidatePath("/properties");
    revalidatePath("/properties/bank-auctions");
    revalidatePath(`/properties/${property.slug}`);
    revalidateTag("properties", { expire: 0 });

    return NextResponse.json({ property });
  } catch (error: unknown) {
    console.error("[api/admin/properties] request failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
