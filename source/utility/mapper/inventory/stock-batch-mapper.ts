import { stockBatchDto } from "../../dtos/inventory/stock-batch-dto";
import { IStockBatchModel } from "../../../model/inventory/stock-batch-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IStockBatchModel): stockBatchDto => {
  const variant = populated(dbModel.variantId, "variantName");
  const warehouse = populated(dbModel.warehouseId, "name");
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    variantId: variant.id,
    variantName: variant.name,
    sku: (dbModel.variantId as any)?.sku || null,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    batchNo: dbModel.batchNo || null,
    qty: dbModel.qty ?? 0,
    remainingQty: dbModel.remainingQty ?? 0,
    unitCost: dbModel.unitCost ?? 0,
    expiryDate: formatDateOnly(dbModel.expiryDate),
    receivedDate: formatDateOnly(dbModel.receivedDate),
    sourceType: dbModel.sourceType || null,
    sourceRef: dbModel.sourceRef || null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IStockBatchModel[]): stockBatchDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
