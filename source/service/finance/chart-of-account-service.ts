import { ChartOfAccountModel, ChartOfAccountType } from "../../model/finance/chart-of-account-model";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../../utility/helper/default-chart-of-accounts";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { chartOfAccountDto } from "../../utility/dtos/finance/chart-of-account-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/chart-of-account-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

// Called once, right after an Admin or Merchant account is created, so Loan/
// Expense/Provident Fund postings always have a valid target account.
const seedDefaultChartOfAccounts = async (tenant: TenantScope, createdBy: string): Promise<void> => {
  const docs = DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
    code: account.code,
    name: account.name,
    type: account.type,
    subType: account.subType,
    parentId: null,
    status: "Active",
    adminId: tenant.adminId,
    merchantId: tenant.merchantId,
    createdBy,
  }));

  await ChartOfAccountModel.insertMany(docs);
};

export interface ChartOfAccountListOptions {
  search?: string;
  type?: string;
  status?: string;
}

interface CreateChartOfAccountInput {
  code: string;
  name: string;
  type: ChartOfAccountType;
  subType?: string;
  parentId?: string;
  status?: string;
}

interface ChartOfAccountResult {
  errorCode: "success" | "duplicate_entry" | "not_found";
  result: chartOfAccountDto | null;
}

const create = async (
  data: CreateChartOfAccountInput,
  scope: TenantScope,
  createdBy: string
): Promise<ChartOfAccountResult> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: data.code,
  }).select("_id").lean();
  if (existing) {
    return { errorCode: "duplicate_entry", result: null };
  }

  const account = await ChartOfAccountModel.create({
    code: data.code,
    name: data.name,
    type: data.type,
    subType: data.subType || null,
    parentId: data.parentId || null,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(account) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: ChartOfAccountListOptions = {}
): Promise<{ totalCount: number; result: chartOfAccountDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["code", "name"]),
    ...buildExactFilters(options as Record<string, unknown>, { type: "type", status: "status" }),
  };

  const data = await ChartOfAccountModel.find(query)
    .skip(startIndex)
    .limit(limit)
    .sort({ code: 1 })
    .lean();
  const count = await ChartOfAccountModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<chartOfAccountDto | null> => {
  const data = await ChartOfAccountModel.findOne({ _id: id, ...filter }).lean();
  return data ? mapDbToDto(data) : null;
};

// Code/type are permanently fixed once an account exists — every ledger
// posting references accounts by code (see postAutoJournal), so only the
// display name and active/inactive status are ever safe to edit.
const update = async (
  id: string,
  data: { name?: string; status?: string },
  filter: Record<string, unknown>
): Promise<ChartOfAccountResult> => {
  const updatePayload: Record<string, unknown> = {};
  if (data.name) updatePayload.name = data.name;
  if (data.status) updatePayload.status = data.status;

  const updated = await ChartOfAccountModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export { seedDefaultChartOfAccounts, create, getAll, get, update };
