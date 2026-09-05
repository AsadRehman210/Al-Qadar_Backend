import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { AccountModel } from "../../model/account/account-model";
import { accountDto } from "../../utility/dtos/account/account-dto";
import { mapDbToDto } from "../../utility/mapper/account/account-mapper";
import { AdminPaymentModel } from "../../model/admin/admin-payment-model";
import { adminPaymentDto } from "../../utility/dtos/admin/admin-payment-dto";
import { mapDbToDto as mapPaymentToDto, mapDbListToDtoList as mapPaymentListToDtoList } from "../../utility/mapper/admin/admin-payment-mapper";
import * as Enums from "../../utility/helper/constants/enum";
import { seedDefaultChartOfAccounts } from "../finance/chart-of-account-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { BCRYPT_SALT_ROUNDS } from "../../utility/helper/constants/security";

export interface AdminListOptions {
  search?: string;
  status?: string;
}

export type adminListDto = accountDto & { merchantCount?: number; paidAmount?: number | null };

// Deliberately narrow — the admins list table only ever renders these
// fields (plus createdBy/createdAt, kept for future audit display). Matches
// the .select() projection in getAll below; do not widen without adding the
// field to that projection too.
export interface adminListItemDto {
  id: string;
  code?: string | null;
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  status?: Enums.AccountStatus | null;
  isLocked?: boolean;
  merchantCount?: number;
  createdBy?: string | null;
  createdAt?: Date | null;
}

interface CreateAdminInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName?: string;
  country?: string;
  city?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  currency?: string;
  // Optional tenant brand color (hex). Left unset (null), this Admin's
  // portal uses the platform default (#3643AB) — see getTenantThemeColor.
  themeColor?: string;
  // Portal Expiry — set at creation, then only ever moved forward via
  // recordPayment below. Not in UpdateAdminInput on purpose: editing it
  // directly would bypass the payment ledger it's meant to reflect.
  portalExpiryDate?: string | Date;
}

interface CreateAdminResult {
  errorCode: Enums.ErrorCode;
  result: accountDto | null;
}

const generateAdminCode = async (): Promise<string> => {
  const count = await AccountModel.countDocuments({ role: Enums.AccountRole.admin });
  return `ADM-${String(count + 1).padStart(4, "0")}`;
};

const createAdmin = async (
  data: CreateAdminInput,
  createdById: mongoose.Types.ObjectId | string
): Promise<CreateAdminResult> => {
  const existing = await AccountModel.findOne({ email: data.email.toLowerCase() }).select("_id").lean();
  if (existing) {
    return { errorCode: Enums.ErrorCode.duplicate_entry, result: null };
  }

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
  const code = await generateAdminCode();

  const admin = await AccountModel.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    phone: data.phone || null,
    role: Enums.AccountRole.admin,
    status: Enums.AccountStatus.active,
    code,
    companyName: data.companyName || null,
    country: data.country || null,
    city: data.city || null,
    address: data.address || null,
    taxNumber: data.taxNumber || null,
    website: data.website || null,
    currency: data.currency || "SAR",
    themeColor: data.themeColor || null,
    portalExpiryDate: data.portalExpiryDate ? new Date(data.portalExpiryDate) : null,
    createdBy: createdById,
    adminId: null,
  });

  // Every new Admin gets its own Chart of Accounts seeded immediately, so
  // Loan/Expense/Provident Fund postings always have somewhere to land.
  const adminId = String(admin._id);
  await seedDefaultChartOfAccounts({ adminId, merchantId: null }, adminId);

  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(admin) };
};

