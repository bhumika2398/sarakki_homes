import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { Container, Section } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PropertyExplorer } from "@/components/property/PropertyExplorer";
import { getPublishedProperties } from "@/lib/properties";
import { getLocalityNames } from "@/lib/localities";

// Property listings are admin-managed and can change anytime — re-fetch
// from the database at most once a minute rather than only at build time.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties | Sarakki Homes",
  description:
    "Browse verified bank auction, rental income, resale, and ready-to-move properties across Bengaluru — every listing legally vetted by Sarakki Homes.",
};

export default async function PropertiesPage() {
  const [properties, localities] = await Promise.all([getPublishedProperties(), getLocalityNames()]);

  return (
    <>
      <Header solid />
      {/* pt-28 (112px) previously stacked on top of the hero section's OWN
          py-14, and that section's default Section wrapper padding again
          stacked on top of the property grid below it — three separate
          vertical paddings compounding into the "excessive whitespace"
          this page was flagged for. Tightened throughout; still generous,
          just not tripled. */}
      <main className="flex flex-1 flex-col pt-20">
        <Section className="relative flex min-h-[220px] items-center justify-center overflow-hidden !py-14 bg-accent-emerald-dark">
          <div aria-hidden className="emerald-shimmer" />
          <Container className="relative flex flex-col items-center text-center">
            <Eyebrow light>Explore Properties</Eyebrow>
            <h1 className="relative mt-3 max-w-2xl font-display text-4xl leading-[1.1] tracking-[-0.01em] text-background md:text-5xl">
              Every property here has already been through our scrutiny.
            </h1>
          </Container>
        </Section>

        {/* Deeper than the standard bg-surface token — white cards need a
            more contrasted backdrop to read as distinct tiles rather than
            blending into the section behind them. */}
        <Section className="bg-[#EDE6D6] !py-12 md:!py-16">
          <Container>
            <Suspense fallback={null}>
              <PropertyExplorer properties={properties} localities={localities} />
            </Suspense>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
