import { prisma } from "@/lib/prisma";
import { PropertyWizard } from "@/components/admin/PropertyWizard";
import { getLocalityNames } from "@/lib/localities";

export const dynamic = "force-dynamic";

export default async function CreatePropertyPage() {
  // Query categories, builders, and property types for form selection options
  const categories = await prisma.category.findMany({
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });

  const builders = await prisma.builder.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const propertyTypes = await prisma.propertyType.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const localities = await getLocalityNames();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-title tracking-wide">
          Create Listing
        </h1>
        <p className="text-sm text-crm-text-secondary mt-1">
          Follow the steps below to populate a new luxury property listing in database.
        </p>
      </div>

      <PropertyWizard categories={categories} builders={builders} propertyTypes={propertyTypes} localities={localities} />
    </div>
  );
}
