import { productionOrderDto } from "../../dtos/inventory/production-dto";
import { IProductionOrderModel } from "../../../model/inventory/production-model";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IProductionOrderModel): productionOrderDto => {
  const output = populated(dbModel.outputVariantId, "variantName");
  const warehouse = populated(dbModel.warehouseId, "name");

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    orderNumber: dbModel.orderNumber || null,
    status: dbModel.status || null,
    scheduledDate: dbModel.scheduledDate || null,
    completedDate: dbModel.completedDate || null,
    outputVariantId: output.id,
    outputVariantName: output.name,
    outputQuantity: dbModel.outputQuantity ?? 0,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    notes: dbModel.notes || null,
    rawLines: (dbModel.rawLines || []).map((line: any) => {
      const v = populated(line.variantId, "variantName");
      return {
        variantId: v.id || "",
        variantName: v.name,
        sku: line.variantId?.sku || null,
        quantity: line.quantity,
        actualQuantity: line.actualQuantity ?? null,
      };
    }),
    otherCostLines: (dbModel.otherCostLines || []).map((l) => ({ label: l.label, amount: l.amount })),
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
