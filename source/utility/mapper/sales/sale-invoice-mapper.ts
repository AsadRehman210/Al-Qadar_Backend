import { saleInvoiceDto } from "../../dtos/sales/sale-invoice-dto";
import { ISaleInvoiceModel } from "../../../model/sales/sale-invoice-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: ISaleInvoiceModel): saleInvoiceDto => {
  const customer = populated(dbModel.customerId, "name");
  const warehouse = populated(dbModel.warehouseId, "name");
  const paid = (dbModel.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    invoiceNumber: dbModel.invoiceNumber || null,
    customerId: customer.id,
    customerName: customer.name,
    date: formatDateOnly(dbModel.date),
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    receiverName: dbModel.receiverName || null,
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
    subtotal: dbModel.subtotal ?? 0,
    taxPercent: dbModel.taxPercent ?? 0,
    taxAmount: dbModel.taxAmount ?? 0,
    total: dbModel.total ?? 0,
    shippingAddress: dbModel.shippingAddress || null,
    deliveryDate: formatDateOnly(dbModel.deliveryDate),
    deliveryStatus: dbModel.deliveryStatus || null,
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
    // creditedAmount/refundDue/returnedItems need a CreditNote query the
    // mapper has no business making — the service layer merges those in
    // (see getCreditedAmounts in sale-invoice-service.ts).
    balanceDue: (dbModel.total || 0) - paid,
    notes: dbModel.notes || null,
    currency: dbModel.currency || "SAR",
    convertedFromQuotationId: dbModel.convertedFromQuotationId ? String(dbModel.convertedFromQuotationId) : null,
    convertedFromQuoteNumber: dbModel.convertedFromQuoteNumber || null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ISaleInvoiceModel[]): saleInvoiceDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
