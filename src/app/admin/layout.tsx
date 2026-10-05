"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";

// A light-touch header title lookup — keyed by path prefix, longest match
// wins. Purely cosmetic (the header breadcrumb), doesn't touch any page's
// own content/logic.
const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/admin/dashboard", title: "Overview" },
  { prefix: "/admin/leads", title: "Leads" },
  { prefix: "/admin/tasks", title: "Tasks" },
  { prefix: "/admin/loan-applications", title: "Loan Applications" },
  { prefix: "/admin/properties/create", title: "Create Listing" },
  { prefix: "/admin/properties", title: "Properties" },
  { prefix: "/admin/categories", title: "Categories" },
  { prefix: "/admin/builders", title: "Builders" },
  { prefix: "/admin/localities", title: "Localities" },
  { prefix: "/admin/enquiries", title: "Website Enquiries" },
  { prefix: "/admin/customers", title: "Customers" },
  { prefix: "/admin/cms", title: "Website Content" },
  { prefix: "/admin/blog", title: "Blog" },
  { prefix: "/admin/testimonials", title: "Testimonials" },
  { prefix: "/admin/staff", title: "Staff" },
  { prefix: "/admin/settings", title: "Settings" },
];

function pageTitleFor(pathname: string): string {
  const match = PAGE_TITLES.filter((p) => pathname.startsWith(p.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0];
  return match?.title ?? "Console";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div data-scope="crm" className="flex h-screen w-screen overflow-hidden bg-crm-bg text-crm-text font-crm-body">
      {/* Collapsible Sidebar */}
      <Sidebar />

      {/* Main Panel */}
      <div className="flex flex-1 flex-col overflow-hidden bg-crm-bg">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-crm-border px-8 bg-crm-card">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-crm-text-muted tracking-[0.1em] uppercase font-semibold">
              CRM
            </span>
            <span className="text-[13px] text-crm-text-muted">/</span>
            <span className="text-[16px] font-semibold text-crm-text tracking-wide">
              {pageTitleFor(pathname)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[12px] text-crm-text-muted uppercase tracking-[0.12em] font-semibold">
              Live Database
            </span>
          </div>
        </header>

        {/* Content Render Outlet */}
        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="mx-auto max-w-7xl space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