// Merchant counts for a page of Admins, in one bulk query — mirrors the
// cross-domain aggregation pattern used elsewhere (e.g. stock totals by
// variant) instead of an N+1 count-per-row.
const getMerchantCountsByAdminIds = async (adminIds: string[]): Promise<Map<string, number>> => {
  if (!adminIds.length) return new Map();
  const rows = await AccountModel.aggregate([
    { $match: { role: Enums.AccountRole.merchant, adminId: { $in: adminIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$adminId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count as number]));
};

const getAll = async (
  page: number,
  limit: number,
  options: AdminListOptions = {}
): Promise<{ totalCount: number; result: adminListItemDto[] }> => {
  const startIndex = (page - 1) * limit;
  const filter = {
    role: Enums.AccountRole.admin,
    ...buildSearchCondition(options.search, ["name", "email", "code", "companyName"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await AccountModel.find(filter)
    .select("code name email companyName status lock_until createdBy createdAt")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await AccountModel.countDocuments(filter);

  const merchantCounts = await getMerchantCountsByAdminIds(data.map((d) => String(d._id)));
  const result: adminListItemDto[] = data.map((d) => ({
    id: d._id ? String(d._id) : "",
    code: d.code || null,
    name: d.name || null,
    email: d.email || null,
    companyName: d.companyName || null,
    status: d.status || null,
    isLocked: Boolean(d.lock_until && d.lock_until.getTime() > Date.now()),
    merchantCount: merchantCounts.get(String(d._id)) || 0,
    createdBy: d.createdBy ? String(d.createdBy) : null,
    createdAt: d.createdAt || null,
  }));

  return { totalCount: count, result };
};

const get = async (id: string): Promise<adminListDto | null> => {
  const data = await AccountModel.findOne({ _id: id, role: Enums.AccountRole.admin }).lean();
  if (!data) return null;
  const merchantCounts = await getMerchantCountsByAdminIds([id]);

  const paidAgg = await AdminPaymentModel.aggregate([
    { $match: { adminId: data._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return {
    ...mapDbToDto(data),
    merchantCount: merchantCounts.get(id) || 0,
    paidAmount: paidAgg[0]?.total ?? 0,
  };
};

interface AdminSummary {
  totalAdmins: number;
  activeAdmins: number;
  totalMerchants: number;
}

const getSummary = async (): Promise<AdminSummary> => {
  const [totalAdmins, activeAdmins, totalMerchants] = await Promise.all([
    AccountModel.countDocuments({ role: Enums.AccountRole.admin }),
    AccountModel.countDocuments({ role: Enums.AccountRole.admin, status: Enums.AccountStatus.active }),
    AccountModel.countDocuments({ role: Enums.AccountRole.merchant }),
  ]);
  return { totalAdmins, activeAdmins, totalMerchants };
};

interface UpdateAdminInput {
  name?: string;
  phone?: string;
  companyName?: string;
  country?: string;
  city?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  password?: string;
  themeColor?: string;
}

type AdminResult = { errorCode: Enums.ErrorCode; result: accountDto | null };

const findAdmin = async (id: string) => AccountModel.findOne({ _id: id, role: Enums.AccountRole.admin });

// Email is deliberately not editable here — it's the login identity, and
// changing it would need its own uniqueness/session-invalidation handling.
// Same restriction as Merchant's update, and as the Currency field.
const update = async (id: string, data: UpdateAdminInput): Promise<AdminResult> => {
  const admin = await findAdmin(id);
  if (!admin) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  if (data.name !== undefined) admin.name = data.name;
  if (data.phone !== undefined) admin.phone = data.phone || null;
  if (data.companyName !== undefined) admin.companyName = data.companyName || null;
  if (data.country !== undefined) admin.country = data.country || null;
  if (data.city !== undefined) admin.city = data.city || null;
  if (data.address !== undefined) admin.address = data.address || null;
  if (data.taxNumber !== undefined) admin.taxNumber = data.taxNumber || null;
  if (data.website !== undefined) admin.website = data.website || null;
  if (data.themeColor !== undefined) admin.themeColor = data.themeColor || null;
  if (data.password) admin.password = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  await admin.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(admin) };
};

const setStatus = async (id: string, status: Enums.AccountStatus): Promise<AdminResult> => {
  const admin = await findAdmin(id);
  if (!admin) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }
  admin.status = status;
  await admin.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(admin) };
};

const activateAdmin = (id: string): Promise<AdminResult> => setStatus(id, Enums.AccountStatus.active);
const deactivateAdmin = (id: string): Promise<AdminResult> => setStatus(id, Enums.AccountStatus.inactive);

// Only a Super Admin ever reaches this (enforced at the route level) — an
// Admin locked out by 3 failed attempts has no self-service or peer-unlock
// path, matching the requested hierarchy.
type UnlockResult = { errorCode: Enums.ErrorCode; result: accountDto | null };
const unlockAdmin = async (id: string): Promise<UnlockResult> => {
  const admin = await findAdmin(id);
  if (!admin) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }
  if (!admin.lock_until || admin.lock_until.getTime() <= Date.now()) {
    return { errorCode: Enums.ErrorCode.failed, result: null };
  }
  admin.lock_until = null;
  admin.failed_attempts = 0;
  await admin.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(admin) };
};

// Super Admin only (route-enforced). Clears the one-time opening-stock
// import lock so the Admin can run the Excel import again. Does not touch
// login lock_until — that is a separate unlock path.
const unlockOpeningStockAdmin = async (id: string): Promise<UnlockResult> => {
  const admin = await findAdmin(id);
  if (!admin) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }
  if (!admin.openingStockImported) {
    return { errorCode: Enums.ErrorCode.failed, result: null };
  }
  admin.openingStockImported = false;
  admin.openingStockImportedAt = null;
  await admin.save();
  return { errorCode: Enums.ErrorCode.success, result: mapDbToDto(admin) };
};

interface RecordAdminPaymentInput {
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
  date: Date | string;
  expiryDate: Date | string;
}

type AdminPaymentResult = { errorCode: Enums.ErrorCode; result: adminPaymentDto | null };

// The durable payment ledger — one row per payment/renewal. Extends the
// Admin's portalExpiryDate and reactivates them if their access had lapsed
// purely due to expiry. Always recorded by Super Admin — enforced at the
// route level (requireRole(super_admin)), same as activate/deactivate.
const recordPayment = async (
  adminId: string,
  data: RecordAdminPaymentInput,
  recorder: { id: mongoose.Types.ObjectId | string }
): Promise<AdminPaymentResult> => {
  const admin = await findAdmin(adminId);
  if (!admin) {
    return { errorCode: Enums.ErrorCode.not_exist, result: null };
  }

  const periodStart = new Date(data.date);
  const periodEnd = new Date(data.expiryDate);

  const payment = await AdminPaymentModel.create({
    adminId: admin._id,
    amount: data.amount,
    method: data.method || null,
    periodStart,
    periodEnd,
    reference: data.reference || null,
    notes: data.notes || null,
    recordedBy: recorder.id,
  });

  admin.portalExpiryDate = periodEnd;
  admin.lastPaymentDate = periodStart;
  if (admin.status !== Enums.AccountStatus.active) {
    admin.status = Enums.AccountStatus.active;
  }
  await admin.save();

  return { errorCode: Enums.ErrorCode.success, result: mapPaymentToDto(payment) };
};

const getPaymentHistory = async (adminId: string): Promise<adminPaymentDto[]> => {
  const payments = await AdminPaymentModel.find({ adminId }).sort({ createdAt: -1 }).lean();
  return mapPaymentListToDtoList(payments);
};

export {
  createAdmin,
  getAll,
  get,
  getSummary,
  update,
  activateAdmin,
  deactivateAdmin,
  unlockAdmin,
  unlockOpeningStockAdmin,
  recordPayment,
  getPaymentHistory,
};
