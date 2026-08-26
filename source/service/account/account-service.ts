import { AccountModel } from "../../model/account/account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";

const DEFAULT_CURRENCY = "SAR";
export const DEFAULT_THEME_COLOR = "#3643AB";

// The one true currency for a tenant — whichever Merchant owns the record,
// or failing that its parent/direct Admin — so every currency-bearing form
// (Job, Designation, Expense, ...) can be locked to it instead of trusting
// whatever the client sends.
const getTenantCurrency = async (scope: TenantScope): Promise<string> => {
  const ownerId = scope.merchantId || scope.adminId;
  if (!ownerId) return DEFAULT_CURRENCY;

  const owner = await AccountModel.findById(ownerId).select("currency").lean();
  return owner?.currency || DEFAULT_CURRENCY;
};

// Same resolution order as getTenantCurrency: a Merchant's own color (if
// set at creation) wins, otherwise it inherits its parent Admin's color.
// Falls back to the platform default when nobody up the chain has set one.
const getTenantThemeColor = async (scope: TenantScope): Promise<string> => {
  const ownerId = scope.merchantId || scope.adminId;
  if (!ownerId) return DEFAULT_THEME_COLOR;

  const owner = await AccountModel.findById(ownerId).select("themeColor adminId").lean();
  if (owner?.themeColor) return owner.themeColor;
  if (owner?.adminId) {
    const parentAdmin = await AccountModel.findById(owner.adminId).select("themeColor").lean();
    if (parentAdmin?.themeColor) return parentAdmin.themeColor;
  }
  return DEFAULT_THEME_COLOR;
};

export { getTenantCurrency, getTenantThemeColor };
