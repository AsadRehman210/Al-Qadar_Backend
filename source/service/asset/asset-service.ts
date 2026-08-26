import moment from "moment";
import { AssetModel, AssetStatus, DepreciationMethod } from "../../model/asset/asset-model";
import { AssetCategoryModel } from "../../model/asset/asset-category-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { assetDto } from "../../utility/dtos/asset/asset-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/asset/asset-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { toDateOnly } from "../../utility/helper/date-only";
import { createJournalEntry } from "../finance/journal-service";
import {
  ensureFixedAssetsAccount,
  ensureAccumulatedDepreciation,
  ensureAccountsPayable,
  ensureLossOnDisposal,
  ensureGainOnDisposal,
  ensureCashOnHand,
} from "../../utility/helper/finance-accounts";

const POPULATE: [string, string][] = [
  ["categoryId", "code name"],
  ["assignedToId", "first_name last_name"],
  ["assignmentHistory.employeeId", "first_name last_name"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

const inTenant = (scope: TenantScope) => ({ adminId: scope.adminId, merchantId: scope.merchantId });

const round2 = (n: number): number => Math.round((n || 0) * 100) / 100;

export interface AssetListOptions {
  search?: string;
  status?: string;
  categoryId?: string;
  assignedToId?: string;
  location?: string;
}

interface CreateAssetInput {
  name: string;
  categoryId: string;
  serialNumber?: string;
  location?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyUntil?: string;
  currentValue?: number;
  currency?: string;
  status?: AssetStatus;
  notes?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeYears?: number;
  salvageValue?: number;
}

type AssetErrorCode =
  | "success"
  | "not_found"
  | "category_not_found"
  | "employee_not_found"
  | "already_disposed"
  | "already_assigned"
  | "not_assigned"
  | "maintenance_record_not_found";

interface AssetResult {
  errorCode: AssetErrorCode;
  result: assetDto | null;
}

const generateAssetTag = async (scope: TenantScope): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await AssetModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `AST-${year}-${String(count + 1).padStart(3, "0")}`;
};

// Mirrors the frontend's own calcDepreciationSchedule/calcCurrentBookValue
// (admin/src/pages/Assets/assetFakeData.js) exactly — the display-only
// schedule stays client-computed (zero backend need), but the REALIZED
// figure at disposal time must be computed identically here so the posted
// journal entry matches what the Depreciation tab already showed the user.
const calcBookValueAt = (
  asset: { purchaseCost?: number | null; salvageValue?: number | null; usefulLifeYears?: number | null; depreciationMethod?: string | null; purchaseDate?: Date | null },
  asOfDate: Date
): number => {
  const cost = asset.purchaseCost || 0;
  const salvage = asset.salvageValue || 0;
  const years = asset.usefulLifeYears || 5;
  const method = asset.depreciationMethod || "straight_line";
  const purchaseDate = asset.purchaseDate ? moment(asset.purchaseDate) : moment();

  const rows: number[] = [];
  if (method === "straight_line") {
    const annualDep = (cost - salvage) / years;
    let bookValue = cost;
    for (let y = 1; y <= years; y++) {
      bookValue = Math.max(salvage, round2(bookValue - round2(annualDep)));
      rows.push(bookValue);
    }
  } else {
    const rate = 2 / years;
    let bookValue = cost;
    for (let y = 1; y <= years; y++) {
      const dep = Math.max(0, round2(Math.min(bookValue * rate, bookValue - salvage)));
      bookValue = Math.max(salvage, round2(bookValue - dep));
      rows.push(bookValue);
    }
  }

  const yearsElapsed = moment(asOfDate).diff(purchaseDate, "years");
  if (yearsElapsed <= 0) return cost;
  const idx = Math.min(yearsElapsed, rows.length) - 1;
  return rows[idx] ?? rows[rows.length - 1] ?? 0;
};

const create = async (
  data: CreateAssetInput,
  scope: TenantScope,
  createdBy: string
): Promise<AssetResult> => {
  const category = await AssetCategoryModel.findOne({ _id: data.categoryId, ...inTenant(scope) }).lean();
  if (!category) {
    return { errorCode: "category_not_found", result: null };
  }

  const assetTag = await generateAssetTag(scope);
  const purchaseCost = data.purchaseCost || 0;

  const asset = await AssetModel.create({
    assetTag,
    name: data.name,
    categoryId: data.categoryId,
    serialNumber: data.serialNumber || null,
    location: data.location || null,
    purchaseDate: data.purchaseDate ? toDateOnly(data.purchaseDate) : null,
    purchaseCost,
    warrantyUntil: data.warrantyUntil ? toDateOnly(data.warrantyUntil) : null,
    currentValue: data.currentValue ?? purchaseCost,
    currency: data.currency || "SAR",
    status: data.status || "In storage",
    notes: data.notes || null,
    depreciationMethod: data.depreciationMethod || "straight_line",
    usefulLifeYears: data.usefulLifeYears || 5,
    salvageValue: data.salvageValue || 0,
    locationHistory: data.location
      ? [{ location: data.location, date: new Date(), notes: "Initial placement on purchase", movedBy: createdBy }]
      : [],
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  // Capitalize acquisition cost — mirrors Production's own accrual
  // convention (Dr Expense/Asset / Cr Accounts Payable), treated as owed
  // rather than instantly cash-paid.
  if (purchaseCost > 0) {
    const fixedAssets = await ensureFixedAssetsAccount(scope, createdBy);
    const accountsPayable = await ensureAccountsPayable(scope, createdBy);
    const journal = await createJournalEntry({
      tenant: scope,
      createdBy,
      date: data.purchaseDate ? toDateOnly(data.purchaseDate) : toDateOnly(new Date()),
      memo: `Asset Acquisition ${assetTag} — ${data.name}`,
      lines: [
        { accountId: String(fixedAssets._id), debit: purchaseCost, credit: 0 },
        { accountId: String(accountsPayable._id), debit: 0, credit: purchaseCost },
      ],
    });
    asset.acquisitionJournalEntryId = journal._id as any;
    // Still part of the same logical create — attaching the journal-entry
    // reference right after insert shouldn't bump updatedAt away from
    // createdAt (see the shared success()/pagination() timestamp-stripping
    // in common.ts, which relies on that equality to detect "never really
    // updated").
    await asset.save({ timestamps: false });
  }

  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: AssetListOptions = {}
): Promise<{ totalCount: number; result: assetDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "assetTag", "serialNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      categoryId: "categoryId",
      assignedToId: "assignedToId",
      location: "location",
    }),
  };

  let cursor = AssetModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await AssetModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<assetDto | null> => {
  let cursor = AssetModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

const UPDATABLE_FIELDS: (keyof CreateAssetInput)[] = [
  "name",
  "categoryId",
  "serialNumber",
  "purchaseDate",
  "purchaseCost",
  "warrantyUntil",
  "currentValue",
  "currency",
  "notes",
  "depreciationMethod",
  "usefulLifeYears",
  "salvageValue",
];

const update = async (
  id: string,
  data: Partial<CreateAssetInput>,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }
  if (data.categoryId !== undefined) {
    const category = await AssetCategoryModel.findOne({ _id: data.categoryId, adminId: asset.adminId, merchantId: asset.merchantId }).lean();
    if (!category) {
      return { errorCode: "category_not_found", result: null };
    }
  }

  for (const field of UPDATABLE_FIELDS) {
    if (data[field] === undefined) continue;
    if (field === "purchaseDate" || field === "warrantyUntil") {
      (asset as any)[field] = data[field] ? toDateOnly(data[field] as string) : null;
    } else {
      (asset as any)[field] = data[field];
    }
  }

  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface AssignAssetInput {
  employeeId: string;
  assignedDate?: string;
  notes?: string;
}

const assign = async (
  id: string,
  data: AssignAssetInput,
  filter: Record<string, unknown>,
  actingUserId: string
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }
  if (asset.assignedToId) {
    return { errorCode: "already_assigned", result: null };
  }
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, adminId: asset.adminId, merchantId: asset.merchantId });
  if (!employee) {
    return { errorCode: "employee_not_found", result: null };
  }

  const assignedDate = data.assignedDate ? toDateOnly(data.assignedDate) : new Date();
  asset.assignmentHistory.unshift({
    employeeId: employee._id as any,
    assignedDate,
    returnDate: null,
    notes: data.notes || null,
    assignedBy: actingUserId as any,
  });
  asset.assignedToId = employee._id as any;
  asset.assignedDate = assignedDate;
  asset.status = "In use";
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface ReturnAssetInput {
  returnDate?: string;
  notes?: string;
}

