import { creditNoteDto } from "../../dtos/sales/credit-note-dto";
import { ICreditNoteModel } from "../../../model/sales/credit-note-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: ICreditNoteModel): creditNoteDto => {
  const customer = populated(dbModel.customerId, "name");
  const warehouse = populated(dbModel.warehouseId, "name");
  const invoice = populated(dbModel.originalInvoiceId, "invoiceNumber");

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    cnNumber: dbModel.cnNumber || null,
    customerId: customer.id,
    customerName: customer.name,
    date: formatDateOnly(dbModel.date),
    originalInvoiceId: invoice.id,
    originalInvoiceNumber: invoice.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    reason: dbModel.reason || null,
    returnType: dbModel.returnType || null,
    products: (dbModel.products || []).map((line: any) => {
      const v = populated(line.variantId, "variantName");
      return {
        variantId: v.id || "",
        variantName: v.name,
        sku: line.variantId?.sku || null,
        productName: line.productName || null,
        qty: line.qty,
        price: line.price,
        costPrice: line.costPrice ?? 0,
        unit: line.unit || "pcs",
        batchId: line.batchId ? String(line.batchId) : null,
        expiryDate: formatDateOnly(line.expiryDate),
        taxPercent: line.taxPercent ?? null,
        taxAmount: line.taxAmount ?? 0,
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

const mapDbListToDtoList = (dbModels: ICreditNoteModel[]): creditNoteDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
