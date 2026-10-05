import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Container, Section } from "@/components/ui/Container";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import Image from "next/image";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonFX } from "@/components/ui/ButtonFX";
import { LEGAL_SERVICES } from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";
import { LoanEligibilityChecker } from "@/components/service/LoanEligibilityChecker";

export const revalidate = 60;

export function generateStaticParams() {
  return LEGAL_SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = LEGAL_SERVICES.find((s) => s.slug === slug);
  if (!service) return {};
  return {
    title: `${service.title} | Sarakki Homes`,
    description: service.description,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = LEGAL_SERVICES.find((s) => s.slug === slug);
  if (!service) notFound();

  const { contact: CONTACT } = await getSiteSettings();
  const serviceIndex = LEGAL_SERVICES.findIndex((s) => s.slug === slug);
  const Icon = service.icon;

  return (
    <>
      <Header solid />
      <main className="flex flex-1 flex-col pt-16">
        <section className="relative flex min-h-[60vh] items-end overflow-hidden bg-foreground">
          {/* Real photography — /public/media/services/{slug}.jpg,
              chosen per service (Pexels License: free for commercial
              use, no attribution required), not a generic stand-in.
              Same bottom-anchored scrim as the bank-auction detail
              hero, for headline legibility over a real photo.

              object-cover so the photo fills the section edge-to-edge
              with no letterboxing. quality bumped from the next/image
              default (75) since these source files are only ~1200px
              wide and get displayed wider than that on most desktops —
              higher JPEG quality keeps the upscaled result as crisp as
              the source allows. object-position top-ish keeps the
              subject in the upper portion of the frame in view for the
              several source photos that are portrait-oriented (up to
              1200x1800) and get cropped down to a short landscape band. */}
          <Image
            src={`/media/services/${service.slug}.jpg`}
            alt=""
            aria-hidden="true"
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-top"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(15,12,10,0.15) 0%, rgba(15,12,10,0.55) 55%, rgba(15,12,10,0.92) 100%)" }}
          />
          <Container className="relative z-10 pb-20 pt-40">
            <div className="flex items-center gap-5">
              <span className="font-display text-sm tabular-nums text-accent-gold">
                {String(serviceIndex + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-16 bg-accent-gold/50" />
              <span className="text-[15px] font-semibold uppercase tracking-[0.22em] text-background/70">
                Our Services
              </span>
            </div>

            <div className="mt-8 flex items-start gap-6">
              <span className="hidden shrink-0 rounded-full border border-accent-gold/30 bg-background/10 p-4 text-accent-gold backdrop-blur-sm sm:flex">
                <Icon size={28} strokeWidth={1.5} />
              </span>
              <h1 className="max-w-2xl font-display text-[2.5rem] leading-[1.02] tracking-[-0.02em] text-background md:text-[3.75rem]">
                {service.heroTagline}
              </h1>
            </div>
          </Container>
        </section>

        <Section>
          <Container className="grid grid-cols-1 gap-16 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevealOnScroll>
                <h2 className="font-display text-2xl">{service.title}</h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground">
                  {service.longDescription}
                </p>

                <h2 className="mt-14 font-display text-2xl">What&rsquo;s included</h2>
                <ul className="mt-6 border-t border-border/60">
                  {service.highlights.map((highlight, i) => (
                    <li
                      key={highlight}
                      className="flex items-baseline gap-6 border-b border-border/60 py-4"
                    >
                      <span className="shrink-0 font-display text-xs tabular-nums text-accent-gold-dark">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[1rem] leading-relaxed text-foreground">
                        {highlight}
                      </span>
                    </li>
                  ))}
                </ul>

                {service.slug === "bank-loan-agreement" ? (
                  <LoanEligibilityChecker />
                ) : (
                  service.eligibilityDocuments && (
                    <>
                      <h2 className="mt-14 font-display text-2xl">Check My Eligibility</h2>
                      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {service.eligibilityDocuments.map((group) => (
                          <div
                            key={group.profile}
                            className="rounded-md border border-border bg-surface p-6"
                          >
                            <p className="font-display text-lg">{group.profile}</p>
                            <ul className="mt-4 flex flex-col gap-2.5">
                              {group.documents.map((doc) => (
                                <li
                                  key={doc}
                                  className="text-sm leading-relaxed text-foreground"
                                >
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <a
                        href={CONTACT.whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClasses("primary", "mt-6 w-fit")}
                      >
                        <ButtonFX />
                        Check My Eligibility
                      </a>
                    </>
                  )
                )}
              </RevealOnScroll>
            </div>

            <div>
              <RevealOnScroll delay={0.1} className="rounded-md border border-border bg-surface p-8">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Ideal For
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {service.idealFor.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("primary", "mt-7 w-full")}
                >
                  <ButtonFX />
                  Discuss This Service
                </a>
              </RevealOnScroll>
            </div>
          </Container>
        </Section>

        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
