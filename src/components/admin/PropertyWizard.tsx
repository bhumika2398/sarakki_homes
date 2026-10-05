"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Building,
  Gavel,
  Image as ImageIcon,
  CheckCircle2,
  Check,
  Save,
  Eye,
  ChevronDown,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { PropertyImageManager, type ManagedImage } from "@/components/admin/PropertyImageManager";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { LocalityCombobox } from "@/components/admin/LocalityCombobox";
import { formatRupees, looksLikeLakhs } from "@/lib/formatPrice";
import {
  propertyDetailsShape,
  propertyKindFor,
  isFieldVisible,
  PURPOSES,
  OWNERSHIP_TYPES,
  AVAILABILITY_STATUSES,
  FURNISHING,
  FACINGS,
  YES_NO,
  POWER_BACKUP,
  NEARBY_FACILITY_OPTIONS,
  AMENITY_OPTIONS,
} from "@/lib/propertyDetails";

// Form validation schema with Zod
const propertySchema = z.object({
  // .min(1, "...is required.") fires on a genuinely empty field; a
  // separate .refine adds the quality-of-data length check without
  // stealing that message when the field is simply blank (an empty
  // title used to report "must be at least 3 characters", which reads
  // like a length complaint rather than "you skipped this").
  title: z
    .string()
    .min(1, "Property name is required.")
    .refine((v) => v.trim().length >= 3, "Property name must be at least 3 characters."),
  categoryId: z.string().min(1, "Category is required."),
  // Property.builderId is now a nullable FK (was required — relaxed in
  // the schema specifically so this field could have a real "None"
  // option instead of forcing a pick every time).
  builderId: z.string().optional(),
  propertyTypeId: z.string().min(1, "Property type is required."),
  // Was two separate fields (a free-text display string + this numeric
  // value) that both had to be filled in sync by hand -- collapsed into
  // this single required field per the client's request. The display
  // string (e.g. "₹ 85 Lakh" / "₹ 2.40 Cr") is now derived automatically
  // from this number in onSubmit below, so there's nothing left to type
  // twice and nothing that can drift out of sync between the two.
  // Location, Address, Google Maps Location and Description all show no
  // asterisk in the UI, so — same rule as Builder above — they're
  // optional and must never block Continue/Publish. Property.location/
  // address/mapQuery/description are non-nullable DB columns, but an
  // empty string satisfies that just fine; nothing downstream requires
  // them to be non-empty.
  location: z.string().optional(),
  address: z.string().optional(),
  mapQuery: z.string().optional(),
  description: z.string().optional(),

  // Auction Info (optional)
  auctionInfo: z.object({
    bankName: z.string().optional(),
    auctionDate: z.string().optional(),
    emd: z.string().optional(),
    reservePrice: z.string().optional(),
    physicalPossession: z.boolean().default(false),
    legalStatus: z.string().optional(),
  }).optional(),

  // Details — none of these carry an asterisk in the UI, so none of
  // them are required.
  beds: z.string().optional(),
  baths: z.string().optional(),
  // "Area Display Text" was removed from the form: the single numeric
  // "Area (sqft)" below is the only input, and the display string stored
  // in `area` is generated from it on submit.
  area: z.string().optional(),
  areaSqft: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d+)?$/.test(v.trim()), "Area must be a positive number."),

  // Listing details — shared with the API (src/lib/propertyDetails.ts) so
  // client and server validate identically. Purpose + City are required.
  ...propertyDetailsShape,

  // Media is managed outside this schema by PropertyImageManager (an
  // ordered array, not a single registered input) — see `galleryImages`.

  // SEO
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  slug: z.string().optional(),
});

type PropertyFormData = z.output<typeof propertySchema>;

// What the edit page (src/app/admin/properties/[id]/edit/page.tsx)
// actually passes: every registered form field, always populated as a
// string (even "" — see that page's initialData mapping, never
// undefined) plus a few read-only extras the form itself never
// registers (id, images is managed outside react-hook-form — see
// galleryImages state below). Deliberately NOT `Partial<PropertyFormData>`
// — RHF infers defaultValues' type from `initialData || {...}` together
// with the resolver's own type, and an optional-everything shape there
// conflicts with the resolver's required fields.
interface PropertyWizardInitialData extends PropertyFormData {
  id?: string;
  images?: { url: string }[];
}

interface PropertyWizardProps {
  // slug is needed to detect the Bank Auction category (drives whether
  // the Auction Details step appears) — see isBankAuction below.
  categories: Array<{ id: string; title: string; slug: string }>;
  builders: Array<{ id: string; name: string }>;
  propertyTypes: Array<{ id: string; name: string }>;
  /** Shared Bengaluru locality list (Locality table). */
  localities: string[];
  initialData?: PropertyWizardInitialData;
}

// Was 6 always-shown steps (Basic Info / Auction Info / Property Details
// / Media / SEO Config / Review) — measured as genuinely tiring to click
// through, especially since two of those steps were skip-or-fill-nothing
// most of the time (Auction Info for the ~80% of listings that aren't
// bank auctions, SEO Config for admins who never touch meta tags).
// Collapsed to 3 steps for a typical listing, 4 for a bank auction:
//   1. Property Details — merges the old Basic Info + Property Details
//      (one scroll instead of two clicks; nothing here was ever
//      logically two separate steps, just two form pages).
//   2. Auction Details — `conditional: true`, filtered out of the
//      visible list entirely (not just grayed out) unless the selected
//      Category is Bank Auction, so non-auction listings never see it
//      at all.
//   3. Photos.
//   4. Review & Publish — SEO fields moved here as an optional,
//      collapsed-by-default section rather than their own step, since
//      they're rarely touched and always have a working default.
const ALL_STEPS = [
  { key: "details", label: "Property Details", icon: Building },
  { key: "auction", label: "Auction Details", icon: Gavel, conditional: true },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "review", label: "Review & Publish", icon: CheckCircle2 },
] as const;

