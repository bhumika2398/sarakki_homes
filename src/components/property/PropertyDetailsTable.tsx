import type { DetailSection } from "@/lib/propertyDetails";

/**
 * Listing details captured in the CRM (ownership, area breakdown,
 * building, utilities, location facilities). Renders only the sections
 * and rows that actually have a value, so older listings with none of
 * these fields filled in show nothing extra.
 */
export function PropertyDetailsTable({ sections }: { sections: DetailSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-2xl">Property Details</h2>
      <div className="mt-6 flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{section.title}</p>
            {section.rows.length > 0 && (
              <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border py-3 text-sm">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {section.tags && section.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {section.tags.map((tag) => (
                  <span key={tag} className="rounded-sm border border-border bg-surface px-3 py-1.5 text-xs text-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
