import { AccountRole, AccountStatus } from "../../helper/constants/enum";

// Note: password is intentionally NOT part of this DTO — it must never be
// sent back to the client.
export interface accountDto {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: AccountRole | null;
  status?: AccountStatus | null;
  code?: string | null;
  companyName?: string | null;
  businessCategory?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  website?: string | null;
  currency?: string | null;
  themeColor?: string | null;
  createdBy?: string | null;
  adminId?: string | null;
  isLocked?: boolean;
  last_login?: Date | null;
  portalExpiryDate?: Date | null;
  lastPaymentDate?: Date | null;
  openingStockImported?: boolean;
  openingStockImportedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  // Auth-only fields — set by auth-service.ts on the login response, never by
  // the plain mapper. `is_default_user` true = the Account owner (full access);
  // false = a sub-user session, whose `permissions`/`roleName` come from their
  // assigned Role. `is_super_admin` is what the super_admin portal keys on.
  is_default_user?: boolean;
  is_super_admin?: boolean;
  permissions?: string[];
  roleName?: string | null;
  userId?: string | null;
}