const returnAsset = async (
  id: string,
  data: ReturnAssetInput,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }
  if (!asset.assignedToId) {
    return { errorCode: "not_assigned", result: null };
  }

  const returnDate = data.returnDate ? toDateOnly(data.returnDate) : new Date();
  const openEntry = asset.assignmentHistory.find((h) => !h.returnDate);
  if (openEntry) {
    openEntry.returnDate = returnDate;
    if (data.notes) openEntry.notes = data.notes;
  }
  asset.assignedToId = null;
  asset.assignedDate = null;
  asset.status = "In storage";
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface MaintenanceInput {
  date?: string;
  type?: string;
  description?: string;
  cost?: number;
  vendor?: string;
  status?: string;
  nextMaintenanceDate?: string;
}

const addMaintenance = async (
  id: string,
  data: MaintenanceInput,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }

  asset.maintenanceHistory.unshift({
    date: data.date ? toDateOnly(data.date) : new Date(),
    type: data.type || null,
    description: data.description || null,
    cost: data.cost || 0,
    vendor: data.vendor || null,
    status: data.status || "Completed",
    nextMaintenanceDate: data.nextMaintenanceDate ? toDateOnly(data.nextMaintenanceDate) : null,
  });
  if (data.type === "Breakdown" || data.status === "In Progress") {
    asset.status = "Maintenance";
  }
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

