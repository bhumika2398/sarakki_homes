import {
  Gavel,
  KeyRound,
  Sparkles,
  RefreshCcw,
  Building2,
  Home,
  ShieldCheck,
  Scale,
  Landmark,
  TrendingUp,
  Search,
  FileCheck2,
  Handshake,
  Stamp,
  FileSignature,
  Compass,
  LineChart,
  Zap,
  PiggyBank,
  DoorOpen,
} from "lucide-react";

export const CONTACT = {
  phoneDisplay: "+91 9663676464",
  phoneHref: "tel:+919663676464",
  whatsappHref:
    "https://wa.me/919663676464?text=Hi%20Sarakki%20Homes%2C%20I%27d%20like%20to%20book%20a%20consultation.",
  instagramHref: "https://www.instagram.com/himabasavaiah/",
};

export const STATS: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}[] = [
  { label: "Properties Transacted", value: 500, suffix: "+" },
  { label: "Cr. Transaction Value", value: 250, prefix: "₹", suffix: "+" },
  { label: "Years of Trust", value: 15, suffix: "+" },
  { label: "Families Guided", value: 1000, suffix: "+" },
];

export type MediaTone = "warm" | "emerald" | "gold" | "charcoal";

export const CATEGORIES = [
  {
    title: "Bank Auction Properties",
    slug: "bank-auctions",
    description: "Properties offered through bank auctions.",
    heroTagline: "Below-market entry, without the risk.",
    longDescription:
      "Bank auctions offer some of the sharpest pricing in Bengaluru's property market — but only if you know how to navigate SARFAESI notices, reserve prices, and title history. We shortlist auction properties, run independent legal verification before you ever bid, and guide you through the bidding process itself.",
    highlights: [
      "Independent title and encumbrance verification before every listing",
      "Typically 15-25% below comparable open-market pricing",
      "Guided bid strategy backed by local valuation data",
      "Full support through EMD, registration, and possession",
    ],
    idealFor: ["First-time investors seeking value entry points", "Buyers comfortable with a structured, time-bound process"],
    icon: Gavel,
    tone: "charcoal" as MediaTone,
  },
  {
    title: "Rental Income Properties",
    slug: "rental-income",
    description: "Properties with existing rental income and investment potential.",
    heroTagline: "Built for yield, not just appreciation.",
    longDescription:
      "Not every property makes a good rental asset. We evaluate tenant demand, vacancy patterns, and yield history across Bengaluru's tech corridors before recommending anything — so the number on the brochure matches what actually lands in your account.",
    highlights: [
      "Selected specifically for tenant demand, not just price",
      "Average yields of 3.5-4%, above the city median",
      "Micro-market vacancy data reviewed before every recommendation",
      "Ongoing guidance on tenancy and rent structuring available",
    ],
    idealFor: ["Investors prioritizing monthly cash flow", "NRIs seeking hands-off, professionally vetted assets"],
    icon: KeyRound,
    tone: "emerald" as MediaTone,
  },
  {
    title: "Chance Properties",
    slug: "chance-deals",
    description:
      "Clear-title properties available below typical market pricing due to seller circumstances.",
    heroTagline: "Opportunities that never reach a listing site.",
    longDescription:
      "Some of the best deals never get publicly listed — motivated sellers, estate settlements, relocation sales. Our network surfaces these before they reach brokers or portals, and we move fast on your behalf when the window is short.",
    highlights: [
      "Off-market sourcing through our direct seller network",
      "Priced below comparable public listings",
      "Time-sensitive — verified and ready to move on quickly",
      "Same legal rigor as every other property we present",
    ],
    idealFor: ["Buyers ready to act quickly on a strong opportunity", "Investors seeking below-market off-market deals"],
    icon: Sparkles,
    tone: "gold" as MediaTone,
  },
  {
    title: "Resale Properties",
    slug: "resale",
    description: "Clear-title properties available for resale.",
    heroTagline: "Established homes, clean paperwork.",
    longDescription:
      "Resale is where most title disputes originate — unclear succession, missing khata records, unpaid dues. Every resale property we present has been through our documentation review first, so what you see is what you can actually buy.",
    highlights: [
      "Full title chain and khata verification before listing",
      "Property tax and dues cleared or disclosed upfront",
      "Access to established, high-demand neighborhoods",
      "Faster registration timelines than new construction",
    ],
    idealFor: ["Buyers who want an established neighborhood now", "Anyone wary of new-construction delivery risk"],
    icon: RefreshCcw,
    tone: "warm" as MediaTone,
  },
  {
    title: "Upcoming Projects",
    slug: "upcoming-projects",
    description: "New projects from reputed builders.",
    heroTagline: "Early access, vetted builders only.",
    longDescription:
      "We don't work with every builder in Bengaluru — only those with a track record of on-time delivery and clean RERA compliance. Early-access pricing on these projects is typically 15-20% below expected possession-time value.",
    highlights: [
      "Only RERA-registered projects from builders with delivery track records",
      "Pre-launch and early-bird pricing advantages",
      "Construction-linked payment plans structured with you",
      "Site visits and builder due-diligence included",
    ],
    idealFor: ["Buyers comfortable with a construction timeline", "Investors targeting appreciation before possession"],
    icon: Building2,
    tone: "emerald" as MediaTone,
  },
  {
    title: "Ready-to-Move Properties",
    slug: "ready-to-move",
    description: "Homes that are ready for immediate possession.",
    heroTagline: "No waiting, no possession risk.",
    longDescription:
      "For buyers who can't or don't want to wait on a construction timeline, we present only properties with occupancy certificates already issued — the paperwork that actually lets you move in and get utilities connected.",
    highlights: [
      "Occupancy certificate confirmed before we present the property",
      "Move in or rent out within weeks, not years",
      "Zero construction-delay or builder-default risk",
      "Immediate loan disbursement — no under-construction restrictions",
    ],
    idealFor: ["Buyers needing to move in immediately", "Anyone who has been burned by construction delays before"],
    icon: Home,
    tone: "gold" as MediaTone,
  },
  {
    title: "Rental Properties",
    slug: "rental-properties",
    description: "Verified homes available for direct rent — for tenants, not investors.",
    heroTagline: "A home to live in, not to own — yet.",
    longDescription:
      "Not every move needs a purchase. We list verified rental homes across Bengaluru's key residential corridors — landlord ownership and tenancy terms checked upfront — so tenants move in with the same confidence our buyers get at closing.",
    highlights: [
      "Landlord ownership and rental terms verified before listing",
      "Support with rental agreement drafting and registration",
      "Flexible lease terms across established neighborhoods",
      "Transparent brokerage — no hidden charges at move-in",
    ],
    idealFor: ["Tenants relocating to Bengaluru for work", "Anyone testing a neighborhood before buying"],
    icon: DoorOpen,
    tone: "charcoal" as MediaTone,
  },
];

