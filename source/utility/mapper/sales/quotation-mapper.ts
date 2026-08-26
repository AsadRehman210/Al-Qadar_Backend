import { quotationDto } from "../../dtos/sales/quotation-dto";
import { IQuotationModel } from "../../../model/sales/quotation-model";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IQuotationModel): quotationDto => {
  const customer = populated(dbModel.customerId, "name");
  const warehouse = populated(dbModel.warehouseId, "name");

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    quoteNumber: dbModel.quoteNumber || null,
    customerId: customer.id,
    customerName: customer.name,
    date: dbModel.date || null,
    validUntil: dbModel.validUntil || null,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    lines: (dbModel.lines || []).map((line: any) => {
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
        expiryDate: line.expiryDate || null,
        taxPercent: line.taxPercent ?? null,
        taxAmount: line.taxAmount ?? 0,
      };
    }),
    subtotal: dbModel.subtotal ?? 0,
    taxPercent: dbModel.taxPercent ?? 0,
    taxAmount: dbModel.taxAmount ?? 0,
    total: dbModel.total ?? 0,
    currency: dbModel.currency || "SAR",
    status: dbModel.status || null,
    notes: dbModel.notes || null,
    convertedInvoiceId: dbModel.convertedInvoiceId ? String(dbModel.convertedInvoiceId) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IQuotationModel[]): quotationDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
