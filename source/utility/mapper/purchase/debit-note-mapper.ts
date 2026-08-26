import { debitNoteDto } from "../../dtos/purchase/debit-note-dto";
import { IDebitNoteModel } from "../../../model/purchase/debit-note-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IDebitNoteModel): debitNoteDto => {
  const supplier = populated(dbModel.supplierId, "name");
  const warehouse = populated(dbModel.warehouseId, "name");
  const invoice = populated(dbModel.originalInvoiceId, "invoiceNumber");

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    dnNumber: dbModel.dnNumber || null,
    supplierId: supplier.id,
    supplierName: supplier.name,
    date: formatDateOnly(dbModel.date),
    originalInvoiceId: invoice.id,
    originalInvoiceNumber: invoice.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    reason: dbModel.reason || null,
    products: (dbModel.products || []).map((line: any) => {
      const v = populated(line.variantId, "variantName");
      return {
        variantId: v.id || "",
        variantName: v.name,
        sku: line.variantId?.sku || null,
        productName: line.productName || null,
        qty: line.qty,
        price: line.price,
        unit: line.unit || "pcs",
        batchId: line.batchId ? String(line.batchId) : null,
        expiryDate: formatDateOnly(line.expiryDate),
        taxPercent: line.taxPercent ?? null,
        taxAmount: line.taxAmount ?? 0,
        unitCost: line.unitCost ?? 0,
      };
    }),
    discount: dbModel.discount ?? 0,
    subtotal: dbModel.subtotal ?? 0,
    taxPercent: dbModel.taxPercent ?? 0,
    taxAmount: dbModel.taxAmount ?? 0,
    total: dbModel.total ?? 0,
    currency: dbModel.currency || "SAR",
    status: dbModel.status || null,
    notes: dbModel.notes || null,
    approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
    stockApplied: dbModel.stockApplied ?? false,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IDebitNoteModel[]): debitNoteDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