// The "Our Services" section — legal/registration/documentation
// services Sarakki Homes helps clients with, plus two brokerage-terms
// offers. Deliberately a SEPARATE list from CATEGORIES above: those are
// property investment categories tied to the live Property table
// (categoryId FK, admin CRM, /properties filtering) — these are
// standalone service pages with no property inventory attached. Keeping
// them apart means this list can be edited freely without touching
// anything in the property/CRM pipeline.
export const LEGAL_SERVICES = [
  {
    slug: "e-khata",
    title: "E-Khata",
    description: "Digital Khata issuance and verification for BBMP properties.",
    heroTagline: "Your property, officially on record — digitally.",
    longDescription:
      "An E-Khata is the digital version of your property's Khata certificate, issued by BBMP as part of Bengaluru's move to online civic records. We handle the application, document verification, and follow-up with the ward office so your property is correctly and promptly reflected in the digital record.",
    highlights: [
      "End-to-end BBMP application handling",
      "Document verification before submission, so nothing bounces back",
      "Regular follow-up with the ward office until issuance",
      "Essential groundwork for resale, loans, and future Khata transfers",
    ],
    idealFor: ["Owners converting from paper Khata to E-Khata", "Buyers who want E-Khata confirmed before purchase"],
    icon: FileCheck2,
    tone: "warm" as MediaTone,
  },
  {
    slug: "sale-agreement",
    title: "Sale Agreement",
    description: "Legally sound sale agreements that protect both buyer and seller.",
    heroTagline: "The terms, written the way they should be.",
    longDescription:
      "A Sale Agreement sets out the price, timeline, and conditions of a property transaction before the final Sale Deed is registered. We draft and review these agreements to make sure every clause — payment schedule, possession date, penalty terms — is clear and enforceable, so nothing is left to interpretation later.",
    highlights: [
      "Drafted or reviewed by legal professionals, not templates",
      "Payment, possession, and penalty terms clearly defined",
      "Protects both parties before money changes hands",
      "Forms the legal basis for the eventual Sale Deed",
    ],
    idealFor: ["Buyers finalising terms before registration", "Sellers who want binding, enforceable commitments"],
    icon: FileSignature,
    tone: "gold" as MediaTone,
  },
  {
    slug: "sale-deed",
    title: "Sale Deed",
    description: "Registration-ready Sale Deeds, drafted and verified end to end.",
    heroTagline: "The document that actually transfers ownership.",
    longDescription:
      "The Sale Deed is the legal instrument that transfers ownership from seller to buyer — it's what gets registered at the Sub-Registrar's office. We prepare the deed, verify supporting documents (title chain, encumbrance, tax receipts), and accompany you through registration so the transfer is clean and dispute-free.",
    highlights: [
      "Full title chain and encumbrance verification before drafting",
      "Stamp duty and registration guidance",
      "In-person support at the Sub-Registrar's office",
      "Certified copies handed over after registration",
    ],
    idealFor: ["Buyers completing a purchase", "Sellers finalising a transfer"],
    icon: Stamp,
    tone: "charcoal" as MediaTone,
  },
  {
    slug: "rental-agreement",
    title: "Rental Agreement",
    description: "Clear, compliant rental agreements for landlords and tenants.",
    heroTagline: "Set the terms before you hand over the keys.",
    longDescription:
      "A well-drafted Rental Agreement protects both landlord and tenant — rent, deposit, notice period, and maintenance responsibilities, all spelled out and registered where required. We draft agreements suited to Karnataka's rental laws and handle e-stamping and registration.",
    highlights: [
      "Rent, deposit, and notice terms clearly documented",
      "Compliant with Karnataka rental regulations",
      "E-stamping and registration handled for you",
      "Renewal and exit terms defined upfront",
    ],
    idealFor: ["Landlords leasing out a property", "Tenants who want a fair, documented agreement"],
    icon: KeyRound,
    tone: "emerald" as MediaTone,
  },
  {
    slug: "khata-transfer",
    title: "Khata Transfer",
    description: "Transfer property records into the new owner's name, correctly.",
    heroTagline: "Make the record match the reality.",
    longDescription:
      "After a sale, gift, or inheritance, the Khata must be transferred into the new owner's name for property tax and civic records to be accurate. We prepare and submit the transfer application with the required documents and track it through to completion.",
    highlights: [
      "Application prepared with the correct supporting documents",
      "Tracked through to civic-body approval",
      "Required before you can pay property tax in your own name",
      "Handled for sale, gift, and inheritance transfers alike",
    ],
    idealFor: ["New owners after a purchase, gift, or inheritance", "Anyone whose Khata still shows a previous owner's name"],
    icon: RefreshCcw,
    tone: "warm" as MediaTone,
  },
  {
    slug: "bescom-name-transfer",
    title: "BESCOM Name Transfer",
    description: "Transfer the electricity connection into your name, hassle-free.",
    heroTagline: "One less office to visit yourself.",
    longDescription:
      "Buying or inheriting a property doesn't automatically move the electricity connection into your name — that's a separate application to BESCOM. We handle the paperwork and follow-up so your name is correctly reflected on the meter and billing records.",
    highlights: [
      "Application and document submission handled for you",
      "Follow-up with the BESCOM sub-division office",
      "Avoids billing disputes tied to a previous owner's name",
      "Typically completed alongside Khata transfer",
    ],
    idealFor: ["New property owners", "Anyone still receiving bills in a previous owner's name"],
    icon: Zap,
    tone: "gold" as MediaTone,
  },
  {
    slug: "encumbrance-certificate",
    title: "Encumbrance Certificate",
    description: "Verified proof that a property is free of legal or financial liabilities.",
    heroTagline: "Know exactly what you're buying into.",
    longDescription:
      "An Encumbrance Certificate (EC) confirms whether a property carries any registered mortgages, liens, or legal claims over a chosen period. We obtain and independently verify the EC before you commit to a purchase — one of the most important checks in any property transaction.",
    highlights: [
      "Obtained directly from the Sub-Registrar's office",
      "Cross-checked against the property's title history",
      "Covers whatever time period a lender or buyer requires",
      "A standard requirement for most home loan approvals",
    ],
    idealFor: ["Buyers verifying a property before purchase", "Lenders requiring an EC as part of loan processing"],
    icon: ShieldCheck,
    tone: "charcoal" as MediaTone,
  },
  {
    slug: "gift-deed",
    title: "Gift Deed",
    description: "Transfer property to a family member, legally and without dispute.",
    heroTagline: "Give with clarity, not complication.",
    longDescription:
      "A Gift Deed transfers property ownership without any monetary exchange — typically between family members. We draft the deed, confirm it meets registration requirements, and guide both parties through stamp duty and registration, so the transfer holds up legally.",
    highlights: [
      "Drafted to meet Karnataka registration requirements",
      "Stamp duty guidance specific to gift transfers",
      "Reduces the risk of future family disputes",
      "Registration support at the Sub-Registrar's office",
    ],
    idealFor: ["Parents transferring property to children", "Family members formalising an existing arrangement"],
    icon: Handshake,
    tone: "emerald" as MediaTone,
  },
  {
    slug: "will-deed",
    title: "Will Deed",
    description: "Record your property wishes clearly, to prevent disputes later.",
    heroTagline: "Put it in writing, properly.",
    longDescription:
      "A Will sets out how your property should be distributed after your lifetime — the single most effective way to prevent inheritance disputes among family members. We help draft and, where you choose, register a Will Deed that clearly states your intentions in legally sound language.",
    highlights: [
      "Drafted in clear, legally sound language",
      "Optional registration for added certainty",
      "Reduces ambiguity that leads to family disputes",
      "Can be updated as circumstances change",
    ],
    idealFor: ["Property owners planning succession", "Families wanting to avoid future inheritance disputes"],
    icon: Scale,
    tone: "warm" as MediaTone,
  },
  {
    slug: "bank-loan-agreement",
    title: "Bank Loan Arrangement",
    description: "Guidance through loan documentation, so approval isn't delayed by paperwork.",
    heroTagline: "Financing, without the fine-print anxiety.",
    longDescription:
      "A home loan comes with its own stack of paperwork — sanction letters, mortgage deeds, disbursement schedules. We coordinate with your bank, review the loan agreement terms, and make sure every document the lender needs is in order, so financing doesn't become the bottleneck.",
    highlights: [
      "Coordination with your bank's loan officer",
      "Loan agreement and mortgage deed review",
      "Documentation checklist so approval isn't delayed",
      "Support across major banks and NBFCs",
    ],
    idealFor: ["Buyers financing a purchase with a home loan", "Anyone refinancing or restructuring an existing loan"],
    icon: Landmark,
    tone: "gold" as MediaTone,
    eligibilityDocuments: [
      {
        profile: "Salaried",
        documents: [
          "3 months' salary slips",
          "6 months' bank statement",
          "PAN card",
          "Aadhar card",
          "Form 16 (last 2 years) OR 2 years' ITR",
        ],
      },
      {
        profile: "Self Employed",
        documents: ["2 years' ITR", "1 year's bank statement", "Business proof", "PAN card", "Aadhar card"],
      },
    ],
  },
  {
    slug: "no-brokerage-cashback",
    title: "No Brokerage for New Properties + 1% Cash Back",
    description: "Buy a new project through us — pay zero brokerage, and get 1% cash back.",
    heroTagline: "We get paid by the builder, not by you.",
    longDescription:
      "On select new projects, Sarakki Homes charges the buyer no brokerage at all — and passes back 1% of the property value as cash back at closing. It's how we work directly with builders on new launches, without adding to your cost.",
    highlights: [
      "Zero brokerage charged to the buyer",
      "1% cash back credited at closing",
      "Applies to select new project launches",
      "Full legal and RERA verification, same as every listing",
    ],
    idealFor: ["Buyers considering a new project purchase", "Anyone comparing costs across brokers"],
    icon: PiggyBank,
    tone: "gold" as MediaTone,
    featured: true,
  },
  {
    slug: "new-project-a-category-builders",
    title: "New Projects by A-Category Builders",
    description: "Early access to new launches from Bengaluru's most reputed builders.",
    heroTagline: "Get in before the public launch.",
    longDescription:
      "We work directly with A-category, RERA-registered builders to give our clients early access to new project launches — often at pre-launch pricing, before the general public. Every project is vetted for builder track record, approvals, and construction quality before we bring it to you.",
    highlights: [
      "Early / pre-launch access to vetted projects",
      "Only RERA-registered, A-category builders",
      "Builder track record and approval verification",
      "Direct coordination with the builder's sales team",
    ],
    idealFor: ["Buyers wanting early access to new launches", "Investors comparing upcoming projects by builder reputation"],
    icon: Building2,
    tone: "emerald" as MediaTone,
    featured: true,
  },
];

