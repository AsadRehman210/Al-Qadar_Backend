import { quarantineLotDto } from "../../dtos/inventory/quarantine-lot-dto";
import { IQuarantineLotModel } from "../../../model/inventory/quarantine-lot-model";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null; extra?: Record<string, unknown> } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc) && !("_id" in doc)) return { id: String(value), name: null };
  return {
    id: doc._id ? String(doc._id) : value ? String(value) : null,
    name: (doc[nameField] as string) || null,
    extra: doc,
  };
};

const mapDbToDto = (dbModel: IQuarantineLotModel): quarantineLotDto => {
  const variant = populated(dbModel.variantId, "variantName");
  const warehouse = populated(dbModel.warehouseId, "name");
  const invoice = populated(dbModel.originalInvoiceId, "invoiceNumber");
  const customer = populated(dbModel.customerId, "name");
  const production = populated(dbModel.productionOrderId, "orderNumber");
  const variantExtra = variant.extra || {};

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    lotNumber: dbModel.lotNumber || null,
    status: dbModel.status || null,
    variantId: variant.id,
    variantName: variant.name,
    sku: (variantExtra.sku as string) || null,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    qty: dbModel.qty ?? 0,
    remainingQty: dbModel.remainingQty ?? 0,
    reason: dbModel.reason || null,
    sourceType: dbModel.sourceType || null,
    sourceRef: dbModel.sourceRef || null,
    sourceId: dbModel.sourceId ? String(dbModel.sourceId) : null,
    originalInvoiceId: invoice.id,
    originalInvoiceNumber: invoice.name,
    customerId: customer.id,
    customerName: customer.name,
    productName: dbModel.productName || variant.name,
    costPrice: dbModel.costPrice ?? 0,
    unit: dbModel.unit || null,
    expiryDate: dbModel.expiryDate || null,
    currency: dbModel.currency || "SAR",
    productionOrderId: production.id,
    productionOrderNumber: production.name,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IQuarantineLotModel[]): quarantineLotDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
