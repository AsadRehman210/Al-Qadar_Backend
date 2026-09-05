import { productionOrderDto } from "../../dtos/inventory/production-dto";
import { IProductionOrderModel } from "../../../model/inventory/production-model";
import { formatDateOnly } from "../../helper/date-only";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IProductionOrderModel): productionOrderDto => {
  const output = populated(dbModel.outputVariantId, "variantName");
  const warehouse = populated(dbModel.warehouseId, "name");
  const outputWarehouse = populated(dbModel.outputWarehouseId || dbModel.warehouseId, "name");
  const lot = populated(dbModel.quarantineLotId, "lotNumber");

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    orderNumber: dbModel.orderNumber || null,
    status: dbModel.status || null,
    scheduledDate: formatDateOnly(dbModel.scheduledDate),
    completedDate: formatDateOnly(dbModel.completedDate),
    outputVariantId: output.id,
    outputVariantName: output.name,
    outputQuantity: dbModel.outputQuantity ?? 0,
    actualOutputQuantity: dbModel.actualOutputQuantity ?? null,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    outputWarehouseId: outputWarehouse.id,
    outputWarehouseName: outputWarehouse.name,
    outputExpiryDate: formatDateOnly(dbModel.outputExpiryDate),
    outputBatchNo: dbModel.outputBatchNo || null,
    outputBatchId: dbModel.outputBatchId ? String(dbModel.outputBatchId) : null,
    notes: dbModel.notes || null,
    rawLines: (dbModel.rawLines || []).map((line: any) => {
      const v = populated(line.variantId, "variantName");
      return {
        variantId: v.id || "",
        variantName: v.name,
        sku: line.variantId?.sku || null,
        quantity: line.quantity,
        costPrice: line.costPrice ?? line.variantId?.costPrice ?? null,
      };
    }),
    otherCostLines: (dbModel.otherCostLines || []).map((l) => ({ label: l.label, amount: l.amount })),
    consumedBatches: (dbModel.consumedBatches || []).map((line: any) => {
      const v = populated(line.variantId, "variantName");
      return {
        variantId: v.id || "",
        variantName: v.name,
        sku: line.variantId?.sku || null,
        batchId: line.batchId ? String(line.batchId) : "",
        qty: line.qty,
        unitCost: line.unitCost ?? null,
        expiryDate: formatDateOnly(line.expiryDate),
      };
    }),
    quarantineLotId: lot.id,
    quarantineLotNumber: lot.name,
    quarantineQty: dbModel.quarantineQty ?? null,
    unitCost: dbModel.unitCost ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IProductionOrderModel[]): productionOrderDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