export type PropertyCategorySlug =
  | "bank-auctions"
  | "rental-income"
  | "chance-deals"
  | "resale"
  | "upcoming-projects"
  | "ready-to-move";

// Commission Structure — client-provided business terms, verbatim. Do not
// round, reword, or add fees/conditions not present in the brief. `category`
// / `categorySuffix` only split the client's exact wording across two lines
// for the card layout; no wording is altered. `figure` is the number/claim
// itself ("2%", "No Brokerage") and must stay the most prominent element
// wherever this is rendered. `note` carries the one approved cashback line
// for Upcoming Projects — do not paraphrase it.
export interface CommissionEntry {
  slug: PropertyCategorySlug;
  category: string;
  categorySuffix: string;
  figure: string;
  basis: string;
  note?: string;
  featured?: boolean;
}

export const COMMISSION_STRUCTURE: CommissionEntry[] = [
  {
    slug: "bank-auctions",
    category: "Bank Auction",
    categorySuffix: "Properties",
    figure: "2%",
    basis: "of Final Bidding Value",
  },
  {
    slug: "rental-income",
    category: "Rental Income",
    categorySuffix: "Properties",
    figure: "1%",
    basis: "of Sale Price",
  },
  {
    slug: "chance-deals",
    category: "Chance",
    categorySuffix: "Properties",
    figure: "2%",
    basis: "of Sale Price",
  },
  {
    slug: "resale",
    category: "Resale",
    categorySuffix: "Properties",
    figure: "1%",
    basis: "of Sale Price",
  },
  {
    slug: "ready-to-move",
    category: "Ready To Move In",
    categorySuffix: "(RTMI) Properties",
    figure: "1%",
    basis: "of Sale Price",
  },
  {
    slug: "upcoming-projects",
    category: "Upcoming Projects",
    categorySuffix: "of Top Builders",
    figure: "No Brokerage",
    basis: "",
    note: "1% Cash Back after payment of 20%.",
    featured: true,
  },
  // Deliberately no entry for "rental-properties" here — this array is
  // verbatim client-approved commission terms (see comment above), and no
  // brokerage figure for this category has been provided by the client
  // yet. Add one only once that figure is confirmed.
];

