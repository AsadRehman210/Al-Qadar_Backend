import { ChartOfAccountModel, IChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "./tenant-scope";

// Accounts Receivable (code "1100") was added to the default seed list after
// some tenants were already created — self-heal by creating it on first use
// (Customer Invoice send, or a standalone receipt Payment), same pattern
// Bank & Cash uses for its own backing account. Shared here since both
// customer-invoice-service and payment-service need it.
const ensureAccountsReceivable = async (
  scope: TenantScope,
  createdBy: string
): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "1100",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1100",
    name: "Accounts Receivable",
    type: "Asset",
    subType: "current_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// VAT Payable/Receivable (codes "2050"/"1150") were added to the default
// seed list after some tenants were already created — self-heal the same way.
const ensureVatPayable = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "2050",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "2050",
    name: "VAT Payable",
    type: "Liability",
    subType: "vat_payable",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

const ensureVatReceivable = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "1150",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1150",
    name: "VAT Receivable",
    type: "Asset",
    subType: "vat_receivable",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// Accounts Payable ("2000") is already in the default seed list, but tenants
// created before this module existed still need the same self-heal.
const ensureAccountsPayable = async (
  scope: TenantScope,
  createdBy: string
): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "2000",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "2000",
    name: "Accounts Payable",
    type: "Liability",
    subType: "current_liability",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// Inventory ("1300") — the asset that holds unsold goods. Purchase Invoice
// Received debits this (not COGS); Sale Invoice credits it when the goods
// actually leave. Self-heals for tenants created before this account existed.
const ensureInventory = async (
  scope: TenantScope,
  createdBy: string
): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "1300",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1300",
    name: "Inventory",
    type: "Asset",
    subType: "current_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// Cost of Goods Sold ("5300") — recognized at sale time (Dr COGS / Cr
// Inventory), not when goods are purchased. Self-heals the same way for
// every tenant, new or existing.
const ensureCostOfGoodsSold = async (
  scope: TenantScope,
  createdBy: string
): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "5300",
  });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "5300",
    name: "Cost of Goods Sold",
    type: "Expense",
    subType: "cost_of_goods_sold",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// Small helper factory — the four accounts below (5310/5320/5330/5340) are
// all new, same self-heal shape as ensureCostOfGoodsSold, just parameterized
// instead of copy-pasted four times.
const ensureExpenseAccount = (code: string, name: string) => async (
  scope: TenantScope,
  createdBy: string
): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code,
    name,
    type: "Expense",
    subType: "operating_expense",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

// Stock Issue writes inventory off the balance sheet into one of these
// three, by issueType — shrinkage/internal-use/samples become their own
// P&L line instead of sitting in Inventory or blending into COGS.
const ensureInventoryLossExpense = ensureExpenseAccount("5310", "Inventory Loss & Write-off Expense");
const ensureInternalUseExpense = ensureExpenseAccount("5320", "Internal Use Expense");
const ensureSamplesExpense = ensureExpenseAccount("5330", "Samples & Marketing Expense");
// "Other" issue type and anything unmapped falls back here — 5290 was
// already in the default seed list, but tenants created before that self-heal
// the same way as everything else in this file.
const ensureOtherOperatingExpense = ensureExpenseAccount("5290", "Other Operating Expense");
// Production's otherCostLines (labor/overhead) — previously folded silently
// into the output variant's weighted-average cost with no Finance posting.
const ensureManufacturingOverheadExpense = ensureExpenseAccount("5340", "Manufacturing Overhead Expense");

// Asset Management — acquisition capitalizes to Fixed Assets; disposal
// reverses it against Accumulated Depreciation plus a Gain/Loss line
// depending on sale price vs. book value at disposal time.
const ensureFixedAssetsAccount = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code: "1500" });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1500",
    name: "Fixed Assets",
    type: "Asset",
    subType: "fixed_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};
const ensureAccumulatedDepreciation = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code: "1510" });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1510",
    name: "Accumulated Depreciation",
    type: "Asset",
    subType: "contra_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};
const ensureLossOnDisposal = ensureExpenseAccount("5350", "Loss on Disposal of Asset");
const ensureCashOnHand = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code: "1000" });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "1000",
    name: "Cash on Hand",
    type: "Asset",
    subType: "current_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};
const ensureGainOnDisposal = async (scope: TenantScope, createdBy: string): Promise<IChartOfAccountModel> => {
  const existing = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code: "4100" });
  if (existing) return existing;
  return ChartOfAccountModel.create({
    code: "4100",
    name: "Gain on Disposal of Asset",
    type: "Revenue",
    subType: "other_income",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

export {
  ensureAccountsReceivable,
  ensureVatPayable,
  ensureVatReceivable,
  ensureAccountsPayable,
  ensureInventory,
  ensureCostOfGoodsSold,
  ensureInventoryLossExpense,
  ensureInternalUseExpense,
  ensureSamplesExpense,
  ensureOtherOperatingExpense,
  ensureManufacturingOverheadExpense,
  ensureFixedAssetsAccount,
  ensureAccumulatedDepreciation,
  ensureLossOnDisposal,
  ensureGainOnDisposal,
  ensureCashOnHand,
};
