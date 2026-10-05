import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { Container, Section } from "@/components/ui/Container";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { PropertyOverview } from "@/components/property/PropertyOverview";
import { PropertyMap } from "@/components/property/PropertyMap";
import { PropertyAmenities } from "@/components/property/PropertyAmenities";
import { PropertyDetailsTable } from "@/components/property/PropertyDetailsTable";
import { InvestmentHighlights } from "@/components/property/InvestmentHighlights";
import { AuctionInfoCard } from "@/components/property/AuctionInfoCard";
import { LoanEligibilityCard } from "@/components/property/LoanEligibilityCard";
import { PropertyDocuments } from "@/components/property/PropertyDocuments";
import { EnquiryPanel } from "@/components/property/EnquiryPanel";
import { RelatedProperties } from "@/components/property/RelatedProperties";
import { getAllPublishedSlugs, getPropertyBySlug, getRelatedProperties } from "@/lib/properties";

// Pre-render every published property at build time, but don't 404 a slug
// added after the build — render it on demand instead (`dynamicParams`,
// default true, kept explicit since that's the behavior this depends on).
export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPropertyBySlug(slug);
  if (!result) return {};
  return {
    title: `${result.property.title} | Sarakki Homes`,
    description: result.property.description,
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPropertyBySlug(slug);
  if (!result) notFound();
  const { property, galleryImages, details } = result;

  const related = await getRelatedProperties(property);

  return (
    <>
      <Header solid />
      <main className="flex flex-1 flex-col pt-24">
        <Section className="!pb-0 !pt-8 md:!pt-10">
          <Container>
            <PropertyGallery
              images={galleryImages}
              fallbackTone={property.gallery[0]}
              title={property.title}
            />
          </Container>
        </Section>

        <Section>
          <Container className="grid grid-cols-1 gap-16 lg:grid-cols-3">
            <div className="flex flex-col gap-14 lg:col-span-2">
              <RevealOnScroll>
                <PropertyOverview property={property} />
              </RevealOnScroll>

              <RevealOnScroll>
                <PropertyDetailsTable sections={details} />
              </RevealOnScroll>

              <RevealOnScroll>
                <PropertyMap mapQuery={property.mapQuery} location={property.location} />
              </RevealOnScroll>

              <RevealOnScroll>
                <PropertyAmenities amenities={property.amenities} />
              </RevealOnScroll>

              <RevealOnScroll>
                <InvestmentHighlights highlights={property.investmentHighlights} />
              </RevealOnScroll>

              {property.auctionInfo && (
                <RevealOnScroll>
                  <AuctionInfoCard info={property.auctionInfo} />
                </RevealOnScroll>
              )}

              <RevealOnScroll>
                <LoanEligibilityCard loan={property.loanEligibility} />
              </RevealOnScroll>

              <RevealOnScroll>
                <PropertyDocuments documents={property.documents} />
              </RevealOnScroll>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-28">
                <p className="font-display text-3xl">{property.price}</p>
                <div className="mt-5">
                  <EnquiryPanel propertyId={property.id} propertyTitle={property.title} />
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <RelatedProperties properties={related} />
      </main>
      <Footer />
    </>
  );
}