export interface AuctionInfo {
  bankName: string;
  auctionDate: string;
  reservePrice: string;
  emd: string;
}

export interface LoanEligibility {
  maxLoanAmount: string;
  indicativeEmi: string;
  partnerBanks: string[];
}

export interface SubFlat {
  beds: number;
  area: string;
  price: string;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  location: string;
  price: string;
  priceValueLakh: number;
  type: string;
  categorySlug: PropertyCategorySlug;
  beds: number;
  baths: number;
  area: string;
  areaSqft: number;
  featured: boolean;
  description: string;
  /** Real photograph path (public/) — falls back to the MediaPlaceholder
   *  gradient via `gallery` when not set. */
  image?: string;
  gallery: MediaTone[];
  amenities: string[];
  investmentHighlights: string[];
  auctionInfo?: AuctionInfo;
  loanEligibility: LoanEligibility;
  documents: string[];
  mapQuery: string;

  // Project specification fields (DS-Max style)
  bedsRange?: string;
  areaRange?: string;
  priceRange?: string;
  subFlats?: SubFlat[];
  landmark?: string;
  approval?: string;
  landArea?: string;
  floors?: string;
  totalFlats?: number;
  blocks?: number;
  availability?: number;
}

// Real property listings are admin-managed (see /admin/properties) and
// live in the database — src/lib/properties.ts fetches them via Prisma.
// This array only ever held the Phase 3 static demo data and is kept as
// an empty typed export so anything still importing `Property`/`PROPERTIES`
// as a type-only reference doesn't break; don't add listings here.
export const PROPERTIES: Property[] = [];

