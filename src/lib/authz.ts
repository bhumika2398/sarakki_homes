import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Role-based authorization for the CRM's API routes.
 *
 * SECURITY: previously every /api/admin route checked only "is there a
 * session?", which meant any signed-in staff member — including a
 * SALES_EXECUTIVE — could delete listings, edit site-wide settings, or
 * create new ADMIN accounts. Authentication is not authorization; this
 * module adds the missing second half.
 *
 * Middleware (src/middleware.ts) is the outer gate: it blocks anonymous
 * requests to /admin and /api/admin entirely. These helpers are the
 * inner gate, enforcing *which* signed-in staff may do *what*. Both
 * layers are required — middleware can't see route-specific intent
 * (a GET list vs a DELETE), and a route handler shouldn't assume the
 * middleware ran.
 */

export const ROLES = ["ADMIN", "MANAGER", "SALES_EXECUTIVE", "CONTENT_MANAGER"] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
}

/** Capability groups, so route handlers name an intent rather than
 *  hardcoding role lists that drift apart over time. */
export const CAN = {
  /** Create/edit/delete staff accounts and roles. Deliberately
   *  ADMIN-only: this is the privilege-escalation path. */
  MANAGE_STAFF: ["ADMIN"] as Role[],
  /** Site-wide settings, CMS copy, SEO — affects the public website. */
  MANAGE_SETTINGS: ["ADMIN", "MANAGER", "CONTENT_MANAGER"] as Role[],
  /** Property inventory, categories, builders, blog, testimonials. */
  MANAGE_CONTENT: ["ADMIN", "MANAGER", "CONTENT_MANAGER"] as Role[],
  /** Deleting inventory is destructive and public-facing — kept
   *  narrower than general content editing. */
  DELETE_CONTENT: ["ADMIN", "MANAGER"] as Role[],
  /** Leads, tasks, enquiries, customers — the sales workflow. */
  MANAGE_CRM: ["ADMIN", "MANAGER", "SALES_EXECUTIVE"] as Role[],
  /** Read-only reference data (category titles) needed by both content
   *  editors and sales staff — e.g. picking a category when logging an
   *  enquiry's requirement. Not sensitive, so broader than MANAGE_CONTENT. */
  VIEW_CATEGORIES: ["ADMIN", "MANAGER", "CONTENT_MANAGER", "SALES_EXECUTIVE"] as Role[],
  /** Correcting recorded lead details (name, phone, email, ...) in place.
   *  Narrower than MANAGE_CRM: a wrong phone number changes who the lead
   *  is, so it's an admin/manager action with an audit trail. */
  CORRECT_LEADS: ["ADMIN", "MANAGER"] as Role[],
  /** Revenue figures and commission data. */
  VIEW_REVENUE: ["ADMIN", "MANAGER"] as Role[],
  /** Any authenticated staff member. */
  ANY_STAFF: [...ROLES] as Role[],
} as const;

/**
 * Returns the signed-in user, or a ready-to-return error response.
 *
 * Usage in a route handler:
 *   const auth = await requireRole(CAN.MANAGE_STAFF);
 *   if (!auth.ok) return auth.response;
 *   // auth.user is typed and guaranteed present past this point
 */
export async function requireRole(
  allowed: readonly Role[]
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  const user = session.user as unknown as SessionUser;

  if (!user.role || !allowed.includes(user.role)) {
    // 403, not 404 — the caller is authenticated, we're telling them
    // their account lacks the privilege. Deliberately says nothing
    // about what the resource contains.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your role does not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}