type StepKey = (typeof ALL_STEPS)[number]["key"];

export function PropertyWizard({
  categories,
  builders: initialBuilders,
  propertyTypes: initialPropertyTypes,
  localities,
  initialData,
}: PropertyWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  // Local, mutable copy of the builders list — lets "+ Add Builder"
  // (below) create one inline and have it show up in the select
  // immediately, without leaving the wizard or reloading the page. The
  // server-fetched `initialBuilders` prop is just the seed.
  const [builders, setBuilders] = useState(initialBuilders);
  const [addingBuilder, setAddingBuilder] = useState(false);
  const [newBuilderName, setNewBuilderName] = useState("");
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderError, setBuilderError] = useState("");
  // Same "+ Add" pattern as Builder above, for the Property Type field —
  // reuses POST /api/admin/property-types (the standalone Property Types
  // admin page's own endpoint), so a type added here shows up there too.
  const [propertyTypes, setPropertyTypes] = useState(initialPropertyTypes);
  const [addingPropertyType, setAddingPropertyType] = useState(false);
  const [newPropertyTypeName, setNewPropertyTypeName] = useState("");
  const [propertyTypeSaving, setPropertyTypeSaving] = useState(false);
  const [propertyTypeError, setPropertyTypeError] = useState("");
  // Deleting the currently-selected Property Type — reuses DELETE
  // /api/admin/property-types/[id] (the standalone Property Types page's
  // own endpoint), so it only works when the type isn't assigned to any
  // property, same rule as deleting a Builder.
  const [deletePropertyTypeOpen, setDeletePropertyTypeOpen] = useState(false);
  const [deletePropertyTypeError, setDeletePropertyTypeError] = useState("");
  const [deletingPropertyType, setDeletingPropertyType] = useState(false);
  // SEO fields (title/description/slug overrides) folded into the
  // Review step as a collapsed-by-default section instead of their own
  // wizard step — every one of them already has a working default
  // (property name, description, auto-generated slug), so most admins
  // never need to open this at all.
  const [seoOpen, setSeoOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Which of the two submit buttons was actually clicked ("Save as
  // Draft" vs "Publish to Website") — a ref rather than state because
  // it needs to be readable synchronously inside onSubmit the moment
  // react-hook-form's validation resolves, with no re-render in between.
  const submitIntentRef = useRef<"draft" | "publish">("publish");
  const [errorMessage, setErrorMessage] = useState("");

  // Gallery lives outside react-hook-form: it's an ordered array built by
  // uploads/drag-reorder rather than a registered input, and the API has
  // always accepted `images: [{url}]` (PropertyImage.createMany) even
  // though the old UI could only ever supply one. Seeded from the
  // existing record when editing so saving doesn't wipe current photos.
  const [galleryImages, setGalleryImages] = useState<ManagedImage[]>(() => {
    const existing = initialData?.images;
    if (Array.isArray(existing)) {
      return existing
        .map((img: { url?: string }) => ({ url: img?.url ?? "" }))
        .filter((img: ManagedImage) => img.url);
    }
    return [];
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData || {
      title: "",
      categoryId: "",
      builderId: "",
      // Starts blank so the compulsory-fields validation has something
      // real to check, rather than a pre-filled default the admin never
      // actually chose.
      propertyTypeId: "",
      location: "",
      address: "",
      mapQuery: "",
      description: "",
      auctionInfo: {
        bankName: "",
        auctionDate: "",
        emd: "",
        reservePrice: "",
        physicalPossession: false,
        legalStatus: "Title Verified",
      },
      // "" not "0" — a pre-filled "0" sat in the field requiring the
      // admin to select-and-delete it before typing the real number;
      // empty + a "0" placeholder lets them just click and type.
      beds: "",
      baths: "",
      area: "",
      areaSqft: "",
      purpose: "Sale" as const,
      ownershipType: "",
      availabilityStatus: "",
      possessionDate: "",
      locality: "",
      city: "",
      pincode: "",
      landmark: "",
      nearbyFacilities: [] as string[],
      plotArea: "",
      builtUpArea: "",
      carpetArea: "",
      dimLength: "",
      dimWidth: "",
      roadWidth: "",
      totalFloors: "",
      floorDetails: "",
      balconies: "",
      parkingCars: "",
      parkingBikes: "",
      propertyAge: "",
      furnishing: "",
      facing: "",
      waterSupply: "",
      electricity: "",
      lift: "",
      powerBackup: "",
      amenities: [] as string[],
      expectedPrice: "",
      negotiable: "",
      videoUrl: "",
      seoTitle: "",
      seoDescription: "",
      slug: "",
    },
  });

  // Derived from handleSubmit's own signature rather than declared as
  // `z.output<typeof propertySchema>` and asserted to match — RHF's
  // resolver-inferred field type and a hand-derived zod type turned out
  // to be structurally close but not identical (a known sharp edge with
  // optional-with-default nested fields like auctionInfo.
  // physicalPossession), which surfaced as "two different types with
  // this name exist, but they are unrelated" the moment useForm was
  // given an explicit generic. Reading the type back off handleSubmit
  // keeps onSubmit/onInvalid always in sync with whatever RHF actually
  // produces.
  type FormValues = Parameters<Parameters<typeof handleSubmit>[0]>[0];

  const selectedCategoryId = watch("categoryId");
  const formValues = watch();

  // Which detail fields apply depends on the chosen Property Type (e.g.
  // no bedrooms/floors for a plot). Driven by the type's name since the
  // type list is admin-managed — see propertyKindFor.
  const kind = propertyKindFor(propertyTypes.find((t) => t.id === formValues.propertyTypeId)?.name);
  const show = (field: string) => isFieldVisible(kind, field);

  // Collapsible sections on the Details step. Always mounted (just
  // hidden) like the wizard steps themselves, so collapsing never drops
  // a value. All sections pop open when validation fails so the
  // offending field is visible.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    location: true,
    area: false,
    building: false,
    utilities: false,
    pricing: true,
  });
  const toggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const openAllSections = () =>
    setOpenSections((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])));

  // Whether the Auction Details step should appear is driven by the
  // selected Category's slug ("bank-auctions"), not the free-standing
  // Property Type field — those are two different classifications
  // (physical type: Villa/Flat/... vs. investment category: bank
  // auction/resale/...) that used to be conflated when Property Type
  // still had a "Bank Auction" option.
  const isBankAuctionCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId)?.slug === "bank-auctions",
    [categories, selectedCategoryId]
  );

  // The visible step list — "auction" only appears when it's actually
  // relevant. Recomputed whenever Category changes, which is also why
  // currentStep gets clamped below (picking a different category
  // mid-flow can shrink this list out from under the current index).
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => !("conditional" in s) || !s.conditional || isBankAuctionCategory),
    [isBankAuctionCategory]
  );

  useEffect(() => {
    setCurrentStep((prev) => Math.min(prev, steps.length - 1));
  }, [steps.length]);

  const currentStepKey: StepKey = steps[currentStep]?.key ?? "details";

  // Only the fields actually marked required (a red "*" in the UI —
  // Property Name, Property Type, Category, Price) block Continue.
  // Everything else on the merged "Property Details" step (Builder,
  // Location, Address, Google Maps Location, Description, Bedrooms/
  // Bathrooms/Area) is optional and must never hold up navigation.
  const DETAILS_STEP_FIELDS = [
    "title",
    "propertyTypeId",
    "categoryId",
    "areaSqft",
    ...Object.keys(propertyDetailsShape),
  ] as unknown as Parameters<typeof trigger>[0];

  const handleNext = async () => {
    // Basic step validation before moving forward. This used to do its
    // own manual `!formValues.x` checks and only ever show one generic
    // banner -- which meant a user got told *something* was missing but
    // never which field, and the per-field red text under each input
    // (via the Field component's `error` prop) never lit up because
    // nothing had actually run react-hook-form's own validation yet.
    // `trigger()` runs the real zodResolver validation for exactly the
    // relevant fields and populates `formState.errors` for each one that
    // fails, so the same inline messages the final submit already shows
    // (Property Name, Property Type, Category, Price, etc.) now appear
    // immediately when Next is clicked too -- the field itself is
    // highlighted, not just a top-of-page banner. onInvalid (wired to
    // handleSubmit below) remains the backstop for the Review & Publish
    // step, in case a step gets reached some other way.
    if (currentStepKey === "details") {
      const isValid = await trigger(DETAILS_STEP_FIELDS);
      if (!isValid) {
        openAllSections();
        setErrorMessage("Please fix the highlighted fields before continuing.");
        return;
      }
    }
    setErrorMessage("");
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  // Every currently-required field (see propertySchema) lives on step 0 —
  // if validation fails at submit time for any reason, jumping back
  // there and naming the fields is always the right, visible fix rather
  // than a submit button that quietly does nothing.
  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const labels: Record<string, string> = {
      title: "Property Name",
      categoryId: "Category",
      builderId: "Builder",
      propertyTypeId: "Property Type",
      location: "Location",
      address: "Address",
      mapQuery: "Google Maps Location",
      description: "Description",
      areaSqft: "Area (sqft)",
      purpose: "Property Purpose",
      city: "City",
      pincode: "PIN Code",
      possessionDate: "Possession Date",
      expectedPrice: "Price",
      videoUrl: "Video link",
    };
    const names = Object.keys(formErrors)
      .map((key) => labels[key] || key)
      .join(", ");
    setErrorMessage(
      names
        ? `Please fix the following before publishing: ${names}.`
        : "Please review the highlighted fields before publishing."
    );
    openAllSections();
    setCurrentStep(0);
  };

  const handleBack = () => {
    setErrorMessage("");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Inline "+ Add Builder" — reuses the same POST /api/admin/builders
  // the standalone Builders page uses (@/app/admin/builders), so the
  // new builder shows up there too, not just in this wizard's session.
  const handleAddBuilder = async () => {
    const name = newBuilderName.trim();
    if (!name) return;
    setBuilderSaving(true);
    setBuilderError("");
    try {
      const res = await fetch("/api/admin/builders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.builder) {
        setBuilders((prev) => [...prev, data.builder].sort((a, b) => a.name.localeCompare(b.name)));
        setValue("builderId", data.builder.id, { shouldDirty: true });
        setNewBuilderName("");
        setAddingBuilder(false);
      } else {
        setBuilderError(data.error || "Couldn't add that builder. Please try again.");
      }
    } catch {
      setBuilderError("Couldn't add that builder. Please try again.");
    } finally {
      setBuilderSaving(false);
    }
  };

  // Inline "+ Add Property Type" — reuses the same POST
  // /api/admin/property-types the standalone Property Types page uses.
  const handleAddPropertyType = async () => {
    const name = newPropertyTypeName.trim();
    if (!name) return;
    setPropertyTypeSaving(true);
    setPropertyTypeError("");
    try {
      const res = await fetch("/api/admin/property-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.propertyType) {
        setPropertyTypes((prev) => [...prev, data.propertyType].sort((a, b) => a.name.localeCompare(b.name)));
        setValue("propertyTypeId", data.propertyType.id, { shouldDirty: true });
        setNewPropertyTypeName("");
        setAddingPropertyType(false);
      } else {
        setPropertyTypeError(data.error || "Couldn't add that property type. Please try again.");
      }
    } catch {
      setPropertyTypeError("Couldn't add that property type. Please try again.");
    } finally {
      setPropertyTypeSaving(false);
    }
  };

  const handleDeletePropertyType = async () => {
    const id = watch("propertyTypeId");
    if (!id) return;
    setDeletingPropertyType(true);
    setDeletePropertyTypeError("");
    try {
      const res = await fetch(`/api/admin/property-types/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setPropertyTypes((prev) => prev.filter((t) => t.id !== id));
        setValue("propertyTypeId", "", { shouldDirty: true });
        setDeletePropertyTypeOpen(false);
      } else {
        // Most likely reason: this type is still assigned to one or more
        // properties (the API refuses the delete in that case) — shown
        // inside the dialog rather than closing it, so the admin sees why.
        setDeletePropertyTypeError(data.error || "Couldn't delete this property type. Please try again.");
      }
    } catch {
      setDeletePropertyTypeError("Couldn't delete this property type. Please try again.");
    } finally {
      setDeletingPropertyType(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setErrorMessage("");

    try {
      const endpoint = initialData ? `/api/admin/properties/${initialData.id}` : "/api/admin/properties";
      const method = initialData ? "PUT" : "POST";

      // Gallery order is meaningful — the API writes array index into
      // PropertyImage.order, and the public site reads images[0] as the
      // cover shot.
      //
      // Explicit publishing workflow: the two footer buttons on the
      // final step ("Save as Draft" / "Publish to Website") each set
      // submitIntentRef before the form submits, so status here always
      // reflects what the admin actually clicked — never a silent
      // default. This applies on both create AND edit now: an edit
      // previously left status untouched (so the buttons had no effect
      // on an existing listing), which is exactly the ambiguity this
      // wizard rework is meant to remove.
      const status = submitIntentRef.current === "draft" ? "UNPUBLISHED" : "PUBLISHED";
      // Display string for the single numeric Area (sqft) input.
      const areaNum = parseFloat(data.areaSqft ?? "");
      const hasArea = Number.isFinite(areaNum) && areaNum > 0;
      const payload = {
        ...data,
        area: hasArea ? `${Math.round(areaNum).toLocaleString("en-IN")} sq.ft` : "",
        areaSqft: hasArea ? String(Math.round(areaNum)) : "0",
        // Bedrooms/bathrooms don't apply to every property type; the
        // columns are NOT NULL so a hidden field is saved as 0.
        beds: show("beds") ? data.beds : "0",
        baths: show("baths") ? data.baths : "0",
        // The server derives the display string ("₹1,25,00,000") and the
        // legacy lakh column from expectedPrice (whole rupees).
        // A picked locality fills the short-address line when it was left
        // empty, so the website's location filter (matches the start of
        // `location`) finds the listing.
        location: data.location?.trim() || (data.locality ? `${data.locality}, ${data.city}` : ""),
        images: galleryImages,
        status,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // The wizard navigates away immediately, so it can't show its own
        // confirmation -- the properties list picks this up on mount and
        // shows it as a dismissing toast (see sh_crm_publish_toast there).
        sessionStorage.setItem(
          "sh_crm_publish_toast",
          status === "UNPUBLISHED"
            ? `"${data.title}" was saved as a draft. It won't appear on the website until you publish it.`
            : initialData
              ? `"${data.title}" was updated and published successfully.`
              : `"${data.title}" was published successfully.`
        );
        router.push("/admin/properties");
        router.refresh();
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || "Failed to submit property. Please try again.");
        setLoading(false);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Wizard Step Navigation (Left Panel) — premium vertical stepper.
          Upcoming steps stay clearly readable (never near-invisible) per
          the redesign brief; only the connecting rail + circle fill
          communicate progress. */}
      <div className="lg:col-span-1">
        <div className="relative pl-1">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-crm-border" />
          <div className="flex flex-col gap-1">
            {steps.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isActive = idx === currentStep;

              return (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => idx <= currentStep && setCurrentStep(idx)}
                  disabled={idx > currentStep}
                  className={cn(
                    "group relative flex items-center gap-3.5 rounded-sm px-3 py-3 text-left transition-all duration-200",
                    isActive ? "bg-crm-espresso/[0.04]" : "hover:bg-crm-espresso/[0.02]",
                    idx > currentStep && "cursor-default"
                  )}
                >
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300",
                      isActive
                        ? "border-crm-gold bg-crm-gold text-crm-espresso shadow-[0_0_0_4px_rgba(196,166,107,0.16)]"
                        : isCompleted
                        ? "border-crm-gold bg-crm-card text-crm-gold"
                        : "border-crm-border bg-crm-card text-crm-text-muted"
                    )}
                  >
                    {isCompleted ? <Check size={13} strokeWidth={3} /> : String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={cn(
                        "text-[13px] font-bold uppercase tracking-[0.06em] transition-colors duration-200",
                        isActive
                          ? "text-crm-text"
                          : isCompleted
                          ? "text-crm-text-secondary"
                          : "text-crm-text-muted"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Steps Panel (Right Panel) */}
      <div className="lg:col-span-3 crm-card p-8">
        <div className="flex items-center justify-end -mt-2 mb-4">
          <button
            type="button"
            onClick={() => setExitConfirmOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-crm-text-muted hover:text-crm-text transition-colors"
          >
            <X size={13} />
            <span>Exit</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8">
          {/* All four steps below are ALWAYS mounted — only CSS
              visibility (the `hidden` class) switches between them.
              This is the actual fix for the wizard "resetting" when
              navigating back and forth: react-hook-form's registered
              values live in its own internal store keyed by field name,
              not in the DOM, so they never depended on a step's inputs
              being mounted — but the step content used to be
              conditionally rendered with `{condition && <motion.div>}`,
              which unmounts/remounts the whole subtree (including
              PropertyImageManager's own internal drag/upload state,
              and briefly drops focus/selection). Always-mounted +
              hidden avoids that unmount entirely, at the cost of the
              old slide-in step transition animation. */}
            {/* Step: Property Details — merges what used to be two
                separate steps (Basic Info + Property Details). Same
                fields, same validation, just one scroll instead of an
                extra click-through. */}
            <div className={cn("space-y-8", currentStepKey !== "details" && "hidden")}>
                <StepHeading title="Property Details" description="Core listing parameters for buyers. Sections can be collapsed; only fields marked * are required." />

                <CollapsibleGroup title="Basic" open={openSections.basic} onToggle={() => toggleSection("basic")}>
                  <Field label="Property Name" required error={errors.title}>
                    <input
                      type="text"
                      {...register("title")}
                      className="crm-input"
                      placeholder="e.g. Prestige Lavender Residences"
                    />
                  </Field>

                  <Field label="Property Type" required error={errors.propertyTypeId}>
                    <div className="flex items-center gap-2">
                      <select {...register("propertyTypeId")} className="crm-select flex-1" defaultValue="">
                        <option value="" disabled>Select Property Type</option>
                        {propertyTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAddingPropertyType((v) => !v)}
                        title="Add a new property type"
                        aria-label="Add a new property type"
                        className="crm-btn-secondary shrink-0 !px-3"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePropertyTypeError("");
                          setDeletePropertyTypeOpen(true);
                        }}
                        disabled={!formValues.propertyTypeId}
                        title="Remove the selected property type"
                        aria-label="Remove the selected property type"
                        className="crm-btn-secondary shrink-0 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {addingPropertyType && (
                      <div className="mt-2 flex items-start gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={newPropertyTypeName}
                            onChange={(e) => setNewPropertyTypeName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddPropertyType();
                              }
                            }}
                            placeholder="New property type name"
                            className="crm-input"
                            autoFocus
                          />
                          {propertyTypeError && <p className="mt-1 text-[13px] text-red-600">{propertyTypeError}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={handleAddPropertyType}
                          disabled={propertyTypeSaving || !newPropertyTypeName.trim()}
                          className="crm-btn-gold shrink-0"
                        >
                          {propertyTypeSaving ? <Loader2 size={14} className="animate-spin" /> : <span>Add</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingPropertyType(false);
                            setNewPropertyTypeName("");
                            setPropertyTypeError("");
                          }}
                          disabled={propertyTypeSaving}
                          title="Cancel"
                          aria-label="Cancel adding a new property type"
                          className="crm-btn-secondary shrink-0 !px-3"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </Field>

                  <Field label="Category" required error={errors.categoryId}>
                    <select {...register("categoryId")} className="crm-select">
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.title}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Builder">
                    <div className="flex items-center gap-2">
                      <select {...register("builderId")} className="crm-select flex-1">
                        <option value="">None</option>
                        {builders.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAddingBuilder((v) => !v)}
                        title="Add a new builder"
                        aria-label="Add a new builder"
                        className="crm-btn-secondary shrink-0 !px-3"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {addingBuilder && (
                      <div className="mt-2 flex items-start gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={newBuilderName}
                            onChange={(e) => setNewBuilderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddBuilder();
                              }
                            }}
                            placeholder="New builder name"
                            className="crm-input"
                            autoFocus
                          />
                          {builderError && <p className="mt-1 text-[13px] text-red-600">{builderError}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={handleAddBuilder}
                          disabled={builderSaving || !newBuilderName.trim()}
                          className="crm-btn-gold shrink-0"
                        >
                          {builderSaving ? <Loader2 size={14} className="animate-spin" /> : <span>Add</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingBuilder(false);
                            setNewBuilderName("");
                            setBuilderError("");
                          }}
                          disabled={builderSaving}
                          title="Cancel"
                          aria-label="Cancel adding a new builder"
                          className="crm-btn-secondary shrink-0 !px-3"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </Field>
                  <Field label="Property Purpose" required error={errors.purpose}>
                    <select {...register("purpose")} className="crm-select">
                      {PURPOSES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Ownership Type" error={errors.ownershipType}>
                    <select {...register("ownershipType")} className="crm-select">
                      <option value="">Select</option>
                      <EnumOptions values={OWNERSHIP_TYPES} />
                    </select>
                  </Field>

                  <Field label="Availability Status" error={errors.availabilityStatus}>
                    <select {...register("availabilityStatus")} className="crm-select">
                      <option value="">Select</option>
                      <EnumOptions values={AVAILABILITY_STATUSES} />
                    </select>
                  </Field>

                  {formValues.availabilityStatus === "Under Construction" && (
                    <Field label="Possession Date" error={errors.possessionDate}>
                      <input type="date" {...register("possessionDate")} className="crm-input" />
                    </Field>
                  )}
                </CollapsibleGroup>

                <CollapsibleGroup title="Location" open={openSections.location} onToggle={() => toggleSection("location")}>
                  <Field label="Location (Short Address)" span2 error={errors.location}>
                    <input
                      type="text"
                      {...register("location")}
                      className="crm-input"
                      placeholder="e.g. Whitefield, Bengaluru"
                    />
                  </Field>

                  <Field label="Address (Full Details)" span2 error={errors.address}>
                    <input
                      type="text"
                      {...register("address")}
                      className="crm-input"
                      placeholder="e.g. Plot 15, Garden Layout, Phase 3, Whitefield, Bengaluru"
                    />
                  </Field>

                  <Field label="Google Maps Location" span2 error={errors.mapQuery}>
                    <input
                      type="text"
                      {...register("mapQuery")}
                      className="crm-input"
                      placeholder="e.g. Prestige Shantiniketan, Whitefield, Bengaluru"
                    />
                  </Field>
                  <Field label="Locality" error={errors.locality}>
                    <LocalityCombobox
                      value={formValues.locality ?? ""}
                      onChange={(next) => setValue("locality", next, { shouldDirty: true })}
                      options={localities}
                    />
                  </Field>

                  <Field label="City" required error={errors.city}>
                    <input type="text" {...register("city")} className="crm-input" placeholder="e.g. Bengaluru" />
                  </Field>

                  <Field label="PIN Code" error={errors.pincode}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      {...register("pincode", {
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          if (digits !== e.target.value) e.target.value = digits;
                        },
                      })}
                      className="crm-input"
                      placeholder="6-digit PIN code"
                    />
                  </Field>

                  <Field label="Landmark" error={errors.landmark}>
                    <input type="text" {...register("landmark")} className="crm-input" placeholder="e.g. Near Forum Mall" />
                  </Field>

                  <Field label="Nearby Facilities" span2>
                    <ChipSelect
                      options={NEARBY_FACILITY_OPTIONS}
                      value={formValues.nearbyFacilities ?? []}
                      onChange={(next) => setValue("nearbyFacilities", next, { shouldDirty: true })}
                    />
                  </Field>
                </CollapsibleGroup>

                <CollapsibleGroup title="Area & Dimensions" open={openSections.area} onToggle={() => toggleSection("area")}>
                  {/* Replaces the old "Area Display Text" + "Area in Sqft
                      (Value)" pair. The display text ("3,200 sq.ft") is now
                      generated from this number in onSubmit. */}
                  <Field label="Area (sqft)" error={errors.areaSqft}>
                    <input type="number" min={0} step="any" {...register("areaSqft")} className="crm-input" placeholder="e.g. 3200" />
                  </Field>

                  {show("plotArea") && (
                    <Field label="Plot Area (sqft)" error={errors.plotArea}>
                      <input type="number" min={0} step="any" {...register("plotArea")} className="crm-input" placeholder="e.g. 2400" />
                    </Field>
                  )}

                  {show("builtUpArea") && (
                    <Field label="Built-up Area (sqft)" error={errors.builtUpArea}>
                      <input type="number" min={0} step="any" {...register("builtUpArea")} className="crm-input" placeholder="e.g. 2800" />
                    </Field>
                  )}

                  {show("carpetArea") && (
                    <Field label="Carpet Area (sqft)" error={errors.carpetArea}>
                      <input type="number" min={0} step="any" {...register("carpetArea")} className="crm-input" placeholder="e.g. 2200" />
                    </Field>
                  )}

                  {show("dimLength") && (
                    <Field label="Property Dimensions (Length × Width, ft)" error={errors.dimLength ?? errors.dimWidth}>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} step="any" {...register("dimLength")} className="crm-input" placeholder="Length" aria-label="Length in feet" />
                        <span className="text-crm-text-muted" aria-hidden="true">×</span>
                        <input type="number" min={0} step="any" {...register("dimWidth")} className="crm-input" placeholder="Width" aria-label="Width in feet" />
                      </div>
                    </Field>
                  )}

                  <Field label="Road Width (ft)" error={errors.roadWidth}>
                    <input type="number" min={0} step="any" {...register("roadWidth")} className="crm-input" placeholder="e.g. 40" />
                  </Field>
                </CollapsibleGroup>

                  <CollapsibleGroup
                    title={kind === "plot" ? "Plot Details" : "Building Details"}
                    open={openSections.building}
                    onToggle={() => toggleSection("building")}
                  >
                    {show("beds") && (
                      <Field label="Bedrooms (BHK)">
                        <input type="number" min={0} {...register("beds")} className="crm-input" placeholder="0" />
                      </Field>
                    )}

                    {show("baths") && (
                      <Field label="Bathrooms">
                        <input type="number" min={0} {...register("baths")} className="crm-input" placeholder="0" />
                      </Field>
                    )}

                    {show("balconies") && (
                      <Field label="Balconies" error={errors.balconies}>
                        <input type="number" min={0} {...register("balconies")} className="crm-input" placeholder="0" />
                      </Field>
                    )}

                    {show("parkingCars") && (
                      <Field label="Parking (Car / Bike)" error={errors.parkingCars ?? errors.parkingBikes}>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} {...register("parkingCars")} className="crm-input" placeholder="Cars" aria-label="Car parking count" />
                          <input type="number" min={0} {...register("parkingBikes")} className="crm-input" placeholder="Bikes" aria-label="Bike parking count" />
                        </div>
                      </Field>
                    )}

                    {show("totalFloors") && (
                      <Field label="Total Floors">
                        <input type="text" {...register("totalFloors")} className="crm-input" placeholder="e.g. Ground + 4" />
                      </Field>
                    )}

                    {show("floorDetails") && (
                      <Field label="Floor Details">
                        <input type="text" {...register("floorDetails")} className="crm-input" placeholder="e.g. 3rd floor of 5" />
                      </Field>
                    )}

                    {show("propertyAge") && (
                      <Field label="Property Age">
                        <input type="text" {...register("propertyAge")} className="crm-input" placeholder="e.g. 3 years" />
                      </Field>
                    )}

                    {show("furnishing") && (
                      <Field label="Furnishing Status" error={errors.furnishing}>
                        <select {...register("furnishing")} className="crm-select">
                          <option value="">Select</option>
                          <EnumOptions values={FURNISHING} />
                        </select>
                      </Field>
                    )}

                    <Field label="Facing" error={errors.facing}>
                      <select {...register("facing")} className="crm-select">
                        <option value="">Select</option>
                        <EnumOptions values={FACINGS} />
                      </select>
                    </Field>
                  </CollapsibleGroup>

                <CollapsibleGroup title="Utilities & Amenities" open={openSections.utilities} onToggle={() => toggleSection("utilities")}>
                  <Field label="Water Supply">
                    <input type="text" {...register("waterSupply")} className="crm-input" placeholder="e.g. BWSSB + Borewell" />
                  </Field>

                  <Field label="Electricity Connection">
                    <input type="text" {...register("electricity")} className="crm-input" placeholder="e.g. BESCOM, 3-phase" />
                  </Field>

                  {show("lift") && (
                    <Field label="Lift" error={errors.lift}>
                      <select {...register("lift")} className="crm-select">
                        <option value="">Select</option>
                        <EnumOptions values={YES_NO} />
                      </select>
                    </Field>
                  )}

                  {show("powerBackup") && (
                    <Field label="Power Backup" error={errors.powerBackup}>
                      <select {...register("powerBackup")} className="crm-select">
                        <option value="">Select</option>
                        <EnumOptions values={POWER_BACKUP} />
                      </select>
                    </Field>
                  )}

                  <Field label="Amenities" span2>
                    <ChipSelect
                      options={AMENITY_OPTIONS}
                      value={formValues.amenities ?? []}
                      onChange={(next) => setValue("amenities", next, { shouldDirty: true })}
                    />
                  </Field>
                </CollapsibleGroup>

                <CollapsibleGroup title="Pricing & Description" open={openSections.pricing} onToggle={() => toggleSection("pricing")}>
                  {/* Whole rupees, entered as the actual amount (e.g. 12500000).
                      This is the single price field; the website display
                      string and the legacy lakh value are derived from it. */}
                  <Field label={formValues.purpose === "Rent" ? "Monthly Rent (₹)" : "Price (₹)"} required error={errors.expectedPrice} span2>
                    <input
                      type="text"
                      inputMode="numeric"
                      {...register("expectedPrice", {
                        // Digits only, live — commas/decimals/symbols never land in the field.
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          if (digits !== e.target.value) e.target.value = digits;
                        },
                      })}
                      className="crm-input"
                      placeholder="e.g. 12500000"
                    />
                    {formValues.expectedPrice && Number(formValues.expectedPrice) > 0 && (
                      <p className="mt-1 text-[13px] text-crm-text-secondary">
                        Will show as <strong>{formatRupees(Number(formValues.expectedPrice))}</strong>
                        {formValues.purpose === "Rent" ? " / month" : ""}
                      </p>
                    )}
                    {looksLikeLakhs(Number(formValues.expectedPrice), formValues.purpose) && (
                      <p className="mt-1 text-[13px] text-amber-500">
                        Looks like lakhs? Enter the full amount in rupees — 85 lakh is 8500000, not 85.
                      </p>
                    )}
                  </Field>

                  <Field label="Negotiable" error={errors.negotiable}>
                    <select {...register("negotiable")} className="crm-select">
                      <option value="">Select</option>
                      <EnumOptions values={YES_NO} />
                    </select>
                  </Field>

                  <Field label="Overview" span2 error={errors.description}>
                    <textarea
                      rows={5}
                      {...register("description")}
                      className="crm-textarea resize-none"
                      placeholder="Enter a descriptive overview of the property..."
                    />
                  </Field>
                </CollapsibleGroup>
            </div>

            {/* Step: Auction Details — only ever shown when the selected
                Category is Bank Auction (it's also filtered out of the
                left-hand step list entirely in that case, via `steps`
                above), so a non-auction listing never sees it. Still
                always mounted per the note above — harmless, since
                auctionInfo is optional and only persisted when the
                category is Bank Auction (see onSubmit / the API route). */}
            <div className={cn("space-y-8", currentStepKey !== "auction" && "hidden")}>
                <StepHeading title="Auction Details" description="Bank auction specifics buyers will ask about." />

                <FieldGroup title="Auction Details">
                    <Field label="Bank Name / Notice Info">
                      <input
                        type="text"
                        {...register("auctionInfo.bankName")}
                        className="crm-input"
                        placeholder="e.g. State Bank of India, SARFAESI Auction"
                      />
                    </Field>

                    <Field label="Auction Date">
                      <input type="date" {...register("auctionInfo.auctionDate")} className="crm-input" />
                    </Field>

                    <Field label="EMD Amount">
                      <input
                        type="text"
                        {...register("auctionInfo.emd")}
                        className="crm-input"
                        placeholder="e.g. ₹ 21.5 Lakh"
                      />
                    </Field>

                    <Field label="Reserve Price">
                      <input
                        type="text"
                        {...register("auctionInfo.reservePrice")}
                        className="crm-input"
                        placeholder="e.g. ₹ 2.15 Cr"
                      />
                    </Field>

                    <Field label="Legal Status">
                      <input
                        type="text"
                        {...register("auctionInfo.legalStatus")}
                        className="crm-input"
                        placeholder="e.g. Title Verified, Clear Deed"
                      />
                    </Field>

                    <div className="md:col-span-2 flex items-center justify-between rounded-sm border border-crm-border bg-crm-bg/60 p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-crm-text">Physical Possession</span>
                        <span className="text-[13px] text-crm-text-muted mt-0.5">Has the bank taken active physical possession?</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register("auctionInfo.physicalPossession")}
                        className="h-4 w-4 rounded border border-crm-border accent-crm-gold"
                      />
                    </div>
                  </FieldGroup>
            </div>

            {/* Step: Photos */}
            <div className={cn("space-y-8", currentStepKey !== "photos" && "hidden")}>
                <StepHeading title="Photos" description="Upload photographs, or paste image URLs. The first image is used as the cover." />

                <FieldGroup title="Property Images">
                  <PropertyImageManager images={galleryImages} onChange={setGalleryImages} />
                </FieldGroup>

                <FieldGroup title="Video (optional)">
                  {/* Link only (YouTube / Vimeo / hosted file). Direct video
                      upload would need its own Storage bucket + route. */}
                  <Field label="Video link" span2 error={errors.videoUrl}>
                    <input
                      type="url"
                      {...register("videoUrl")}
                      className="crm-input"
                      placeholder="https://www.youtube.com/watch?v=…"
                    />
                  </Field>
                </FieldGroup>
            </div>

            {/* Step: Review & Publish */}
            <div className={cn("space-y-8", currentStepKey !== "review" && "hidden")}>
                <StepHeading
                  title="Review & Publish"
                  description='Check everything below, then choose "Save as Draft" to keep working on it privately, or "Publish to Website" to make it live immediately.'
                />

                <div className="rounded-sm border border-crm-border bg-crm-bg/60 p-7">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                      <span className="crm-label">Property Name</span>
                      <p className="mt-1.5 font-crm-body text-xl text-crm-text">{formValues.title || "N/A"}</p>
                      <p className="mt-1 text-sm text-crm-text-secondary">{formValues.location || "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <span className="crm-label">Price</span>
                      <p className="mt-1.5 font-crm-display text-2xl font-semibold text-crm-gold">
                        {formValues.expectedPrice ? formatRupees(Number(formValues.expectedPrice)) : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-5 border-t border-crm-border pt-5 sm:grid-cols-4">
                    <ReviewStat
                      label="Type"
                      value={propertyTypes.find((t) => t.id === formValues.propertyTypeId)?.name ?? ""}
                    />
                    <ReviewStat label="Bedrooms" value={formValues.beds || "0"} />
                    <ReviewStat label="Bathrooms" value={formValues.baths || "0"} />
                    <ReviewStat label="Area" value={formValues.areaSqft ? `${formValues.areaSqft} sq.ft` : "N/A"} />
                    <ReviewStat label="Purpose" value={formValues.purpose || "N/A"} />
                    <ReviewStat label="City" value={formValues.city || "N/A"} />
                  </div>
                </div>

                {/* Optional and collapsed by default — see seoOpen above. */}
                <div className="rounded-sm border border-crm-border">
                  <button
                    type="button"
                    onClick={() => setSeoOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <div>
                      <span className="text-sm font-semibold text-crm-text">Advanced: Search &amp; URL Settings</span>
                      <p className="text-[13px] text-crm-text-muted mt-0.5">
                        Optional — leave blank to use sensible defaults automatically.
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn("text-crm-text-muted transition-transform duration-200", seoOpen && "rotate-180")}
                    />
                  </button>

                  {seoOpen && (
                    <div className="border-t border-crm-border p-5">
                      <FieldGroup title="Search Metadata">
                        <Field label="SEO Title Override" span2>
                          <input
                            type="text"
                            {...register("seoTitle")}
                            className="crm-input"
                            placeholder="Keep empty to use Property Name"
                          />
                        </Field>

                        <Field label="SEO Meta Description" span2>
                          <textarea
                            rows={3}
                            {...register("seoDescription")}
                            className="crm-textarea resize-none"
                            placeholder="Summarize listing in 150-160 characters..."
                          />
                        </Field>

                        <Field label="Slug (URL endpoint)" span2>
                          <input
                            type="text"
                            {...register("slug")}
                            className="crm-input"
                            placeholder="e.g. sarjapur-emerald-villa"
                          />
                        </Field>
                      </FieldGroup>
                    </div>
                  )}
                </div>
            </div>

          {/* Form Actions Buttons */}
          <div className="flex items-center justify-between border-t border-crm-border pt-6 mt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0 || loading}
              className="crm-btn-secondary"
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>

            {currentStep < steps.length - 1 ? (
              <button type="button" onClick={handleNext} className="crm-btn-primary">
                <span>Continue</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {/* Preview only makes sense once a listing has a real
                    public URL — i.e. it already exists (edit mode). In
                    create mode there's nothing to preview yet, so the
                    button is simply not shown rather than linking to a
                    404 or forcing an unwanted save first. */}
                {initialData?.slug && (
                  <a
                    href={`/properties/${initialData.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="crm-btn-secondary"
                  >
                    <Eye size={14} />
                    <span>Preview</span>
                  </a>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  onClick={() => {
                    submitIntentRef.current = "draft";
                  }}
                  className="crm-btn-secondary"
                >
                  {loading && submitIntentRef.current === "draft" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save as Draft</span>
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  onClick={() => {
                    submitIntentRef.current = "publish";
                  }}
                  className="crm-btn-gold"
                >
                  {loading && submitIntentRef.current === "publish" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <span>Publish to Website</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={exitConfirmOpen}
        title="Exit without publishing?"
        message="Everything you've entered on this listing will be discarded. This can't be undone."
        confirmLabel="Exit"
        tone="danger"
        onConfirm={() => router.push("/admin/properties")}
        onCancel={() => setExitConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deletePropertyTypeOpen}
        title={`Delete "${propertyTypes.find((t) => t.id === watch("propertyTypeId"))?.name ?? ""}"?`}
        message={
          deletePropertyTypeError ||
          "This removes the property type permanently, for every listing in the CRM, not just this one. It only works if no properties are currently assigned to it."
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deletingPropertyType}
        onConfirm={handleDeletePropertyType}
        onCancel={() => {
          setDeletePropertyTypeOpen(false);
          setDeletePropertyTypeError("");
        }}
      />
    </div>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="crm-section-heading">{title}</h3>
      <p className="text-sm text-crm-text-secondary mt-1">{description}</p>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-crm-gold border-b border-crm-border pb-2.5">
        {title}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">{children}</div>
    </div>
  );
}

function CollapsibleGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-crm-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-crm-gold">{title}</span>
        <ChevronDown
          size={16}
          className={cn("text-crm-text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <div className={cn("border-t border-crm-border p-5", !open && "hidden")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">{children}</div>
      </div>
    </div>
  );
}

function EnumOptions({ values }: { values: readonly string[] }) {
  return (
    <>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  );
}

/** Multi-select as toggle chips (wraps cleanly on mobile). */
function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[13px] font-medium transition-colors",
              on
                ? "border-crm-gold bg-crm-gold/15 text-crm-text"
                : "border-crm-border text-crm-text-secondary hover:border-crm-gold/60"
            )}
          >
            {on && <Check size={12} strokeWidth={3} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
  span2,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
  error?: { message?: string };
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", span2 && "md:col-span-2")}>
      <label className="crm-label">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && <span className="block text-[13px] text-red-600">{String(error.message)}</span>}
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="crm-label">{label}</span>
      <p className="mt-1 text-sm font-semibold text-crm-text">{value}</p>
    </div>
  );
}

// Simple Helper function
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
