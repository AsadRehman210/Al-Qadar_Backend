import { StockIssueModel } from "../../model/warehouse/stock-issue-model";
import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { stockIssueDto } from "../../utility/dtos/warehouse/stock-issue-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/warehouse/stock-issue-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockMapForWarehouse } from "./stock-level-service";
import { consumeBatch } from "../inventory/stock-batch-service";
import { toDateOnly } from "../../utility/helper/date-only";
import { createJournalEntry } from "../finance/journal-service";
import {
  ensureInventory,
  ensureInventoryLossExpense,
  ensureInternalUseExpense,
  ensureSamplesExpense,
  ensureOtherOperatingExpense,
} from "../../utility/helper/finance-accounts";

// Every issueType writes inventory off the balance sheet into its own
// expense line — goods left the warehouse without a sale, so Inventory
// is credited and a typed expense is debited.
const ISSUE_TYPE_EXPENSE_ACCOUNT: Record<string, typeof ensureInventoryLossExpense> = {
  Damage: ensureInventoryLossExpense,
  "Internal Use": ensureInternalUseExpense,
  Sample: ensureSamplesExpense,
};

const POPULATE: [string, string][] = [
  ["warehouseId", "name"],
  ["items.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

export interface StockIssueListOptions {
  search?: string;
  warehouseId?: string;
  issueType?: string;
}

interface IssueItemInput {
  variantId: string;
  qty: number;
}

interface CreateStockIssueInput {
  warehouseId: string;
  date: string;
  issueType?: string;
  issuedTo?: string;
  reference?: string;
  notes?: string;
  items: IssueItemInput[];
}

export interface IssueShortage {
  variantId: string;
  available: number;
  requested: number;
}

export interface StockIssueResult {
  errorCode: "success" | "warehouse_not_found" | "insufficient_stock";
  result: stockIssueDto | null;
  shortages?: IssueShortage[];
}

const generateIssueNo = async (tenant: TenantScope): Promise<string> => {
  const count = await StockIssueModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `ISS-${String(count + 1).padStart(6, "0")}`;
};

// FEFO-consumes qty out of whatever batches this variant/warehouse actually
// has, so batch history stays in sync with the aggregate StockLevel this
// same call is about to subtract from (see Stock Transfer's identical
// helper for the same reasoning — the class of bug fixed on Credit/Debit
// Note this session).
const consumeFefo = async (variantId: string, warehouseId: string, qty: number): Promise<void> => {
  const batches = await StockBatchModel.find({ variantId, warehouseId, remainingQty: { $gt: 0 } }).sort({ expiryDate: 1 }).lean();
  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(batch.remainingQty) || 0, remaining);
    if (take <= 0) continue;
    await consumeBatch(String(batch._id), take);
    remaining -= take;
  }
};

// Dispatch-and-done — no approval stage, stock is subtracted immediately on
// create, matching the frontend's existing createStockIssue behavior. Stock
// sufficiency is checked first — previously this silently floored at 0 with
// no error, so issuing more than available just quietly under-issued with
// no signal to the user that anything was short.
const create = async (
  data: CreateStockIssueInput,
  scope: TenantScope,
  createdBy: string
): Promise<StockIssueResult> => {
  const warehouse = await WarehouseModel.findOne({ _id: data.warehouseId, adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  if (!warehouse) {
    return { errorCode: "warehouse_not_found", result: null };
  }

  const availableMap = await getStockMapForWarehouse(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    data.warehouseId
  );
  const shortages: IssueShortage[] = [];
  for (const item of data.items) {
    const available = availableMap.get(String(item.variantId)) || 0;
    if (item.qty > available) {
      shortages.push({ variantId: String(item.variantId), available, requested: item.qty });
    }
  }
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  const issueNo = await generateIssueNo(scope);
  const issue = await StockIssueModel.create({
    issueNo,
    warehouseId: data.warehouseId,
    date: toDateOnly(data.date),
    issueType: data.issueType || "Internal Use",
    issuedTo: data.issuedTo || null,
    reference: data.reference || null,
    notes: data.notes || null,
    issuedBy: createdBy,
    items: data.items,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  let issuedValue = 0;
  for (const item of data.items) {
    const variant = await VariantModel.findById(item.variantId).lean();
    issuedValue += item.qty * (variant?.costPrice || 0);

    await adjustStock(
      scope,
      item.variantId,
      data.warehouseId,
      "subtract",
      item.qty,
      `Stock Issue ${issueNo} — ${data.issueType || "Internal Use"}`,
      createdBy
    );
    await consumeFefo(item.variantId, data.warehouseId, item.qty);
  }

  if (issuedValue > 0) {
    const ensureExpenseAccount = ISSUE_TYPE_EXPENSE_ACCOUNT[data.issueType || "Internal Use"] || ensureOtherOperatingExpense;
    const expenseAccount = await ensureExpenseAccount(scope, createdBy);
    const inventoryAccount = await ensureInventory(scope, createdBy);
    await createJournalEntry({
      tenant: scope,
      createdBy,
      date: toDateOnly(data.date),
      memo: `Stock Issue ${issueNo} — ${data.issueType || "Internal Use"}`,
      lines: [
        { accountId: String(expenseAccount._id), debit: issuedValue, credit: 0 },
        { accountId: String(inventoryAccount._id), debit: 0, credit: issuedValue },
      ],
    });
  }

  await populateAll(issue);
  return { errorCode: "success", result: mapDbToDto(issue) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: StockIssueListOptions = {}
): Promise<{ totalCount: number; result: stockIssueDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["issueNo"]),
    ...buildExactFilters(options as Record<string, unknown>, { warehouseId: "warehouseId", issueType: "issueType" }),
  };

  let cursor = StockIssueModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await StockIssueModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<stockIssueDto | null> => {
  let cursor = StockIssueModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

export { create, getAll, get };
