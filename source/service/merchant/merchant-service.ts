import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { AccountModel } from "../../model/account/account-model";
import { accountDto } from "../../utility/dtos/account/account-dto";
import { mapDbToDto } from "../../utility/mapper/account/account-mapper";
import { MerchantPaymentModel } from "../../model/merchant/merchant-payment-model";
import { merchantPaymentDto } from "../../utility/dtos/merchant/merchant-payment-dto";
import { mapDbToDto as mapPaymentToDto, mapDbListToDtoList as mapPaymentListToDtoList } from "../../utility/mapper/merchant/merchant-payment-mapper";
import * as Enums from "../../utility/helper/constants/enum";
import { seedDefaultChartOfAccounts } from "../finance/chart-of-account-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { BCRYPT_SALT_ROUNDS } from "../../utility/helper/constants/security";

export interface MerchantListOptions {
  search?: string;
  status?: string;
  adminId?: string;
}

export type merchantListDto = accountDto & { adminName?: string | null; paidAmount?: number | null };

// Deliberately narrow — the merchants list table only ever renders these
// fields (plus createdBy/createdAt, kept for future audit display). Matches
// the .select() projection in getAll below; do not widen without adding the
// field to that projection too.
export interface merchantListItemDto {
  id: string;
  code?: string | null;
  name?: string | null;
  email?: string | null;
  businessCategory?: string | null;
  status?: Enums.AccountStatus | null;
  isLocked?: boolean;
  adminId?: string | null;
  adminName?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
}

interface CreateMerchantInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName?: string;
  businessCategory?: string;
  country?: string;
  city?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  currency?: string;
  adminId?: string | null;
  // Optional tenant brand color (hex). Left unset (null), this Merchant's
  // portal falls back to its parent Admin's color, then the platform
  // default — see getTenantThemeColor. Set only at creation, same as Admin's.
  themeColor?: string;
  // Portal Expiry — set at creation, then only ever moved forward via
  // recordPayment below. Not in UpdateMerchantInput on purpose: editing it
  // directly would bypass the payment ledger it's meant to reflect.
  portalExpiryDate?: string | Date;
}

interface Creator {
  id: mongoose.Types.ObjectId | string;
  role: Enums.AccountRole;
}

interface CreateMerchantResult {
  errorCode: Enums.ErrorCode;
  result: accountDto | null;
}

const generateMerchantCode = async (): Promise<string> => {
  const count = await AccountModel.countDocuments({ role: Enums.AccountRole.merchant });
  return `MER-${String(count + 1).padStart(4, "0")}`;
};

const createMerchant = async (
  data: CreateMerchantInput,
  creator: Creator
): Promise<CreateMerchantResult> => {
  const existing = await AccountModel.findOne({ email: data.email.toLowerCase() }).select("_id").lean();
  if (existing) {
    return { errorCode: Enums.ErrorCode.duplicate_entry, result: null };
  }

  // Security enforcement, not a UI nicety: an Admin can only ever create a
  // Merchant under itself, no matter what adminId the request body contains.
  let adminId: string | null = null;
  if (creator.role === Enums.AccountRole.admin) {
    adminId = creator.id.toString();
  } else {
    if (data.adminId) {
      const parentAdmin = await AccountModel.findOne({ _id: data.adminId, role: Enums.AccountRole.admin }).lean();
      if (!parentAdmin) {
        return { errorCode: Enums.ErrorCode.invalid_id, result: null };
      }
      adminId = data.adminId;
    } else {
      adminId = null; // Super-Admin-direct merchant
    }
  }

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
  const code = await generateMerchantCode();

  const merchant = await AccountModel.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    phone: data.phone || null,
    role: Enums.AccountRole.merchant,
    status: Enums.AccountStatus.active,
    code,
    companyName: data.companyName || null,
    businessCategory: data.businessCategory || null,
    country: data.country || null,
    city: data.city || null,
    address: data.address || null,
    taxNumber: data.taxNumber || null,
    website: data.website || null,
    currency: data.currency || "SAR",
    themeColor: data.themeColor || null,
    portalExpiryDate: data.portalExpiryDate ? new Date(data.portalExpiryDate) : null,
    createdBy: creator.id,
    adminId,
  });

  // Every new Merchant gets its own Chart of Accounts seeded immediately —
  // a Merchant's finances are tracked separately from its parent Admin's.
  const merchantId = String(merchant._id);
  await seedDefaultChartOfAccounts({ adminId, merchantId }, merchantId);

  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

type MerchantResult = { errorCode: Enums.ErrorCode; result: accountDto | null };

const findMerchant = async (id: string) =>
  AccountModel.findOne({ _id: id, role: Enums.AccountRole.merchant });

// A Merchant's "tenant scope" is its own adminId field pointing at its
// parent Admin (not the usual adminId/merchantId pair used elsewhere) — an
// Admin only ever sees merchants it created; a Super Admin sees all of them
// unless it narrows to one Admin via ?adminId=.
const buildMerchantScopeFilter = (
  requester: Creator,
  query: { adminId?: string }
): Record<string, unknown> => {
  const base: Record<string, unknown> = { role: Enums.AccountRole.merchant };
  if (requester.role === Enums.AccountRole.admin) {
    base.adminId = new mongoose.Types.ObjectId(String(requester.id));
  } else if (requester.role === Enums.AccountRole.super_admin && query.adminId) {
    base.adminId = new mongoose.Types.ObjectId(query.adminId);
  }
  return base;
};

