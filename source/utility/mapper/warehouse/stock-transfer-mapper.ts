import { stockTransferDto } from "../../dtos/warehouse/stock-transfer-dto";
import { IStockTransferModel } from "../../../model/warehouse/stock-transfer-model";

const populated = (value: unknown, nameField: string): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!(nameField in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc[nameField] as string) || null };
};

const mapDbToDto = (dbModel: IStockTransferModel): stockTransferDto => {
  const from = populated(dbModel.fromWarehouseId, "name");
  const to = populated(dbModel.toWarehouseId, "name");
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    transferNo: dbModel.transferNo || null,
    fromWarehouseId: from.id,
    fromWarehouseName: from.name,
    toWarehouseId: to.id,
    toWarehouseName: to.name,
    date: dbModel.date || null,
    status: dbModel.status || null,
    approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
    notes: dbModel.notes || null,
    items: (dbModel.items || []).map((item: any) => {
      const v = populated(item.variantId, "variantName");
      return { variantId: v.id || "", variantName: v.name, sku: item.variantId?.sku || null, qty: item.qty };
    }),
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IStockTransferModel[]): stockTransferDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
