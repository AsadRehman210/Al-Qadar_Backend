import { vendorBillDto, vendorBillLineDto } from "../../dtos/finance/vendor-bill-dto";
import { IVendorBillModel } from "../../../model/finance/vendor-bill-model";

const mapLine = (line: unknown): vendorBillLineDto => {
  const raw = line as Record<string, unknown>;
  const account = raw.expenseAccountId as Record<string, unknown> | string | null;
  const isPopulated = account && typeof account === "object";
  return {
    description: (raw.description as string) || "",
    amount: (raw.amount as number) || 0,
    expenseAccountId: isPopulated ? String((account as Record<string, unknown>)._id) : String(account || ""),
    expenseAccountCode: isPopulated ? ((account as Record<string, unknown>).code as string) || null : null,
    expenseAccountName: isPopulated ? ((account as Record<string, unknown>).name as string) || null : null,
  };
};

const mapDbToDto = (dbModel: IVendorBillModel): vendorBillDto => {
  const total = dbModel.total || 0;
  const paidToDate = dbModel.paidToDate || 0;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    vendorName: dbModel.vendorName || null,
    vendorContact: dbModel.vendorContact || null,
    billNumber: dbModel.billNumber || null,
    billDate: dbModel.billDate || null,
    dueDate: dbModel.dueDate || null,
    lines: (dbModel.lines || []).map(mapLine),
    subtotal: dbModel.subtotal || 0,
    vatRate: dbModel.vatRate || 0,
    vatAmount: dbModel.vatAmount || 0,
    total,
    paidToDate,
    balanceDue: total - paidToDate,
    currency: dbModel.currency || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IVendorBillModel[]): vendorBillDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