const updateMaintenance = async (
  id: string,
  recordId: string,
  data: MaintenanceInput,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  const record = (asset.maintenanceHistory as any).find((r: any) => String(r._id) === recordId);
  if (!record) {
    return { errorCode: "maintenance_record_not_found", result: null };
  }
  if (data.date !== undefined) record.date = data.date ? toDateOnly(data.date) : null;
  if (data.type !== undefined) record.type = data.type;
  if (data.description !== undefined) record.description = data.description;
  if (data.cost !== undefined) record.cost = data.cost;
  if (data.vendor !== undefined) record.vendor = data.vendor;
  if (data.status !== undefined) record.status = data.status;
  if (data.nextMaintenanceDate !== undefined) {
    record.nextMaintenanceDate = data.nextMaintenanceDate ? toDateOnly(data.nextMaintenanceDate) : null;
  }
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface InsuranceInput {
  policyNo?: string;
  provider?: string;
  startDate?: string;
  expiryDate?: string;
  premiumAmount?: number;
  coverageAmount?: number;
  notes?: string;
}

const updateInsurance = async (
  id: string,
  data: InsuranceInput | null,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }
  asset.insurance = data
    ? {
        policyNo: data.policyNo || null,
        provider: data.provider || null,
        startDate: data.startDate ? toDateOnly(data.startDate) : null,
        expiryDate: data.expiryDate ? toDateOnly(data.expiryDate) : null,
        premiumAmount: data.premiumAmount || 0,
        coverageAmount: data.coverageAmount || 0,
        notes: data.notes || null,
      }
    : null;
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface TransferLocationInput {
  location: string;
  date?: string;
  notes?: string;
}

const transferLocation = async (
  id: string,
  data: TransferLocationInput,
  filter: Record<string, unknown>,
  actingUserId: string
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }
  asset.locationHistory.unshift({
    location: data.location,
    date: data.date ? toDateOnly(data.date) : new Date(),
    notes: data.notes || null,
    movedBy: actingUserId as any,
  });
  asset.location = data.location;
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface DocumentInput {
  name: string;
  docType?: string;
  url?: string;
}

const addDocument = async (
  id: string,
  data: DocumentInput,
  filter: Record<string, unknown>,
  actingUserId: string
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  asset.documents.unshift({
    name: data.name,
    docType: data.docType || null,
    uploadedAt: new Date(),
    uploadedBy: actingUserId as any,
    url: data.url || null,
  });
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

const removeDocument = async (
  id: string,
  docId: string,
  filter: Record<string, unknown>
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  asset.documents = asset.documents.filter((d: any) => String(d._id) !== docId) as any;
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

interface DisposeAssetInput {
  date?: string;
  method?: string;
  salePrice?: number;
  reason?: string;
}

// Reuses the exact accounting logic the frontend's fake data already
// modeled (disposeAsset in assetFakeData.js) — now actually posted through
// createJournalEntry instead of being a display-only mock object. See
// calcBookValueAt above for why the figures line up with the Depreciation
// tab the user already sees.
const dispose = async (
  id: string,
  data: DisposeAssetInput,
  filter: Record<string, unknown>,
  actor: string
): Promise<AssetResult> => {
  const asset = await AssetModel.findOne({ _id: id, ...filter });
  if (!asset) {
    return { errorCode: "not_found", result: null };
  }
  if (asset.status === "Disposed") {
    return { errorCode: "already_disposed", result: null };
  }

  const scope: TenantScope = {
    adminId: asset.adminId ? String(asset.adminId) : null,
    merchantId: asset.merchantId ? String(asset.merchantId) : null,
  };
  const disposalDate = data.date ? toDateOnly(data.date) : new Date();
  const cost = asset.purchaseCost || 0;
  const salePrice = round2(data.salePrice || 0);
  const bookValue = calcBookValueAt(asset, disposalDate);
  const accDep = round2(cost - bookValue);
  const gain = round2(salePrice - bookValue);

  let journalEntryId: string | null = null;
  if (cost > 0) {
    const lines: { accountId: string; debit: number; credit: number }[] = [];
    const fixedAssets = await ensureFixedAssetsAccount(scope, actor);
    if (accDep > 0) {
      const accumulatedDep = await ensureAccumulatedDepreciation(scope, actor);
      lines.push({ accountId: String(accumulatedDep._id), debit: accDep, credit: 0 });
    }
    if (salePrice > 0) {
      const cash = await ensureCashOnHand(scope, actor);
      lines.push({ accountId: String(cash._id), debit: salePrice, credit: 0 });
    }
    if (gain < 0) {
      const lossAccount = await ensureLossOnDisposal(scope, actor);
      lines.push({ accountId: String(lossAccount._id), debit: round2(-gain), credit: 0 });
    } else if (gain > 0) {
      const gainAccount = await ensureGainOnDisposal(scope, actor);
      lines.push({ accountId: String(gainAccount._id), debit: 0, credit: gain });
    }
    lines.push({ accountId: String(fixedAssets._id), debit: 0, credit: cost });

    const journal = await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: disposalDate,
      memo: `Asset Disposal ${asset.assetTag} — ${asset.name}`,
      lines,
    });
    journalEntryId = String(journal._id);
  }

  asset.status = "Disposed";
  asset.disposal = {
    date: disposalDate,
    method: data.method || null,
    salePrice,
    reason: data.reason || null,
    approvedBy: actor as any,
    journalEntryId: journalEntryId as any,
  };
  asset.assignedToId = null;
  asset.assignedDate = null;
  await asset.save();
  await populateAll(asset);
  return { errorCode: "success", result: mapDbToDto(asset) };
};

export interface AssetSummary {
  total: number;
  totalPurchaseCost: number;
  totalBookValue: number;
  byStatus: Record<string, number>;
}

// Stat cards above the (now server-paginated) list — reflects the tenant's
// whole asset register regardless of the list's own search/status/category
// filters, same convention Stock's summary cards already follow.
const getSummary = async (filter: Record<string, unknown>): Promise<AssetSummary> => {
  const assets = await AssetModel.find(filter, {
    purchaseCost: 1,
    currentValue: 1,
    salvageValue: 1,
    usefulLifeYears: 1,
    depreciationMethod: 1,
    purchaseDate: 1,
    status: 1,
  }).lean();

  const now = new Date();
  const byStatus: Record<string, number> = {};
  let totalPurchaseCost = 0;
  let totalBookValue = 0;

  for (const asset of assets) {
    const cost = asset.purchaseCost || asset.currentValue || 0;
    totalPurchaseCost += cost;
    totalBookValue += calcBookValueAt(asset, now);
    const status = asset.status || "In storage";
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    total: assets.length,
    totalPurchaseCost: round2(totalPurchaseCost),
    totalBookValue: round2(totalBookValue),
    byStatus,
  };
};

// Distinct, non-empty location strings this tenant's assets actually use —
// backs the location filter dropdown now that the main list is
// server-paginated (the frontend no longer has "every asset" in memory to
// derive this from client-side).
const getDistinctLocations = async (filter: Record<string, unknown>): Promise<string[]> => {
  const locations = await AssetModel.distinct("location", { ...filter, location: { $ne: null } });
  return (locations as string[]).filter(Boolean).sort();
};

export {
  create,
  getAll,
  get,
  update,
  assign,
  returnAsset,
  addMaintenance,
  updateMaintenance,
  updateInsurance,
  transferLocation,
  addDocument,
  removeDocument,
  dispose,
  getDistinctLocations,
  getSummary,
};