const withAdminName = (doc: Parameters<typeof mapDbToDto>[0]): merchantListDto => {
  const dto = mapDbToDto(doc);
  const adminDoc = doc.adminId as unknown as Record<string, unknown> | null;
  if (adminDoc && typeof adminDoc === "object") {
    return { ...dto, adminId: String(adminDoc._id), adminName: (adminDoc.name as string) || null };
  }
  return { ...dto, adminName: null };
};

const mapToListItem = (doc: any): merchantListItemDto => {
  const adminDoc = doc.adminId as unknown as Record<string, unknown> | null;
  const isAdminPopulated = adminDoc && typeof adminDoc === "object";
  return {
    id: doc._id ? String(doc._id) : "",
    code: doc.code || null,
    name: doc.name || null,
    email: doc.email || null,
    businessCategory: doc.businessCategory || null,
    status: doc.status || null,
    isLocked: Boolean(doc.lock_until && doc.lock_until.getTime() > Date.now()),
    adminId: isAdminPopulated ? String((adminDoc as Record<string, unknown>)._id) : doc.adminId ? String(doc.adminId) : null,
    adminName: isAdminPopulated ? ((adminDoc as Record<string, unknown>).name as string) || null : null,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    createdAt: doc.createdAt || null,
  };
};

const getAll = async (
  requester: Creator,
  query: { adminId?: string },
  page: number,
  limit: number,
  options: MerchantListOptions = {}
): Promise<{ totalCount: number; result: merchantListItemDto[] }> => {
  const startIndex = (page - 1) * limit;
  const filter = {
    ...buildMerchantScopeFilter(requester, query),
    ...buildSearchCondition(options.search, ["name", "email", "code", "companyName"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await AccountModel.find(filter)
    .select("code name email businessCategory status lock_until createdBy createdAt adminId")
    .populate("adminId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await AccountModel.countDocuments(filter);

  return { totalCount: count, result: data.map(mapToListItem) };
};

const get = async (id: string, requester: Creator, query: { adminId?: string }): Promise<merchantListDto | null> => {
  const filter = buildMerchantScopeFilter(requester, query);
  const data = await AccountModel.findOne({ _id: id, ...filter }).populate("adminId", "name").lean();
  if (!data) return null;

  const paidAgg = await MerchantPaymentModel.aggregate([
    { $match: { merchantId: data._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return { ...withAdminName(data), paidAmount: paidAgg[0]?.total ?? 0 };
};

interface MerchantSummary {
  totalMerchants: number;
  activeMerchants: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards.
const getSummary = async (requester: Creator, query: { adminId?: string }): Promise<MerchantSummary> => {
  const filter = buildMerchantScopeFilter(requester, query);

  const [totalMerchants, activeMerchants] = await Promise.all([
    AccountModel.countDocuments(filter),
    AccountModel.countDocuments({ ...filter, status: Enums.AccountStatus.active }),
  ]);

  return { totalMerchants, activeMerchants };
};

const linkToAdmin = async (merchantId: string, adminId: string): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  const admin = await AccountModel.findOne({ _id: adminId, role: Enums.AccountRole.admin }).lean();
  if (!admin) {
    return { errorCode: Enums.ErrorCode.invalid_id, result: null };
  }

  merchant.adminId = new mongoose.Types.ObjectId(adminId);
  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

const unlinkFromAdmin = async (merchantId: string): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  merchant.adminId = null;
  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

const setStatus = async (merchantId: string, status: Enums.AccountStatus): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  // Super Admin override — works regardless of payment expiry in either
  // direction (can deactivate an otherwise-current merchant, or activate one
  // whose payment has technically lapsed).
  merchant.status = status;
  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

const activateMerchant = (merchantId: string): Promise<MerchantResult> =>
  setStatus(merchantId, Enums.AccountStatus.active);

const deactivateMerchant = (merchantId: string): Promise<MerchantResult> =>
  setStatus(merchantId, Enums.AccountStatus.inactive);

// A Merchant with no parent Admin (adminId null, a direct Super Admin
// merchant) can only ever be unlocked by the Super Admin. A Merchant that
// does have a parent Admin can be unlocked by that Admin OR the Super Admin —
// the same ownership check as update/recordPayment, just phrased as "not
// this Admin's merchant" instead of the inverse.
const unlockMerchant = async (merchantId: string, unlocker: Creator): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  if (unlocker.role === Enums.AccountRole.admin) {
    const merchantAdminId = merchant.adminId ? String(merchant.adminId) : null;
    if (merchantAdminId !== String(unlocker.id)) {
      return { errorCode: Enums.ErrorCode.no_access, result: null };
    }
  }

  if (!merchant.lock_until || merchant.lock_until.getTime() <= Date.now()) {
    return { errorCode: Enums.ErrorCode.failed, result: null };
  }

  merchant.lock_until = null;
  merchant.failed_attempts = 0;
  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

// Same parent hierarchy as login unlock: Super Admin always; a Merchant's
// own Admin only. The Merchant cannot unlock itself. Independent of
// lock_until — this only clears the one-time opening-stock import flag.
const unlockOpeningStockMerchant = async (merchantId: string, unlocker: Creator): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  if (unlocker.role === Enums.AccountRole.admin) {
    const merchantAdminId = merchant.adminId ? String(merchant.adminId) : null;
    if (merchantAdminId !== String(unlocker.id)) {
      return { errorCode: Enums.ErrorCode.no_access, result: null };
    }
  }

  if (!merchant.openingStockImported) {
    return { errorCode: Enums.ErrorCode.failed, result: null };
  }

  merchant.openingStockImported = false;
  merchant.openingStockImportedAt = null;
  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

interface UpdateMerchantInput {
  name?: string;
  phone?: string;
  companyName?: string;
  businessCategory?: string;
  country?: string;
  city?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  password?: string;
  themeColor?: string;
}

// Email and currency are deliberately not editable here — email is the
// login identity, and currency is locked tenant-wide at creation (see the
// account model's currency field comment and every currency-locked form
// this UI already enforces).
const updateMerchant = async (
  merchantId: string,
  data: UpdateMerchantInput,
  requester: Creator
): Promise<MerchantResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  // An Admin may only edit a Merchant that is actually theirs.
  if (requester.role === Enums.AccountRole.admin) {
    const merchantAdminId = merchant.adminId ? String(merchant.adminId) : null;
    if (merchantAdminId !== String(requester.id)) {
      return { errorCode: Enums.ErrorCode.no_access, result: null };
    }
  }

  if (data.name !== undefined) merchant.name = data.name;
  if (data.phone !== undefined) merchant.phone = data.phone || null;
  if (data.companyName !== undefined) merchant.companyName = data.companyName || null;
  if (data.businessCategory !== undefined) merchant.businessCategory = data.businessCategory || null;
  if (data.country !== undefined) merchant.country = data.country || null;
  if (data.city !== undefined) merchant.city = data.city || null;
  if (data.address !== undefined) merchant.address = data.address || null;
  if (data.taxNumber !== undefined) merchant.taxNumber = data.taxNumber || null;
  if (data.website !== undefined) merchant.website = data.website || null;
  if (data.themeColor !== undefined) merchant.themeColor = data.themeColor || null;
  if (data.password) merchant.password = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  await merchant.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(merchant) };
};

interface RecordPaymentInput {
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
  date: Date | string;
  expiryDate: Date | string;
}

interface RecorderContext {
  id: mongoose.Types.ObjectId | string;
  role: Enums.AccountRole;
}

type PaymentResult = { errorCode: Enums.ErrorCode; result: merchantPaymentDto | null };

// The durable payment ledger — one row per payment/renewal. Extends the
// merchant's portalExpiryDate and reactivates them if their access had
// lapsed purely due to expiry (an explicit Super Admin deactivation is a
// separate concern, untouched by this).
const recordPayment = async (
  merchantId: string,
  data: RecordPaymentInput,
  recorder: RecorderContext
): Promise<PaymentResult> => {
  const merchant = await findMerchant(merchantId);
  if (!merchant) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  // An Admin may only record a payment for a Merchant that is actually
  // theirs — enforced here, not just hidden in the UI.
  if (recorder.role === Enums.AccountRole.admin) {
    const merchantAdminId = merchant.adminId ? String(merchant.adminId) : null;
    if (merchantAdminId !== String(recorder.id)) {
      return { errorCode: Enums.ErrorCode.no_access, result: null };
    }
  }

  const periodStart = new Date(data.date);
  const periodEnd = new Date(data.expiryDate);

  const payment = await MerchantPaymentModel.create({
    merchantId: merchant._id,
    amount: data.amount,
    method: data.method || null,
    periodStart,
    periodEnd,
    reference: data.reference || null,
    notes: data.notes || null,
    recordedBy: recorder.id,
    adminId: merchant.adminId || null,
  });

  merchant.portalExpiryDate = periodEnd;
  merchant.lastPaymentDate = periodStart;
  if (merchant.status !== Enums.AccountStatus.active) {
    merchant.status = Enums.AccountStatus.active;
  }
  await merchant.save();

  return { errorCode: Enums.ErrorCode.success, result: mapPaymentToDto(payment) };
};

const getPaymentHistory = async (merchantId: string): Promise<merchantPaymentDto[]> => {
  const payments = await MerchantPaymentModel.find({ merchantId }).sort({ createdAt: -1 }).lean();
  return mapPaymentListToDtoList(payments);
};

export {
  createMerchant,
  updateMerchant,
  linkToAdmin,
  unlinkFromAdmin,
  activateMerchant,
  deactivateMerchant,
  unlockMerchant,
  unlockOpeningStockMerchant,
  recordPayment,
  getPaymentHistory,
  getAll,
  get,
  getSummary,
};
