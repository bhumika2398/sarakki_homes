"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building,
  Tags,
  Hammer,
  Home,
  MessageSquare,
  Users,
  Globe,
  Quote,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckSquare,
  UserCog,
  Landmark,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grouped by actual business workflow, not alphabetically — audited
 * against real usage rather than kept as a generic CRM template. Prior
 * structure had two real problems this fixes:
 *
 * - "Users" (System group) was a hardcoded fake page — three invented
 *   names, no real data. "Staff" is the one real, working staff CRUD
 *   over the same User table. Users is removed entirely.
 * - "Website CMS" and "Settings" both edited company name / WhatsApp /
 *   social links — the exact same fields on two different screens.
 *   CMS is now scoped to homepage copy only (renamed "Website
 *   Content"); Settings owns all business/contact/system config.
 *
 * Blog is intentionally left out of this nav (not deleted — the code
 * and its CRUD still exist) because no public /blog route consumes it
 * yet; re-add the nav entry once a real blog page ships.
 *
 * Enquiries/Customers are grouped separately from Leads/Tasks:
 * different data source (auto-derived from the public contact form,
 * not an actively-managed sales pipeline) and a different purpose,
 * even though both ultimately represent a prospective buyer.
 */
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      { label: "Properties", href: "/admin/properties", icon: Building },
      { label: "Categories", href: "/admin/categories", icon: Tags },
      { label: "Builders", href: "/admin/builders", icon: Hammer },
      { label: "Property Types", href: "/admin/property-types", icon: Home },
      { label: "Localities", href: "/admin/localities", icon: MapPin },
    ],
  },
  {
    label: "Sales Pipeline",
    items: [
      { label: "Leads", href: "/admin/leads", icon: Target },
      { label: "Tasks", href: "/admin/tasks", icon: CheckSquare },
      { label: "Loan Applications", href: "/admin/loan-applications", icon: Landmark },
    ],
  },
  {
    label: "Website Enquiries",
    items: [
      { label: "Enquiries", href: "/admin/enquiries", icon: MessageSquare },
      { label: "Customers", href: "/admin/customers", icon: Users },
    ],
  },
  {
    label: "Website",
    items: [
      { label: "Website Content", href: "/admin/cms", icon: Globe },
      { label: "Testimonials", href: "/admin/testimonials", icon: Quote },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Staff", href: "/admin/staff", icon: UserCog },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut({ callbackUrl: "/admin/login" });
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-screen shrink-0 flex-col bg-crm-espresso"
    >
      {/* Top Header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/[0.06]">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col"
            >
              <span className="font-crm-display text-base tracking-[0.1em] uppercase text-crm-ivory font-bold">
                Sarakki Homes
              </span>
              <span className="text-[12px] uppercase tracking-[0.17em] text-crm-gold mt-0.5 font-semibold">
                Enterprise CRM
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-white/70 hover:border-crm-gold/40 hover:text-crm-gold transition-colors duration-200"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            {!collapsed && (
              <p className="px-3.5 pb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-white/55">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-sm px-3.5 py-3 text-[16px] tracking-wide transition-all duration-200",
                      isActive
                        ? "bg-white/[0.06] text-crm-ivory font-semibold"
                        : "text-white/75 font-medium hover:bg-white/[0.035] hover:text-white/95"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="crmActiveIndicator"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-crm-gold"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={cn(
                        "shrink-0 transition-colors duration-200",
                        isActive ? "text-crm-gold" : "text-white/40 group-hover:text-white/70"
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile and Logout */}
      <div className="p-3 border-t border-white/[0.06]">
        {!collapsed && session?.user && (
          <div className="mb-3 flex items-center gap-2.5 rounded-sm bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crm-gold/15 text-[10px] font-bold text-crm-gold">
              {session.user.name?.charAt(0) ?? "A"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-crm-ivory truncate">
                {session.user.name}
              </span>
              <span className="text-[12px] text-white/65 uppercase tracking-wide font-medium">
                {session.user.role || "SALES_EXECUTIVE"}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-sm px-3.5 py-3 text-[16px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-all duration-200"
        >
          <LogOut size={16} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