export const BUDGET_RANGES = [
  { label: "Any Budget", min: 0, max: Infinity },
  { label: "Under ₹1,50,00,000", min: 0, max: 150 },
  { label: "₹1,50,00,000 – ₹3,00,00,000", min: 150, max: 300 },
  { label: "₹3,00,00,000 – ₹5,00,00,000", min: 300, max: 500 },
  { label: "Above ₹5,00,00,000", min: 500, max: Infinity },
];

export const PILLARS = [
  {
    title: "Trust",
    description:
      "Every relationship starts with transparency — no hidden costs, no rushed decisions.",
    icon: ShieldCheck,
  },
  {
    title: "Legal Support",
    description:
      "Independent legal verification on every title before a rupee changes hands.",
    icon: Scale,
  },
  {
    title: "Loan Assistance",
    description:
      "Bank tie-ups and hands-on support to structure financing that fits you.",
    icon: Landmark,
  },
  {
    title: "Investment Guidance",
    description:
      "Data-led counsel on yield, growth corridors, and long-term value.",
    icon: TrendingUp,
  },
];

export const AUCTION_JOURNEY = [
  {
    title: "Property Identification",
    description:
      "We shortlist auction properties matched to your budget and investment goals.",
    icon: Search,
  },
  {
    title: "Legal Verification",
    description:
      "Full title, encumbrance, and litigation check before you commit any capital.",
    icon: FileCheck2,
  },
  {
    title: "Bidding Support",
    description:
      "Guided participation in the bank auction, with valuation and bid strategy.",
    icon: Handshake,
  },
  {
    title: "Loan Arrangement",
    description: "Financing structured and coordinated with our banking partners.",
    icon: Landmark,
  },
  {
    title: "Registration",
    description: "End-to-end support through sale deed execution and registration.",
    icon: Stamp,
  },
  {
    title: "Khata Transfer",
    description: "Documentation followed through to a clean, transferred khata.",
    icon: FileSignature,
  },
];

