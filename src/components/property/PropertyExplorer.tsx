"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PropertyFilters,
  DEFAULT_FILTERS,
  type FilterState,
} from "@/components/property/PropertyFilters";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { PropertyList } from "@/components/property/PropertyList";
import { BUDGET_RANGES, type Property } from "@/lib/data";

export function PropertyExplorer({ properties, localities }: { properties: Property[]; localities: string[] }) {
  // Pre-fill filters from the URL so an external link lands on an
  // already-filtered grid, not just the generic listing page:
  // ?category=<slug> from the header's Properties dropdown/category
  // cards (an unrecognized slug just yields an empty grid — PropertyGrid's
  // EmptyState already handles that), ?location=<text> from the
  // homepage hero's search bar.
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    category: searchParams.get("category") ?? "",
    location: searchParams.get("location") ?? "",
  });

  // The useState initializer above only ever runs on mount — clicking a
  // different category from the header's Properties dropdown while
  // already on this page navigates client-side without remounting this
  // component (same route, only the query string changes), so the
  // initial-state-only version silently kept showing the old category.
  // Re-sync whenever the URL's own filter params actually change.
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      category: searchParams.get("category") ?? "",
      location: searchParams.get("location") ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("category"), searchParams.get("location")]);

  const filtered = useMemo(() => {
    const budget = BUDGET_RANGES[filters.budgetIndex];
    let result = properties.filter((p) => {
      if (filters.location && !p.location.startsWith(filters.location)) return false;
      if (filters.category && p.categorySlug !== filters.category) return false;
      if (p.priceValueLakh < budget.min || p.priceValueLakh > budget.max) return false;
      return true;
    });

    if (filters.sort === "price-asc") {
      result = [...result].sort((a, b) => a.priceValueLakh - b.priceValueLakh);
    } else if (filters.sort === "price-desc") {
      result = [...result].sort((a, b) => b.priceValueLakh - a.priceValueLakh);
    }

    return result;
  }, [properties, filters]);

  return (
    <div className="flex flex-col gap-8">
      <PropertyFilters
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        locations={localities}
      />
      {filters.view === "list" ? (
        <PropertyList properties={filtered} onReset={() => setFilters(DEFAULT_FILTERS)} />
      ) : (
        <PropertyGrid properties={filtered} onReset={() => setFilters(DEFAULT_FILTERS)} />
      )}
    </div>
  );
}
