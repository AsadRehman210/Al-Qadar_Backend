import mongoose from "mongoose";
import { AccountRole } from "./constants/enum";

// Shared across every business module (Employee, Department, Loan, Expense,
// Provident Fund, Finance, ...) — mirrors the same adminId/merchantId
// relationship already established on the Account model itself.
export interface TenantScope {
  adminId: string | null;
  merchantId: string | null;
}

export interface RequestUser {
  id: string;
  role: AccountRole;
  adminId?: string | null;
  // Present only for a sub-user session (see auth-service.ts login + the
  // middleware/auth.ts live check). `id`/`role`/`adminId` still describe the
  // PARENT tenant, so every scope helper below keeps working unchanged — a
  // sub-user always operates inside its parent tenant's data boundary.
  isSubUser?: boolean;
  sub?: string | null;
  permissions?: string[];
}

interface ScopeBody {
  adminId?: string | null;
  merchantId?: string | null;
}

/**
 * Determines the tenant a NEW record should be tagged with, based on who is
 * creating it:
 *  - merchant  -> the record is theirs (merchantId = self), under their own
 *                 parent admin (or null if they're a Super-Admin-direct merchant).
 *  - admin     -> the record belongs to the admin directly (merchantId = null).
 *  - super_admin -> must be explicit in the request body (same pattern already
 *                 used by POST /api/merchant).
 */
const resolveTenantScope = (user: RequestUser, body: ScopeBody): TenantScope => {
  if (user.role === AccountRole.merchant) {
    return { adminId: user.adminId || null, merchantId: user.id };
  }
  if (user.role === AccountRole.admin) {
    return { adminId: user.id, merchantId: null };
  }
  return { adminId: body.adminId || null, merchantId: body.merchantId || null };
};

/**
 * Builds the Mongo filter for LIST/READ endpoints.
 *
 * Employee Management, Finance, etc. are each own-data-only by default —
 * an Admin's own records and each of its Merchants' records are separate,
 * not merged into one pool:
 *  - merchant   -> always just its own (`merchantId: self`).
 *  - admin      -> its own DIRECT records only (`adminId: self, merchantId: null`),
 *                  unless it explicitly drills into one of its own Merchants
 *                  via `?merchantId=`. Passing a merchantId that ISN'T
 *                  actually one of this admin's own merchants is safe by
 *                  construction, not just convention: the combined filter
 *                  `{adminId: self, merchantId: X}` can only ever match a
 *                  document whose real adminId equals `self` AND whose
 *                  merchantId equals `X` — a merchant belonging to a
 *                  different admin never satisfies both at once, so it
 *                  simply returns zero rows rather than leaking another
 *                  tenant's data.
 *  - super_admin -> sees everything by default; the cascading "this admin +
 *                  all its merchants" oversight view (matching the frontend's
 *                  Admin<->Merchant filter UI) is opt-in via `?adminId=`
 *                  alone, and `?merchantId=` narrows to one specific merchant.
 */
const buildScopeFilter = (
  user: RequestUser,
  query: { adminId?: string; merchantId?: string }
): Record<string, unknown> => {
  if (user.role === AccountRole.merchant) {
    return { merchantId: user.id };
  }
  if (user.role === AccountRole.admin) {
    if (query.merchantId) {
      return { adminId: user.id, merchantId: query.merchantId };
    }
    return { adminId: user.id, merchantId: null };
  }
  if (query.merchantId) {
    return { merchantId: query.merchantId };
  }
  if (query.adminId) {
    return { adminId: query.adminId };
  }
  return {};
};

/**
 * buildScopeFilter()'s adminId/merchantId come through as plain strings —
 * fine for .find()/.countDocuments(), which cast query values against the
 * schema automatically, but .aggregate()'s $match does NOT auto-cast. A raw
 * string there is never `===` the stored ObjectId at the BSON level, so the
 * stage silently matches zero documents instead of erroring. Wrap a
 * filter with this before spreading it into any $match stage.
 */
const toAggregateFilter = (filter: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...filter };
  if (typeof result.adminId === "string") result.adminId = new mongoose.Types.ObjectId(result.adminId);
  if (typeof result.merchantId === "string") result.merchantId = new mongoose.Types.ObjectId(result.merchantId);
  return result;
};

/**
 * LIST/READ filter for own-tenant-only collections (Users, Roles). Unlike
 * buildScopeFilter(), a super_admin here is narrowed to its OWN records
 * (`adminId: null, merchantId: null`) rather than the platform-wide
 * "see everything" view — one tenant must never see another tenant's
 * users or roles.
 */
const buildOwnerScopeFilter = (user: RequestUser): Record<string, unknown> => {
  if (user.role === AccountRole.merchant) {
    return { merchantId: user.id };
  }
  if (user.role === AccountRole.admin) {
    return { adminId: user.id, merchantId: null };
  }
  return { adminId: null, merchantId: null };
};

export { resolveTenantScope, buildScopeFilter, buildOwnerScopeFilter, toAggregateFilter };