export const PROCESS_STEPS = [
  {
    title: "Property Selection",
    description:
      "We shortlist properties matched to your budget, timeline, and investment goals — across every category we work in.",
    detail:
      "Every engagement starts with understanding what you're actually trying to achieve — a home to live in, a yield-generating asset, or a long-term appreciation play. We shortlist from bank auctions, resale, rental-income assets, off-market chance deals, and builder projects based on that goal, not on what happens to be listed that week.",
    icon: Compass,
  },
  {
    title: "Legal Verification",
    description:
      "Independent title, encumbrance, and litigation checks completed before you commit any capital.",
    detail:
      "Before any property reaches you, our legal team runs a full title chain review, encumbrance certificate check, and litigation search. For auction properties this includes SARFAESI notice verification; for resale, khata and succession history. You get a written legal opinion, not a verbal assurance.",
    icon: FileCheck2,
  },
  {
    title: "Bank Auction Process",
    description:
      "Guided participation in SARFAESI bank auctions, from EMD to final bid.",
    detail:
      "Bank auctions move fast and reward preparation. We help you understand reserve pricing, structure your EMD, and set a bid ceiling based on independent valuation — so you're never bidding on emotion or guesswork.",
    icon: Gavel,
  },
  {
    title: "Loan Arrangement",
    description: "Financing structured and coordinated with our banking partners.",
    detail:
      "We work with HDFC Bank, SBI, ICICI, Axis, and LIC Housing Finance to structure financing suited to your profile — including auction-specific lending, which not every bank handles the same way. We coordinate eligibility assessment through disbursement.",
    icon: Landmark,
  },
  {
    title: "Registration",
    description: "End-to-end support through sale deed execution and registration.",
    detail:
      "From stamp duty calculation to sub-registrar appointment, we manage the logistics of registration so the process is predictable rather than a scramble at the end.",
    icon: Stamp,
  },
  {
    title: "Khata Transfer",
    description: "Documentation followed through to a clean, transferred khata.",
    detail:
      "A registered sale deed isn't the finish line — khata transfer is what actually puts the property in your name for municipal and tax purposes. We follow this through to completion, not just to the point of sale.",
    icon: FileSignature,
  },
  {
    title: "Investment Consultation",
    description:
      "Ongoing, data-led counsel on yield, growth corridors, and portfolio strategy.",
    detail:
      "For many clients, one property becomes three or four over time. We stay engaged past the first transaction — advising on when to hold, when to sell, and where the next opportunity in Bengaluru's market is likely to emerge.",
    icon: LineChart,
  },
];

