import { purchaseInvoiceDto } from "../../dtos/purchase/purchase-invoice-dto";
import { IPurchaseInvoiceModel } from "../../../model/purchase/purchase-invoice-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IPurchaseInvoiceModel): purchaseInvoiceDto => {
  const supplier = populated(dbModel.supplierId, "name");
  const warehouse = populated(dbModel.warehouseId, "name");
  const paid = (dbModel.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    invoiceNumber: dbModel.invoiceNumber || null,
    supplierId: supplier.id,
    supplierName: supplier.name,
    date: formatDateOnly(dbModel.date),
    expectedDelivery: formatDateOnly(dbModel.expectedDelivery),
    receivedDate: formatDateOnly(dbModel.receivedDate),
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    receiverName: dbModel.receiverName || null,
    productType: dbModel.productType || null,
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
        expiryDate: formatDateOnly(line.expiryDate),
        taxPercent: line.taxPercent ?? null,
        taxAmount: line.taxAmount ?? 0,
        unitCost: line.unitCost ?? 0,
      };
    }),
    subtotal: dbModel.subtotal ?? 0,
    taxPercent: dbModel.taxPercent ?? 0,
    taxAmount: dbModel.taxAmount ?? 0,
    taxRecoverable: dbModel.taxRecoverable ?? true,
    total: dbModel.total ?? 0,
    status: dbModel.status || null,
    stockApplied: dbModel.stockApplied ?? false,
    paymentStatus: dbModel.paymentStatus || null,
    paymentHistory: (dbModel.paymentHistory || []).map((p) => ({
      date: formatDateOnly(p.date),
      amount: p.amount,
      method: p.method || null,
      reference: p.reference || null,
    })),
    refundHistory: (dbModel.refundHistory || []).map((p) => ({
      date: formatDateOnly(p.date),
      amount: p.amount,
      method: p.method || null,
      reference: p.reference || null,
    })),
    // debitedAmount/refundDue/returnedItems need a DebitNote query the
    // mapper has no business making — the service layer merges those in
    // (see getDebitedAmounts in purchase-invoice-service.ts).
    balanceDue: (dbModel.total || 0) - paid,
    notes: dbModel.notes || null,
    currency: dbModel.currency || "SAR",
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IPurchaseInvoiceModel[]): purchaseInvoiceDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
