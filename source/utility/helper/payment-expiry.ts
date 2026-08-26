import { IAccountModel } from "../../model/account/account-model";
import { AccountRole, AccountStatus } from "./constants/enum";

// The stored date is a UTC calendar-day boundary (e.g. "2027-08-26" ->
// midnight UTC) — access is allowed through the end of that day, not just
// until midnight, so this compares against 23:59:59.999 UTC of that date.
const endOfDayUTC = (d: Date): number => {
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return end.getTime();
};

/**
 * True for a Merchant or Admin whose portal access has expired — either the
 * expiry date's day has fully passed, or it was never set at all (no expiry
 * date means no access, not unlimited access). Super Admin has no such
 * concept.
 */
export const isPaymentExpired = (
  account: Pick<IAccountModel, "role" | "portalExpiryDate">
): boolean => {
  if (account.role !== AccountRole.merchant && account.role !== AccountRole.admin) return false;
  if (!account.portalExpiryDate) return true;
  return Date.now() > endOfDayUTC(account.portalExpiryDate);
};

/**
 * Call with a live Mongoose document. If the account's portal access has
 * expired and it's still flagged active, persists the flip to inactive — so
 * an expired Merchant/Admin isn't just rejected in-memory on every request,
 * their record actually reflects it (visible to Super Admin without them
 * having to separately notice the expiry date).
 */
export const syncExpiredStatus = async (account: IAccountModel): Promise<boolean> => {
  if (isPaymentExpired(account) && account.status === AccountStatus.active) {
    account.status = AccountStatus.inactive;
    await account.save();
    return true;
  }
  return false;
};

/** Monthly -> 1, Yearly -> 12, anything else -> 1 (safe default). */
export const monthsForPlan = (plan?: string | null): number => {
  if (plan === "Yearly") return 12;
  return 1;
};

/**
 * Extends from whichever is later — today, or the current expiry if it's
 * still in the future — so renewing before expiry doesn't waste remaining
 * paid time.
 */
export const extendExpiry = (currentExpiry: Date | null | undefined, months: number): Date => {
  const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
};