// The client's full partner-builder roster, verbatim — used by the sticky
// BuilderMarquee ticker (src/components/ui/BuilderMarquee.tsx), the only
// builder-roster surface on the site now that the in-page TopBuilders
// section has been removed. Do not merge, add to, or trim this list.
export const PARTNER_BUILDERS = [
  "Prestige",
  "Sobha",
  "Brigade",
  "Godrej",
  "Puravankara",
  "Vaishnavi",
  "Mahaveer",
  "Adarsh",
  "Shriram",
  "DS Max",
  "Concorde",
  "Sowparnika",
  "Total Environment",
  "L & T Realty",
  "Embassy",
  "Assetz",
  "Mantri",
  "Casagrand",
  "Salarpuria Sattva",
  "Aratt",
  "Axis Concept",
  "Mahindra",
  "Legacy",
  "Sumadhura",
  "Elegant",
  "Radiant",
  "Gopalan",
  "Century",
  "Tata Housing",
  "Kolte Patil",
  "RMZ",
  "DNR",
  "Nambiar",
  "Chaitanya",
  "Confident",
  "Prabhavathi",
  "Renaissance",
  "Bren",
  "Kristal",
  "DSR",
];

export const TESTIMONIALS = [
  {
    name: "Ramesh Iyer",
    role: "Bank Auction Buyer, Whitefield",
    quote:
      "Sarakki Homes walked us through a bank auction we'd never have attempted alone. Every document was verified before we bid — no surprises after.",
  },
  {
    name: "Divya & Arjun Rao",
    role: "First-time Buyers, Sarjapur",
    quote:
      "What stood out was how little they pushed. It felt like counsel, not sales. We understood every rupee and every clause.",
  },
  {
    name: "Kavitha Menon",
    role: "Investor, Koramangala",
    quote:
      "Their rental yield analysis was more rigorous than what our bank gave us. Three properties later, still the only firm we call first.",
  },
];

export const FAQS = [
  {
    question: "How does the bank auction process work with Sarakki Homes?",
    answer:
      "We identify verified auction properties, complete independent legal due-diligence, guide you through the bidding process, and support financing, registration, and khata transfer end to end.",
  },
  {
    question: "Do you charge for legal verification?",
    answer:
      "Legal verification is included as part of our consultancy engagement for every property we present — it's core to how we work, not an add-on.",
  },
  {
    question: "Can you help arrange a home loan?",
    answer:
      "Yes. We work with multiple banking partners to structure financing suited to your situation, from eligibility assessment through disbursement.",
  },
  {
    question: "What is khata transfer, and do you handle it?",
    answer:
      "Khata transfer registers you as the property's owner in municipal records for tax purposes. We manage this documentation through to completion.",
  },
  {
    question: "Which areas of Bengaluru do you operate in?",
    answer:
      "We operate across all of Bengaluru — urban and rural areas alike, from the city's core neighborhoods to its outskirts and surrounding growth corridors.",
  },
];
